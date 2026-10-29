/* siymon — offline sync queue (section 20).
   One small, dependency-free module used in the browser (window.SSyncQueue) and in node tests (module.exports).

   Rules it enforces in code, not in UI:
   - Only a short WHITELIST of non-sensitive kinds can ever be queued. Accept, pickup, delivery (anything that
     needs a verification code), cancel, payments/wallet and location pings are NOT queueable: enqueue() refuses them.
   - Every entry has an idempotency key (the server de-duplicates on it), so a retry can never duplicate.
   - Strict FIFO per order: if an earlier entry of an order fails, later entries of that same order wait
     (they are never applied out of order). Other orders keep syncing.
   - Retryable failures (no network, timeout, 408/425/429/5xx) keep the entry "pending" and stop the pass.
     Permanent failures (other 4xx) mark it "failed" with the server's reason; the user can retry or discard.
   - Entries older than maxAgeMs are not sent automatically: they become "expired" (failed) for review.
   - Single flight: two flushes never run at the same time.
   - Nothing is ever reported as confirmed until the server answered ok. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SSyncQueue = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var QUEUEABLE = Object.freeze(["chat_text", "order_on_the_way"]);
  var NEVER = Object.freeze(["accept", "picked_up", "delivered", "cancel", "payment", "wallet", "location", "verify_code"]);
  var RETRYABLE_STATUS = [0, 408, 425, 429, 500, 502, 503, 504];

  function isRetryable(status) {
    status = Number(status);
    return RETRYABLE_STATUS.indexOf(status) >= 0 || (status >= 500 && status < 600);
  }

  function memoryStorage() {
    var m = {};
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
      setItem: function (k, v) { m[k] = String(v); },
      removeItem: function (k) { delete m[k]; },
    };
  }

  function uid(now) {
    var r = "";
    try {
      var a = new Uint8Array(8);
      (typeof crypto !== "undefined" && crypto.getRandomValues ? crypto : require("crypto").webcrypto).getRandomValues(a);
      for (var i = 0; i < a.length; i++) r += (a[i] < 16 ? "0" : "") + a[i].toString(16);
    } catch (_e) { r = Math.random().toString(16).slice(2, 12); }
    return "q" + now.toString(36) + r;
  }

  /**
   * opts: { storage, storageKey, now(), send(entry) -> Promise<{ok:true}|{ok:false,status,error,code}>,
   *         maxAgeMs, maxEntries, onChange() }
   */
  function create(opts) {
    opts = opts || {};
    var storage = opts.storage || memoryStorage();
    var key = opts.storageKey || "siymon_sync_queue_v1";
    var nowFn = opts.now || Date.now;
    var send = opts.send;
    var maxAgeMs = opts.maxAgeMs == null ? 30 * 60 * 1000 : opts.maxAgeMs;
    var maxEntries = opts.maxEntries || 50;
    var listeners = [];
    var flushing = null;
    var state = load();

    function load() {
      try {
        var raw = storage.getItem(key);
        var s = raw ? JSON.parse(raw) : null;
        if (s && Array.isArray(s.entries)) {
          // an entry that was "sending" when the page died is simply pending again (its key makes the retry safe)
          s.entries.forEach(function (e) { if (e.state === "sending") e.state = "pending"; });
          return { entries: s.entries, lastSyncAt: s.lastSyncAt || 0 };
        }
      } catch (_e) {}
      return { entries: [], lastSyncAt: 0 };
    }
    function persist() {
      try { storage.setItem(key, JSON.stringify(state)); } catch (_e) { /* storage full/blocked: queue still works in memory */ }
    }
    function emit() {
      persist();
      listeners.slice().forEach(function (fn) { try { fn(api.snapshot()); } catch (_e) {} });
      try { opts.onChange && opts.onChange(api.snapshot()); } catch (_e) {}
    }

    function blockedOrders() {
      var b = {};
      state.entries.forEach(function (e) { if (e.state === "failed" || e.state === "expired") b[e.orderId || "_"] = true; });
      return b;
    }

    var api = {
      QUEUEABLE: QUEUEABLE,

      /** @returns {{ok:true,entry}|{ok:false,error}} */
      /** `key` (optional): reuse the idempotency key of an attempt that already went out and got no answer,
          so the server can recognise the retry as the SAME operation. */
      enqueue: function (kind, orderId, payload, key) {
        kind = String(kind || "");
        if (NEVER.indexOf(kind) >= 0 || QUEUEABLE.indexOf(kind) < 0) return { ok: false, error: "not_queueable" };
        if (state.entries.length >= maxEntries) return { ok: false, error: "queue_full" };
        var t = nowFn();
        var entry = {
          id: uid(t),
          key: (typeof key === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(key)) ? key : uid(t), // idempotency key sent to the server
          kind: kind,
          orderId: orderId == null ? "" : String(orderId),
          payload: payload || {},
          createdAt: t,
          state: "pending",
          attempts: 0,
          error: "",
        };
        state.entries.push(entry);
        emit();
        return { ok: true, entry: entry };
      },

      /** Sends pending entries in order. Safe to call any time; never runs twice at once. */
      flush: function () {
        if (flushing) return flushing;
        var run = (async function () {
          var summary = { sent: 0, failed: 0, stoppedOffline: false };
          try {
            var guard = 0;
            while (guard++ < maxEntries + 5) {
              var blocked = blockedOrders();
              var t = nowFn();
              var next = null;
              for (var i = 0; i < state.entries.length; i++) {
                var e = state.entries[i];
                if (e.state !== "pending") continue;
                if (blocked[e.orderId || "_"]) continue; // keep per-order ordering
                if (t - e.createdAt > maxAgeMs) {
                  e.state = "expired"; e.error = "expired";
                  summary.failed++; emit();
                  blocked = blockedOrders();
                  continue;
                }
                next = e; break;
              }
              if (!next) break;
              next.state = "sending"; next.attempts++; emit();
              var res;
              try { res = await send(next); } catch (err) { res = { ok: false, status: 0, error: String(err && err.message || "network") }; }
              if (res && res.ok) {
                state.entries = state.entries.filter(function (x) { return x.id !== next.id; });
                state.lastSyncAt = nowFn();
                summary.sent++; emit();
                continue;
              }
              var st = res && res.status != null ? Number(res.status) : 0;
              if (isRetryable(st)) {
                next.state = "pending"; next.error = (res && res.error) || "network";
                summary.stoppedOffline = true; emit();
                break; // the network/server is not ready: keep order, try again later
              }
              next.state = "failed";
              next.error = (res && (res.code || res.error)) || "rejected";
              next.errorMessage = (res && res.error) || "";
              summary.failed++; emit();
            }
          } catch (_e) { /* never leave the lock held */ }
          return summary;
        })();
        // Release the lock AFTER `flushing` was assigned: an empty queue finishes synchronously, and clearing it
        // inside the async function would leave a stale resolved promise as the lock forever (nothing would sync).
        flushing = run;
        var release = function () { if (flushing === run) flushing = null; };
        run.then(release, release);
        return run;
      },

      retry: function (id) {
        var e = state.entries.find(function (x) { return x.id === id; });
        if (!e || (e.state !== "failed" && e.state !== "expired")) return false;
        // an expired entry is NOT silently revived (it may be stale): the user must discard it and redo the action.
        if (e.state === "expired") return false;
        e.state = "pending"; e.error = ""; e.errorMessage = ""; e.createdAt = e.createdAt; emit();
        return true;
      },
      discard: function (id) {
        var n = state.entries.length;
        state.entries = state.entries.filter(function (x) { return x.id !== id; });
        if (state.entries.length !== n) emit();
        return state.entries.length !== n;
      },
      clear: function () { state = { entries: [], lastSyncAt: state.lastSyncAt }; emit(); },

      markSynced: function () { state.lastSyncAt = nowFn(); persist(); },
      lastSyncAt: function () { return state.lastSyncAt || 0; },
      list: function (orderId) {
        return state.entries.filter(function (e) { return orderId == null || e.orderId === String(orderId); }).map(function (e) { return Object.assign({}, e); });
      },
      counts: function () {
        var c = { pending: 0, sending: 0, failed: 0, expired: 0 };
        state.entries.forEach(function (e) { c[e.state] = (c[e.state] || 0) + 1; });
        return c;
      },
      snapshot: function () { return { counts: api.counts(), lastSyncAt: state.lastSyncAt || 0, entries: api.list() }; },
      subscribe: function (fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; },
      isRetryable: isRetryable,
    };
    return api;
  }

  return { create: create, QUEUEABLE: QUEUEABLE, NEVER: NEVER, isRetryable: isRetryable };
});

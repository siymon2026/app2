/* siymon driver — offline behaviour & reconnection (section 20).
   Loaded after driver.js (shares its globals: api, t, lang, token, me, lastOrders, loadOrders ...).
   What it does:
   - shows a REAL offline state (a failed request to our own server, or the /api/health probe) with the time of the
     last successful synchronisation;
   - keeps a sanitised snapshot of the ACTIVE delivery so the screen is not blank when the network drops
     (labelled "last known", cleared on logout / when the order ends);
   - queues only NON-sensitive updates (chat text, "start delivery") as PENDING and syncs them after reconnect
     through the server (idempotency key + server-side validation); everything else is refused with a clear message:
     accept, pickup/delivery verification, cancel, wallet, location are never completed or claimed offline;
   - shows sync errors with retry / discard. */
(function () {
  "use strict";
  if (window.SiymonOffline || typeof SSyncQueue === "undefined") return;

  var SNAP_KEY = "siymon_driver_active_snapshot_v1";
  var Q_KEY = "siymon_driver_sync_queue_v1";
  var SNAP_MAX_AGE = 12 * 3600 * 1000;
  var PROBE_EVERY = 5000;
  var FLUSH_EVERY = 30000;

  var L = {
    ar: {
      offline: "لا يوجد اتصال بالإنترنت", lastSync: "آخر مزامنة", never: "لم تتم مزامنة بعد",
      pending: "بانتظار الإرسال", failed: "تعذّرت المزامنة", expired: "منتهي الصلاحية",
      retry: "إعادة المحاولة", discard: "حذف", syncing: "جارٍ المزامنة…", synced: "تمت المزامنة",
      kChat: "رسالة", kOnTheWay: "بدء التوصيل", snapshot: "آخر بيانات محفوظة", pendingBadge: "قيد الإرسال — لم يؤكده الخادم بعد",
      needOnline: "هذه الخطوة تتطلب اتصالاً بالخادم (تحقق/تأكيد). لم تُنفَّذ.",
      acceptUnconfirmed: "لم يصل تأكيد الخادم؛ لم يُؤكَّد قبول الطلب. سنتحقق عند عودة الاتصال.",
      queued: "حُفظ كـ «قيد الإرسال» وسيُرسل عند عودة الاتصال.",
      errNotQueueable: "لا يمكن إرسال هذه الخطوة من الطابور", errExpired: "انتهت صلاحية التحديث؛ راجع الطلب وأعد الإجراء",
      errIllegal: "لم يعد هذا التحديث ممكناً لحالة الطلب الحالية", errClosed: "المحادثة مغلقة", errGeneric: "رفضه الخادم",
      queueFull: "الطابور ممتلئ؛ انتظر عودة الاتصال.", staleLoc: "موقعك غير محدّث",
    },
    en: {
      offline: "No internet connection", lastSync: "Last sync", never: "Not synced yet",
      pending: "Waiting to send", failed: "Sync failed", expired: "Expired",
      retry: "Retry", discard: "Discard", syncing: "Syncing…", synced: "Synced",
      kChat: "Message", kOnTheWay: "Start delivery", snapshot: "Last saved data", pendingBadge: "Pending — not confirmed by the server yet",
      needOnline: "This step needs a live server connection (verification/confirmation). It was NOT done.",
      acceptUnconfirmed: "No server confirmation arrived; the order was NOT confirmed as accepted. We will check when you are back online.",
      queued: "Saved as pending; it will be sent when you are back online.",
      errNotQueueable: "This step cannot be sent from the queue", errExpired: "The update expired; review the order and redo it",
      errIllegal: "This update is no longer possible for the order's current state", errClosed: "Chat is closed", errGeneric: "Rejected by the server",
      queueFull: "Queue is full; wait until you are back online.", staleLoc: "Your location is not up to date",
    },
    fr: {
      offline: "Pas de connexion Internet", lastSync: "Dernière synchro", never: "Pas encore synchronisé",
      pending: "En attente d'envoi", failed: "Échec de synchro", expired: "Expiré",
      retry: "Réessayer", discard: "Supprimer", syncing: "Synchronisation…", synced: "Synchronisé",
      kChat: "Message", kOnTheWay: "Démarrer la livraison", snapshot: "Dernières données enregistrées", pendingBadge: "En attente — pas encore confirmé par le serveur",
      needOnline: "Cette étape exige une connexion au serveur (vérification/confirmation). Elle n'a PAS été effectuée.",
      acceptUnconfirmed: "Aucune confirmation du serveur ; la commande n'est PAS confirmée comme acceptée. Vérification au retour de la connexion.",
      queued: "Enregistré comme en attente ; envoi au retour de la connexion.",
      errNotQueueable: "Cette étape ne peut pas partir de la file", errExpired: "Mise à jour expirée ; vérifiez la commande et refaites l'action",
      errIllegal: "Cette mise à jour n'est plus possible pour l'état actuel", errClosed: "Chat fermé", errGeneric: "Refusé par le serveur",
      queueFull: "File pleine ; attendez le retour de la connexion.", staleLoc: "Votre position n'est pas à jour",
    },
  };
  function tx() { var l = (typeof lang !== "undefined" && L[lang]) ? lang : "ar"; return L[l]; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fmtTime(ts) {
    if (!ts) return "";
    try { return new Date(ts).toLocaleString((typeof lang !== "undefined" ? lang : "ar") === "ar" ? "ar-MA" : lang, { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }); }
    catch (_e) { return new Date(ts).toISOString().slice(11, 16); }
  }
  function driverKey() { try { return String((me && (me.id || me._id)) || "anon"); } catch (_e) { return "anon"; } }

  /* ---------- queue (storage is per device; entries carry no codes, no tokens) ---------- */
  var queue = SSyncQueue.create({
    storage: window.localStorage,
    storageKey: Q_KEY,
    send: sendEntry,
    onChange: render,
  });

  function sendEntry(e) {
    var p = e.payload || {};
    var call;
    if (e.kind === "chat_text") {
      call = api("/api/driver/orders/" + encodeURIComponent(e.orderId) + "/chat", {
        method: "POST", body: JSON.stringify({ text: p.text, clientId: e.key }),
      });
    } else if (e.kind === "order_on_the_way") {
      call = api("/api/driver/orders/" + encodeURIComponent(e.orderId), {
        method: "PATCH", body: JSON.stringify({ status: "on_the_way", queued: true, queuedAt: e.createdAt, sentAt: Date.now() }),
      });
    } else {
      return Promise.resolve({ ok: false, status: 400, error: "not_queueable", code: "NOT_QUEUEABLE" });
    }
    return call.then(function () { return { ok: true }; }).catch(function (err) {
      return { ok: false, status: err && err.status != null ? err.status : 0, error: err && err.message, code: err && err.data && (err.data.code || err.data.error) };
    });
  }

  /* ---------- connectivity (a failed request / probe, not just the browser's flag) ---------- */
  var down = false, probeT = 0, flushT = 0, lastFlushOk = 0, flushNote = "";

  function setDown(v) {
    if (down === v) return;
    down = v;
    if (typeof setNetDown === "function") setNetDown(v);
    render();
    if (v) startProbe();
    else {
      stopProbe();
      // opened offline with nothing to show (no saved profile): now that the server answers, boot normally
      var dash = document.getElementById("dashScreen");
      if (typeof token !== "undefined" && token && dash && (dash.style.display === "none" || getComputedStyle(dash).display === "none")) { location.reload(); return; }
      reconcile();
    }
  }
  function startProbe() { stopProbe(); probeT = setInterval(probe, PROBE_EVERY); }
  function stopProbe() { clearInterval(probeT); probeT = 0; }
  function probe() {
    if (navigator.onLine === false) return Promise.resolve(false);
    var ctl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, 5000) : 0;
    return fetch("/api/health?_=" + Date.now(), { cache: "no-store", credentials: "omit", signal: ctl ? ctl.signal : undefined })
      .then(function () { clearTimeout(timer); setDown(false); return true; })
      .catch(function () { clearTimeout(timer); return false; });
  }

  /** after reconnecting: first send the queue in order, then reload the truth from the server. */
  function reconcile() {
    flush().then(function () {
      if (typeof token !== "undefined" && token && typeof loadOrders === "function") return loadOrders(true).catch(function () {});
    }).then(function () {
      try { if (typeof CHAT_ORDER_ID !== "undefined" && CHAT_ORDER_ID && typeof loadOrderChat === "function") loadOrderChat().catch(function () {}); } catch (_e) {}
    });
  }
  function flush() {
    if (down || typeof token === "undefined" || !token) return Promise.resolve();
    flushNote = tx().syncing; render();
    return queue.flush().then(function (s) {
      flushNote = s && s.sent ? tx().synced : "";
      if (s && s.stoppedOffline) { /* network still not usable: keep pending */ }
      render();
      setTimeout(function () { if (flushNote === tx().synced) { flushNote = ""; render(); } }, 3000);
    });
  }

  /* ---------- hooks called by driver.js ---------- */
  function onServerAnswered(ok) { if (down) setDown(false); if (ok) queue.markSynced(); }
  function onNetworkFail() { setDown(true); }

  /* active-order snapshot: ONLY active statuses, only the assigned driver's own orders; no codes
     (the server already strips them), cleared on logout / when the order ends / after 12 h. */
  var ACTIVE = ["accepted", "picked_up", "on_the_way"];
  function saveSnapshot(mine) {
    try {
      var act = (mine || []).filter(function (o) { return ACTIVE.indexOf(String(o.status || "")) >= 0; });
      if (!act.length) { localStorage.removeItem(SNAP_KEY); return; }
      localStorage.setItem(SNAP_KEY, JSON.stringify({ driver: driverKey(), savedAt: Date.now(), mine: act }));
    } catch (_e) {}
  }
  function loadSnapshot() {
    try {
      var s = JSON.parse(localStorage.getItem(SNAP_KEY) || "null");
      if (!s || s.driver !== driverKey() || Date.now() - s.savedAt > SNAP_MAX_AGE) { localStorage.removeItem(SNAP_KEY); return null; }
      return s;
    } catch (_e) { return null; }
  }
  /* last known profile (id, name, status, phone) so a reload with no network does not look like a logout or a
     "waiting for approval" screen. The server still enforces approval/suspension on every request. */
  var ME_KEY = "siymon_driver_me_v1";
  function saveMe(m) {
    try { if (m && m.id != null) localStorage.setItem(ME_KEY, JSON.stringify({ id: m.id, name: m.name, status: m.status, phone: m.phone, savedAt: Date.now(), offlineCopy: true })); } catch (_e) {}
  }
  function loadMe() { try { return JSON.parse(localStorage.getItem(ME_KEY) || "null"); } catch (_e) { return null; } }
  var OWNER_KEY = "siymon_driver_sync_owner_v1";
  /* logout wipes the saved delivery details. The queue is NOT dropped silently (a session may simply expire):
     it stays bound to its driver and is cleared only if a DIFFERENT driver logs in on this phone. */
  function reset() { try { localStorage.removeItem(SNAP_KEY); localStorage.removeItem(ME_KEY); } catch (_e) {} render(); }
  function adopt() {
    try {
      var owner = localStorage.getItem(OWNER_KEY), me_ = driverKey();
      if (owner && owner !== me_) queue.clear();
      localStorage.setItem(OWNER_KEY, me_);
    } catch (_e) {}
  }

  function reasonText(e) {
    var c = String(e.error || ""), x = tx();
    if (c === "NOT_QUEUEABLE" || c === "not_queueable") return x.errNotQueueable;
    if (c === "QUEUED_UPDATE_EXPIRED" || c === "expired") return x.errExpired;
    if (c === "ILLEGAL_TRANSITION" || c === "ORDER_CLOSED") return x.errIllegal;
    if (c === "chat_closed") return x.errClosed;
    return e.errorMessage ? x.errGeneric + ": " + e.errorMessage : x.errGeneric;
  }

  /* ---------- UI ---------- */
  var panel = null;
  function ensurePanel() {
    if (panel) return panel;
    var banner = document.getElementById("netBanner");
    panel = document.createElement("div");
    panel.id = "syncPanel";
    panel.className = "sync-panel hidden";
    panel.setAttribute("role", "status");
    panel.setAttribute("aria-live", "polite");
    if (banner && banner.parentNode) banner.parentNode.insertBefore(panel, banner.nextSibling);
    else document.body.insertBefore(panel, document.body.firstChild);
    panel.addEventListener("click", function (ev) {
      var b = ev.target.closest && ev.target.closest("button[data-sq]"); if (!b) return;
      var id = b.getAttribute("data-id");
      if (b.getAttribute("data-sq") === "retry") { queue.retry(id); flush(); }
      else if (b.getAttribute("data-sq") === "discard") queue.discard(id);
    });
    return panel;
  }
  function kindLabel(k) { return k === "chat_text" ? tx().kChat : k === "order_on_the_way" ? tx().kOnTheWay : k; }

  function render() {
    var x = tx();
    var text = document.getElementById("netBannerText");
    var ls = queue.lastSyncAt();
    if (text && down) text.textContent = x.offline + " · " + x.lastSync + ": " + (ls ? fmtTime(ls) : x.never);
    var p = ensurePanel();
    var list = queue.list();
    if (!list.length && !flushNote) { p.classList.add("hidden"); p.innerHTML = ""; return; }
    var html = "";
    if (flushNote) html += '<div class="sq-note">' + esc(flushNote) + "</div>";
    list.forEach(function (e) {
      var st = e.state === "pending" || e.state === "sending" ? x.pending : e.state === "expired" ? x.expired : x.failed;
      var sub = e.state === "failed" || e.state === "expired" ? esc(reasonText(e)) : esc(fmtTime(e.createdAt));
      var preview = e.kind === "chat_text" ? " — " + esc(String((e.payload && e.payload.text) || "").slice(0, 40)) : "";
      html += '<div class="sq-row ' + e.state + '"><div class="sq-main"><b>#' + esc(e.orderId) + "</b> · " + esc(kindLabel(e.kind)) + preview +
        '<div class="sq-sub">' + esc(st) + " · " + sub + "</div></div><div class=\"sq-act\">" +
        (e.state === "failed" ? '<button type="button" class="btn small" data-sq="retry" data-id="' + esc(e.id) + '">' + esc(x.retry) + "</button>" : "") +
        '<button type="button" class="btn small ghost" data-sq="discard" data-id="' + esc(e.id) + '">' + esc(x.discard) + "</button></div></div>";
    });
    p.innerHTML = html;
    p.classList.remove("hidden");
  }

  /* chat: pending bubbles under the real messages (never mixed up with confirmed ones) */
  function decorateChat(orderId) {
    var box = document.getElementById("orderChatBox"); if (!box) return;
    var x = tx();
    box.querySelectorAll(".chat-msg.pending-local").forEach(function (n) { n.remove(); });
    var empty = box.querySelector(".empty, .empty-state"); if (empty && queue.list(orderId).length) empty.remove();
    queue.list(orderId).filter(function (e) { return e.kind === "chat_text"; }).forEach(function (e) {
      var d = document.createElement("div");
      d.className = "chat-msg me pending-local";
      d.innerHTML = '<div class="chat-bubble">' + esc(e.payload.text) + '</div><div class="chat-meta">' +
        esc(e.state === "failed" || e.state === "expired" ? x.failed : x.pendingBadge) + "</div>";
      box.appendChild(d);
    });
    box.scrollTop = box.scrollHeight + 9999;
  }
  queue.subscribe(function () {
    try { if (typeof CHAT_ORDER_ID !== "undefined" && CHAT_ORDER_ID) decorateChat(CHAT_ORDER_ID); } catch (_e) {}
    try { if (typeof renderOrders === "function" && typeof lastOrders !== "undefined") renderOrders(); } catch (_e) {} // pending badges
  });

  /* ---------- actions used by driver.js ---------- */
  function queueChat(orderId, text, clientId) {
    // same key as the attempt that got no answer: if the server did store it, the replay is recognised, not duplicated
    var r = queue.enqueue("chat_text", orderId, { text: String(text || "").slice(0, 1200) }, clientId);
    if (!r.ok) return { ok: false, message: r.error === "queue_full" ? tx().queueFull : tx().needOnline };
    decorateChat(orderId);
    return { ok: true, message: tx().queued };
  }
  function queueOnTheWay(orderId) {
    // one pending "start delivery" per order is enough (the server would treat the repeat as a no-op anyway)
    var dup = queue.list(orderId).some(function (e) { return e.kind === "order_on_the_way" && (e.state === "pending" || e.state === "sending"); });
    if (dup) return { ok: true, message: tx().queued };
    var r = queue.enqueue("order_on_the_way", orderId, {});
    if (!r.ok) return { ok: false, message: r.error === "queue_full" ? tx().queueFull : tx().needOnline };
    return { ok: true, message: tx().queued };
  }
  function hasPending(orderId, kind) {
    return queue.list(orderId).some(function (e) { return (!kind || e.kind === kind) && (e.state === "pending" || e.state === "sending"); });
  }

  window.addEventListener("online", function () { probe(); });
  window.addEventListener("offline", function () { setDown(true); });
  document.addEventListener("visibilitychange", function () { if (!document.hidden) { if (down) probe(); else flush(); } });
  flushT = setInterval(function () { if (!down && queue.counts().pending) flush(); }, FLUSH_EVERY);
  document.addEventListener("DOMContentLoaded", render);

  window.SiymonOffline = {
    queue: queue, isDown: function () { return down; },
    onServerAnswered: onServerAnswered, onNetworkFail: onNetworkFail,
    saveSnapshot: saveSnapshot, loadSnapshot: loadSnapshot, saveMe: saveMe, loadMe: loadMe, reset: reset, adopt: adopt,
    queueChat: queueChat, queueOnTheWay: queueOnTheWay, hasPending: hasPending, decorateChat: decorateChat,
    flush: flush, probe: probe, text: tx,
  };
  render();
})();

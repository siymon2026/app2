/* Auto-refresh scheduler for the admin dashboard (pure logic, unit-tested in tests/admin-refresh.test.js).
 *
 * Why it exists: the old code created one setInterval at the END of a chain of awaited loaders, so
 *  - if any loader hung or threw, the timer was never created and the page never refreshed itself again;
 *  - ticks could overlap on a slow network (older responses overwriting newer data);
 *  - the manual Refresh button only reloaded orders and never touched the timer;
 *  - nothing resumed the loop after the tab/PWA came back from the background.
 *
 * This scheduler chains setTimeout (no overlap), never dies on a tick error (backs off, then keeps going),
 * lets the manual refresh join an in-flight tick instead of racing it, and resumes on demand. */
(function (root) {
  "use strict";

  function create(opts) {
    var tick = opts.tick;
    var interval = opts.intervalMs || 5000;
    var maxBackoff = opts.maxBackoffMs || 30000;
    var now = opts.now || function () { return Date.now(); };
    var setT = opts.setTimer || function (fn, ms) { return setTimeout(fn, ms); };
    var clearT = opts.clearTimer || function (id) { clearTimeout(id); };

    var running = false;   // loop armed
    var timer = null;
    var gen = 0;           // bumped on stop/start so stale ticks never re-arm the loop
    var inflight = null;   // Promise of the tick currently executing
    var failures = 0;
    var lastStart = 0, lastOk = 0, lastError = null;

    function delay() {
      if (!failures) return interval;
      return Math.min(maxBackoff, interval * Math.pow(2, Math.min(failures, 5)));
    }
    function arm() {
      if (!running) return;
      if (timer) { clearT(timer); timer = null; }
      var g = gen;
      timer = setT(function () { timer = null; if (running && g === gen) run({ manual: false, full: false }); }, delay());
    }

    function run(info) {
      info = info || {};
      if (inflight) {
        // join the tick already running; a manual/full request is replayed right after it so it is never lost
        if (info.manual || info.full) {
          var again = info;
          return inflight.then(function () { return run(again); });
        }
        return inflight;
      }
      var g = gen;
      lastStart = now();
      var p;
      try { p = Promise.resolve(tick(info)); } catch (e) { p = Promise.reject(e); }
      inflight = p.then(function () { failures = 0; lastOk = now(); lastError = null; return true; },
        function (e) { failures++; lastError = e; return false; })
        .then(function (ok) {
          inflight = null;
          if (running && g === gen) arm();
          return ok;
        });
      return inflight;
    }

    return {
      /** Arm the loop (idempotent). Does not run immediately unless {immediate:true}. */
      start: function (o) {
        gen++; running = true; failures = 0;
        if (timer) { clearT(timer); timer = null; }
        if (o && o.immediate) return run({ manual: false, full: !!o.full });
        arm();
        return Promise.resolve(true);
      },
      stop: function () { running = false; gen++; if (timer) { clearT(timer); timer = null; } },
      /** Manual refresh: runs now (joining/replaying around an in-flight tick), then the loop continues. */
      refreshNow: function (o) {
        o = o || {};
        var wasRunning = running;
        var r = run({ manual: o.manual !== false, full: o.full !== false });
        if (wasRunning && !timer) { /* arm() happens when the tick settles */ }
        return r;
      },
      /** Called when the page becomes visible / online / restored from bfcache. Refreshes at once if stale or dead. */
      resume: function (o) {
        if (!running) return Promise.resolve(false);
        var stale = now() - lastStart >= interval;
        if (!timer && !inflight) { stale = true; }   // loop lost its timer (should not happen) -> repair
        if (!stale) return Promise.resolve(true);
        if (timer) { clearT(timer); timer = null; }
        return run({ manual: false, full: !!(o && o.full) });
      },
      isRunning: function () { return running; },
      state: function () { return { running: running, hasTimer: !!timer, inflight: !!inflight, failures: failures, lastOk: lastOk, lastError: lastError }; },
    };
  }

  var api = { create: create };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.AdminRefresh = api;
})(typeof window !== "undefined" ? window : globalThis);

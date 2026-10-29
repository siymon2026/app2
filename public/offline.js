/* siymon — one shared "no internet" screen for the whole app (window.SOffline).
   - Detects loss of connection for real: the browser's online/offline events are only a hint; the
     screen appears only after the server itself could not be reached (probe of /api/health), twice,
     so a slow network, a page change or one failed request never makes it flash.
   - It is an overlay, not a navigation: the page underneath (and the cart) is untouched, so when the
     connection returns the user is exactly where they were.
   - A problem with one request only (HTTP error, one order) never triggers it: only "can't reach the server". */
(function () {
  "use strict";
  if (window.SOffline) return;

  var PROBE = "/api/health";
  var MIN_VISIBLE = 700;      /* ms: never blink */
  var CONFIRM_DELAY = 1200;   /* ms between the two probes that confirm an outage */
  var RECHECK_EVERY = 4000;   /* ms: automatic retry while the screen is up */
  var lang = "ar";
  try { var l = localStorage.getItem("siymon_lang_v1"); if (l === "en" || l === "fr") lang = l; } catch (_e) {}

  var T = {
    ar: { title: "لا يوجد اتصال بالإنترنت", hint: "يرجى التحقق من اتصالك بالإنترنت", last: "آخر مزامنة", never: "لم تتم مزامنة بعد", retry: "إعادة المحاولة", checking: "جارٍ التحقق…", still: "لا يزال الاتصال غير متاح. حاول مرة أخرى.", back: "عاد الاتصال" },
    en: { title: "No internet connection", hint: "Please check your internet connection", last: "Last sync", never: "Not synced yet", retry: "Try again", checking: "Checking…", still: "Still offline. Please try again.", back: "Back online" },
    fr: { title: "Pas de connexion Internet", hint: "Veuillez vérifier votre connexion Internet", last: "Dernière synchro", never: "Pas encore synchronisé", retry: "Réessayer", checking: "Vérification…", still: "Toujours hors ligne. Réessayez.", back: "De nouveau en ligne" }
  }[lang];

  /* section 20: time of the last request our server really answered with success (shown while offline). */
  var SYNC_KEY = "siymon_last_sync_v1";
  function lastSync() { try { return Number(localStorage.getItem(SYNC_KEY)) || 0; } catch (_e) { return 0; } }
  function noteSync() { try { localStorage.setItem(SYNC_KEY, String(Date.now())); } catch (_e) {} }
  function lastSyncText() {
    var ts = lastSync();
    if (!ts) return T.last + ": " + T.never;
    var s;
    try { s = new Date(ts).toLocaleString(lang === "ar" ? "ar-MA" : lang, { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }); }
    catch (_e) { s = new Date(ts).toISOString().slice(11, 16); }
    return T.last + ": " + s;
  }

  var rawFetch = window.fetch ? window.fetch.bind(window) : null;
  var root = null, btn = null, msg = null;
  var shown = false, shownAt = 0, streak = 0, inflight = null, confirmT = 0, autoT = 0, hideT = 0, leaving = false, busy = false;

  /* 'up' = the server answered (any HTTP status) · 'down' = can't reach it · 'slow' = no answer in time */
  function probe(timeoutMs) {
    if (!rawFetch) return Promise.resolve("up");
    if (navigator.onLine === false) return Promise.resolve("down");
    var ctl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, timeoutMs || 5000) : 0;
    return rawFetch(PROBE + "?_=" + Date.now(), { cache: "no-store", credentials: "omit", signal: ctl ? ctl.signal : undefined })
      .then(function () { clearTimeout(timer); return "up"; })
      .catch(function (e) { clearTimeout(timer); return e && e.name === "AbortError" ? "slow" : "down"; });
  }

  var ART = '<svg class="so-art" viewBox="0 0 320 230" role="img" aria-hidden="true" focusable="false">' +
    '<path class="blob" d="M62 150c-8-46 26-86 76-92 40-5 58 14 92 10 38-4 62 30 56 66-6 36-40 58-90 60-52 2-124-2-134-44Z"/>' +
    '<path class="cloud" d="M40 52a16 16 0 0 1 30-6 13 13 0 0 1 22 6 11 11 0 0 1-4 0H42a10 10 0 0 1-2 0Z"/>' +
    '<path class="cloud" d="M236 34a13 13 0 0 1 24-5 11 11 0 0 1 18 5H236Z"/>' +
    '<ellipse cx="160" cy="205" rx="118" ry="9" class="blob"/>' +
    '<g class="bob">' +
      '<g fill="none" stroke-width="6" stroke-linecap="round">' +
        '<path class="ink" d="M196 78a46 46 0 0 1 64 0"/><path class="ink" d="M208 92a29 29 0 0 1 40 0"/>' +
      '</g>' +
      '<circle cx="228" cy="106" r="5" class="inkf"/>' +
      '<circle cx="262" cy="64" r="17" class="gf"/><path d="m255.5 57.5 13 13m0-13-13 13" stroke="#0F0F0F" stroke-width="4.5" stroke-linecap="round" fill="none"/>' +
      '<g class="ink" stroke-width="5" stroke-linecap="round"><path d="M188 150 176 112"/><path d="M270 150l12-38"/></g>' +
      '<rect x="168" y="148" width="126" height="40" rx="12" class="inkf"/>' +
      '<circle cx="188" cy="168" r="4.5" class="gf"/><circle cx="204" cy="168" r="4.5" class="gf"/><circle cx="220" cy="168" r="4.5" class="gf" opacity=".45"/>' +
      '<rect x="240" y="162" width="40" height="11" rx="5.5" class="gf"/>' +
    '</g>' +
    '<path class="ink" fill="none" stroke-width="6" stroke-linecap="round" d="M170 176c-34 6-40 26-62 22-18-3-26-18-46-14"/>' +
    '<g transform="rotate(-18 54 184)">' +
      '<rect x="28" y="168" width="40" height="32" rx="9" class="inkf"/>' +
      '<rect x="14" y="176" width="16" height="5" rx="2.5" class="inkf"/><rect x="14" y="187" width="16" height="5" rx="2.5" class="inkf"/>' +
      '<rect x="68" y="175" width="9" height="18" rx="4" class="gf"/>' +
    '</g>' +
    '<g class="spark" fill="none" stroke-width="5" stroke-linecap="round"><path class="gs" d="M28 150l-10-8"/><path class="gs" d="M46 140l-2-13"/><path class="gs" d="M12 168l-10 1"/></g>' +
  '</svg>';

  function build() {
    if (root) return;
    root = document.createElement("div");
    root.className = "so-root";
    root.setAttribute("role", "alertdialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "soTitle");
    root.setAttribute("aria-describedby", "soHint");
    root.dir = lang === "ar" ? "rtl" : "ltr";
    root.innerHTML = ART + '<h1 class="so-title" id="soTitle"></h1><p class="so-hint" id="soHint"></p><p class="so-last" id="soLast"></p>' +
      '<button type="button" class="so-btn"><span class="so-spin" aria-hidden="true"></span><span class="so-lbl"></span></button>' +
      '<p class="so-msg" role="status" aria-live="polite"></p>';
    root.querySelector(".so-title").textContent = T.title;
    root.querySelector(".so-hint").textContent = T.hint;
    root.querySelector(".so-lbl").textContent = T.retry;
    btn = root.querySelector(".so-btn");
    msg = root.querySelector(".so-msg");
    btn.addEventListener("click", retry);
    document.body.appendChild(root);
  }

  function show() {
    if (shown) return;
    build();
    shown = true; shownAt = Date.now();
    msg.textContent = ""; msg.className = "so-msg";
    var lastEl = root.querySelector(".so-last"); if (lastEl) lastEl.textContent = lastSyncText();
    document.body.classList.add("so-lock");
    root.classList.add("on");
    root.removeAttribute("aria-hidden");
    root.tabIndex = -1; root.style.outline = "none";
    try { root.focus({ preventScroll: true }); } catch (_e) {}
    clearInterval(autoT);
    autoT = setInterval(function () { if (!busy) check(); }, RECHECK_EVERY);
  }

  function hide() {
    if (!shown) return;
    var rest = MIN_VISIBLE - (Date.now() - shownAt);
    if (rest > 0) { clearTimeout(hideT); hideT = setTimeout(hide, rest); return; }
    shown = false;
    clearInterval(autoT);
    root.classList.remove("on");
    root.setAttribute("aria-hidden", "true");
    document.body.classList.remove("so-lock");
    /* tell the pages: reload what failed. The page itself was never replaced. */
    try { window.dispatchEvent(new CustomEvent("siymon:online")); } catch (_e) {}
  }

  function handle(r) {
    if (r === "up" || (r === "slow" && navigator.onLine !== false)) {
      streak = 0; clearTimeout(confirmT);
      if (shown) hide();
      return;
    }
    streak++;
    if (shown) return;
    if (streak >= 2) { show(); return; }
    clearTimeout(confirmT);
    confirmT = setTimeout(check, CONFIRM_DELAY);
  }

  function check() {
    if (inflight) return inflight;
    inflight = probe(5000).then(function (r) { inflight = null; handle(r); return r; });
    return inflight;
  }

  function retry() {
    if (busy) return;
    busy = true;
    btn.disabled = true; btn.classList.add("busy");
    btn.querySelector(".so-lbl").textContent = T.checking;
    msg.textContent = ""; msg.className = "so-msg";
    probe(7000).then(function (r) {
      busy = false;
      btn.disabled = false; btn.classList.remove("busy");
      btn.querySelector(".so-lbl").textContent = T.retry;
      if (r === "up") { streak = 0; hide(); return; }
      msg.textContent = T.still; msg.className = "so-msg err";
      root.classList.remove("shake"); void root.offsetWidth; root.classList.add("shake");
      try { btn.focus({ preventScroll: true }); } catch (_e) {}
    });
  }

  /* a failed request to our own server is a hint → verify, don't trust it */
  function ownUrl(u) {
    try { return new URL(u, location.href).origin === location.origin; } catch (_e) { return false; }
  }
  if (rawFetch) {
    window.fetch = function (input) {
      var p = rawFetch.apply(window, arguments);
      var u0 = typeof input === "string" ? input : (input && input.url) || "";
      p.then(function (r) { if (r && r.ok && ownUrl(u0)) noteSync(); }, function () {});
      p.catch(function (e) {
        if (leaving || document.hidden || !e || e.name === "AbortError") return;
        var url = typeof input === "string" ? input : (input && input.url) || "";
        if (e instanceof TypeError && ownUrl(url)) { clearTimeout(confirmT); confirmT = setTimeout(check, 400); }
      });
      return p;
    };
  }

  window.addEventListener("offline", function () { clearTimeout(confirmT); confirmT = setTimeout(check, 600); });
  window.addEventListener("online", function () { check(); });
  document.addEventListener("visibilitychange", function () { if (!document.hidden) leaving = false; if (!document.hidden && (shown || navigator.onLine === false)) check(); });
  window.addEventListener("beforeunload", function () { leaving = true; });
  window.addEventListener("pagehide", function () { leaving = true; });
  window.addEventListener("pageshow", function (e) { leaving = false; if (e.persisted) check(); });
  if (navigator.onLine === false) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { check(); });
    else check();
  }

  window.SOffline = { check: check, isOffline: function () { return shown; }, lastSyncAt: lastSync };
})();

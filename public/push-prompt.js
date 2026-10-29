/* siymon — Web Push helper + the "enable notifications" sheet (window.SPush).

   Platform: this is a responsive PWA using standard Web Push (service worker + VAPID).
   The subscription is saved on the server for the signed-in customer, so:
     - the sheet is only offered to signed-in customers, on supported + secure (HTTPS) browsers,
       when the server really has push configured, and the permission is still undecided ("default");
     - the browser's own permission dialog is opened ONLY after the person taps «تفعيل الإشعارات»;
     - "later" snoozes it (7 days, then 30 days, then never again); a refusal is never asked again;
     - "enabled" is only claimed after the server accepted the subscription.
   Needs notif-logic.js (SNotif.promptDecision). */
(function () {
  "use strict";
  if (window.SPush) return;

  var TOKEN_KEY = "siymon_customer_token_v1";
  var POLICY_KEY = "siymon_push_prompt_v1";
  var lang = "ar";
  try { var l = localStorage.getItem("siymon_lang_v1"); if (l === "en" || l === "fr") lang = l; } catch (_e) {}

  var T = {
    ar: {
      title: "ابقَ على اطلاع بكل جديد",
      desc: "تابع تحديثات طلباتك، وحالة التوصيل، والعروض المهمة مباشرة",
      enable: "تفعيل الإشعارات", later: "لاحقًا", ok: "حسنًا",
      working: "جارٍ التفعيل…",
      done: "تم تفعيل الإشعارات ✅",
      denied: "لم يتم السماح بالإشعارات. يمكنك تفعيلها لاحقًا من إعدادات المتصفح.",
      server: "تعذّر تفعيل الإشعارات الآن. حاول مرة أخرى بعد قليل.",
      unsupported: "الإشعارات غير مدعومة في هذا المتصفح.",
      insecure: "الإشعارات تتطلب اتصالًا آمنًا (HTTPS).",
      notConfigured: "خدمة الإشعارات غير مفعّلة حاليًا.",
      ios: "على iPhone: أضف التطبيق إلى الشاشة الرئيسية أولًا ثم فعّل الإشعارات.",
    },
    en: {
      title: "Stay in the loop",
      desc: "Follow your order updates, delivery status and important offers as they happen",
      enable: "Enable notifications", later: "Later", ok: "OK",
      working: "Enabling…",
      done: "Notifications enabled ✅",
      denied: "Notifications weren’t allowed. You can enable them later in your browser settings.",
      server: "Couldn’t enable notifications right now. Please try again shortly.",
      unsupported: "Notifications aren’t supported in this browser.",
      insecure: "Notifications require a secure connection (HTTPS).",
      notConfigured: "Notifications aren’t available right now.",
      ios: "On iPhone: add the app to your Home Screen first, then enable notifications.",
    },
    fr: {
      title: "Restez informé",
      desc: "Suivez vos commandes, l’état de la livraison et les offres importantes en direct",
      enable: "Activer les notifications", later: "Plus tard", ok: "OK",
      working: "Activation…",
      done: "Notifications activées ✅",
      denied: "Les notifications n’ont pas été autorisées. Vous pourrez les activer dans les réglages du navigateur.",
      server: "Impossible d’activer les notifications pour le moment. Réessayez dans un instant.",
      unsupported: "Les notifications ne sont pas prises en charge par ce navigateur.",
      insecure: "Les notifications nécessitent une connexion sécurisée (HTTPS).",
      notConfigured: "Les notifications ne sont pas disponibles pour le moment.",
      ios: "Sur iPhone : ajoutez d’abord l’app à l’écran d’accueil, puis activez les notifications.",
    },
  }[lang];

  /* ---------------- environment ---------------- */
  var token = function () { try { return localStorage.getItem(TOKEN_KEY) || ""; } catch (_e) { return ""; } };
  var secure = function () { return location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1"; };
  var supported = function () { return "Notification" in window && "serviceWorker" in navigator && "PushManager" in window; };
  var permission = function () { return "Notification" in window ? Notification.permission : "unsupported"; };
  var isIOS = function () { return /iphone|ipad|ipod/i.test(navigator.userAgent || ""); };

  var cfg = null;
  function loadConfig() {
    if (cfg) return Promise.resolve(cfg);
    return fetch("/api/public-config").then(function (r) { return r.json(); }).then(function (d) {
      cfg = { enabled: !!(d && d.webPushEnabled && d.webPushPublicKey), key: String((d && d.webPushPublicKey) || "").trim() };
      return cfg;
    }).catch(function () { return { enabled: false, key: "" }; });
  }

  function b64ToBytes(s) {
    var pad = "=".repeat((4 - (s.length % 4)) % 4);
    var raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  function registration() {
    if (!("serviceWorker" in navigator)) return Promise.resolve(null);
    return navigator.serviceWorker.getRegistration().then(function (r) {
      return r || navigator.serviceWorker.register("/sw.js");
    }).then(function (r) {
      /* the service worker must really be active before we subscribe */
      return Promise.race([navigator.serviceWorker.ready, new Promise(function (res) { setTimeout(res, 8000, null); })]).then(function (rr) { return rr || r; });
    }).catch(function () { return null; });
  }

  function api(path, body) {
    return fetch(path, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token() }, body: JSON.stringify(body) })
      .then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json().catch(function () { return {}; }); });
  }

  /** What can this device do right now?
   *  state: "unavailable" (server has no push) | "insecure" | "unsupported" | "denied" | "on" | "off" */
  function status() {
    return loadConfig().then(function (c) {
      if (!c.enabled) return { state: "unavailable" };
      if (!secure()) return { state: "insecure" };
      if (!supported()) return { state: "unsupported", ios: isIOS() };
      if (permission() === "denied") return { state: "denied" };
      return registration().then(function (reg) {
        if (!reg) return { state: "unsupported" };
        return reg.pushManager.getSubscription().then(function (sub) { return { state: sub && permission() === "granted" ? "on" : "off" }; });
      });
    });
  }

  function fail(code) { var e = new Error(code); e.code = code; return e; }

  /** Must be called from a tap. Resolves only once the SERVER has accepted the subscription. */
  function enable() {
    return loadConfig().then(function (c) {
      if (!c.enabled) throw fail("unavailable");
      if (!secure()) throw fail("insecure");
      if (!supported()) throw fail("unsupported");
      /* requestPermission first, straight from the tap */
      return Notification.requestPermission().then(function (perm) {
        if (perm === "denied") throw fail("denied");
        if (perm !== "granted") throw fail("dismissed");
        return registration();
      }).then(function (reg) {
        if (!reg) throw fail("unsupported");
        return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(c.key) }).catch(function () { throw fail("server"); });
      }).then(function (sub) {
        return api("/api/customer/push/subscribe", { subscription: sub.toJSON ? sub.toJSON() : sub }).then(function () { return sub; }, function () {
          return sub.unsubscribe().catch(function () {}).then(function () { throw fail("server"); }); /* no half-enabled state */
        });
      });
    });
  }

  function disable() {
    return registration().then(function (reg) {
      if (!reg) return;
      return reg.pushManager.getSubscription().then(function (sub) {
        if (!sub) return;
        return api("/api/customer/push/unsubscribe", { endpoint: sub.endpoint }).catch(function () {}).then(function () { return sub.unsubscribe().catch(function () {}); });
      });
    });
  }

  /** Human text for a failed/unavailable state (never a dead button). */
  function explain(code) {
    if (code === "denied") return T.denied;
    if (code === "insecure") return T.insecure;
    if (code === "unavailable") return T.notConfigured;
    if (code === "unsupported") return T.unsupported + (isIOS() ? " " + T.ios : "");
    if (code === "dismissed") return "";
    return T.server;
  }

  /* ---------------- "later" policy (stored on this device) ---------------- */
  function policy() { try { return JSON.parse(localStorage.getItem(POLICY_KEY) || "{}") || {}; } catch (_e) { return {}; } }
  function dismissed() {
    var p = policy();
    try { localStorage.setItem(POLICY_KEY, JSON.stringify({ dismissCount: Number(p.dismissCount || 0) + 1, lastDismissAt: Date.now() })); } catch (_e) {}
  }

  /* ---------------- the sheet ---------------- */
  var ART = '<svg class="np-art" viewBox="0 0 220 170" aria-hidden="true" focusable="false">' +
    '<circle cx="110" cy="92" r="70" class="soft"/>' +
    '<rect x="68" y="14" width="84" height="142" rx="16" fill="none" class="dev" stroke-width="5"/>' +
    '<rect x="94" y="14" width="32" height="9" rx="4.5" class="devf"/>' +
    '<rect x="44" y="46" width="132" height="34" rx="11" class="gf"/>' +
    '<rect x="58" y="55" width="62" height="6" rx="3" fill="#0F0F0F" opacity=".85"/><rect x="58" y="66" width="92" height="6" rx="3" fill="#0F0F0F" opacity=".5"/>' +
    '<rect x="82" y="104" width="56" height="5" rx="2.5" class="line"/><rect x="82" y="118" width="40" height="5" rx="2.5" class="line"/>' +
    '<circle cx="158" cy="118" r="26" class="gf"/>' +
    '<g class="bell"><path d="M158 103a11 11 0 0 0-11 11v7l-3.5 5h29l-3.5-5v-7a11 11 0 0 0-11-11Z" fill="#0F0F0F"/><path d="M153 132a5 5 0 0 0 10 0Z" fill="#0F0F0F"/></g>' +
  '</svg>';

  var root = null, lastFocus = null, sheetOpen = false;
  function close() {
    if (!root) return;
    root.classList.remove("on");
    sheetOpen = false;
    document.removeEventListener("keydown", onKey, true);
    var r = root; root = null;
    setTimeout(function () { r.remove(); }, 320);
    try { if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); } catch (_e) {}
  }
  function onKey(e) { if (e.key === "Escape") { e.stopPropagation(); later(); } }
  function later() { dismissed(); close(); }

  function showSheet() {
    if (sheetOpen) return;
    sheetOpen = true;
    lastFocus = document.activeElement;
    root = document.createElement("div");
    root.className = "np-root";
    root.dir = lang === "ar" ? "rtl" : "ltr";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "npTitle");
    root.innerHTML = '<div class="np-backdrop"></div><div class="np-sheet"><div class="np-handle" aria-hidden="true"></div>' + ART +
      '<h2 class="np-title" id="npTitle"></h2><p class="np-desc"></p>' +
      '<button type="button" class="np-primary"><span class="np-spin" aria-hidden="true"></span><span class="np-lbl"></span></button>' +
      '<button type="button" class="np-later"></button><p class="np-msg" role="status" aria-live="polite"></p></div>';
    root.querySelector(".np-title").textContent = T.title;
    root.querySelector(".np-desc").textContent = T.desc;
    var primary = root.querySelector(".np-primary"), lbl = root.querySelector(".np-lbl");
    var laterBtn = root.querySelector(".np-later"), msg = root.querySelector(".np-msg");
    lbl.textContent = T.enable; laterBtn.textContent = T.later;
    document.body.appendChild(root);
    requestAnimationFrame(function () { root.classList.add("on"); });
    document.addEventListener("keydown", onKey, true);
    var sheetEl = root.querySelector(".np-sheet"); sheetEl.tabIndex = -1; sheetEl.style.outline = "none";
    try { sheetEl.focus({ preventScroll: true }); } catch (_e) {} /* keyboard users tab to the buttons; no ring on first show */

    root.querySelector(".np-backdrop").addEventListener("click", later);
    laterBtn.addEventListener("click", later);
    primary.addEventListener("click", function () {
      if (primary.dataset.mode === "close") { close(); return; }
      primary.disabled = true; primary.classList.add("busy"); lbl.textContent = T.working; msg.textContent = ""; msg.className = "np-msg";
      enable().then(function () {
        root.classList.add("np-ok");
        primary.classList.remove("busy"); lbl.textContent = T.done; laterBtn.hidden = true;
        window.dispatchEvent(new CustomEvent("siymon:push-changed"));
        setTimeout(close, 1500);
      }).catch(function (e) {
        var code = (e && e.code) || "server";
        primary.disabled = false; primary.classList.remove("busy");
        if (code === "dismissed") { later(); return; }           /* closed the browser dialog: same as "later" */
        msg.textContent = explain(code); msg.className = "np-msg err";
        if (code === "denied" || code === "unsupported" || code === "insecure" || code === "unavailable") {
          primary.dataset.mode = "close"; lbl.textContent = T.ok; laterBtn.hidden = true; /* no retry loop */
        } else lbl.textContent = T.enable;
      });
    });
  }

  /** Offer the sheet if (and only if) the policy says so. opts.delay = ms to wait first. */
  function maybePrompt(opts) {
    opts = opts || {};
    if (!window.SNotif || !token()) return Promise.resolve("no:login");
    return Promise.all([loadConfig(), status()]).then(function (r) {
      var p = policy();
      var dec = window.SNotif.promptDecision({
        loggedIn: !!token(), configured: r[0].enabled, secure: secure(), supported: supported(), permission: permission(),
        subscribed: r[1].state === "on", dismissCount: p.dismissCount, lastDismissAt: p.lastDismissAt,
      }, Date.now());
      if (dec !== "show") return dec;
      return new Promise(function (resolve) {
        var tries = 0;
        function attempt() {
          /* don't interrupt: another dialog/sheet is open, the page is in the background, or we're offline */
          var busy = document.hidden || document.querySelector(".so-root.on, .np-root, .sheet:not([hidden]), .modal.show");
          if (busy && tries++ < 12) { setTimeout(attempt, 5000); return; }
          if (busy) { resolve("no:busy"); return; }
          showSheet(); resolve("show");
        }
        setTimeout(attempt, opts.delay == null ? 6000 : opts.delay);
      });
    }).catch(function () { return "no:error"; });
  }

  window.SPush = { status: status, enable: enable, disable: disable, explain: explain, maybePrompt: maybePrompt, showSheet: showSheet };

  var s = document.currentScript;
  if (s && s.dataset && s.dataset.auto != null) {
    var run = function () { maybePrompt({ delay: Number(s.dataset.delay || 6000) }); };
    if (document.readyState === "complete") run(); else window.addEventListener("load", run);
  }
})();

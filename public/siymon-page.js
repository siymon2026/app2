/* siymon — shared helpers for standalone pages (notifications, chat, orders).
   Exposes a single global: window.SP. Safe to load on any page.
   - theme / language from the same localStorage keys the rest of the app uses
   - api() with the customer token
   - history-aware back button: any element with [data-back] goes back to the
     previous page of the app; if there is none (opened from a push, a fresh
     tab, after a reload on Android PWA) it falls back to its own href ("/"). */
(function () {
  "use strict";

  var TOKEN_KEY = "siymon_customer_token_v1";
  var PROFILE_KEY = "siymon_customer_profile_v1";
  var THEME_KEY = "siymon_theme_v3";
  var LANG_KEY = "siymon_lang_v1";
  var LANGS = ["ar", "en", "fr"];
  var DIRS = { ar: "rtl", en: "ltr", fr: "ltr" };

  function read(k) {
    try {
      return localStorage.getItem(k);
    } catch (_e) {
      return null;
    }
  }

  var lang = read(LANG_KEY);
  if (LANGS.indexOf(lang) < 0) lang = "ar";

  function applyTheme() {
    var th = read(THEME_KEY) || "dark";
    var root = document.documentElement;
    if (th === "dark") root.setAttribute("data-theme", "dark");
    else root.removeAttribute("data-theme");
  }

  function applyLang() {
    document.documentElement.lang = lang;
    document.documentElement.dir = DIRS[lang] || "rtl";
  }

  /** Pick the string table for the current language (falls back to Arabic). */
  function pick(dict) {
    return dict[lang] || dict.ar;
  }

  function getToken() {
    return read(TOKEN_KEY) || "";
  }

  function clearSession() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(PROFILE_KEY);
    } catch (_e) {}
  }

  /** Send the visitor to sign in, then bring them straight back here. */
  function toLogin() {
    var next = location.pathname + location.search;
    location.replace("/orders/?next=" + encodeURIComponent(next));
  }

  async function api(path, opts) {
    opts = opts || {};
    var headers = Object.assign(
      { "Content-Type": "application/json" },
      opts.headers || {},
    );
    var token = getToken();
    if (token) headers.Authorization = "Bearer " + token;

    var res = await fetch(path, Object.assign({}, opts, { headers: headers }));
    var data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok) {
      var err = new Error((data && data.error) || "Request failed");
      err.status = res.status;
      throw err;
    }
    return data;
  }

  async function loadPublicConfig() {
    try {
      var res = await fetch("/api/public-config");
      var data = await res.json().catch(function () {
        return null;
      });
      if (data && typeof data === "object") return data;
    } catch (_e) {}
    return {};
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      }[c];
    });
  }

  function formatDate(iso) {
    try {
      var d = new Date(iso);
      if (Number.isNaN(d.getTime())) return String(iso || "");
      return d.toLocaleString(undefined, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (_e) {
      return String(iso || "");
    }
  }

  /* ---------- back navigation ---------- */
  function canGoBack() {
    if (history.length < 2) return false;
    try {
      return (
        !!document.referrer &&
        new URL(document.referrer).origin === location.origin
      );
    } catch (_e) {
      return false;
    }
  }

  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest("[data-back]");
    if (!a) return;
    if (canGoBack()) {
      e.preventDefault();
      history.back();
    }
    /* otherwise the element's own href ("/") is followed */
  });

  /* a page restored from the back/forward cache must not show stale chat/notification data */
  window.addEventListener("pageshow", function (e) {
    if (e.persisted) window.dispatchEvent(new Event("siymon:revive"));
  });

  applyTheme();
  applyLang();

  window.SP = {
    get lang() {
      return lang;
    },
    pick: pick,
    getToken: getToken,
    clearSession: clearSession,
    toLogin: toLogin,
    api: api,
    loadPublicConfig: loadPublicConfig,
    esc: esc,
    formatDate: formatDate,
    canGoBack: canGoBack,
  };
})();

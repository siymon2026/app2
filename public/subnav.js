/* siymon — pinned bottom bar for sub-pages (orders, notifications, chat).
   Same 5 tabs / icons / look as the home page. Set <body data-nav="home|bell|store|cart|user">. */
(function () {
  "use strict";
  var TOKEN_KEY = "siymon_customer_token_v1", CART_KEY = "siymon_cart_v5", LANG_KEY = "siymon_lang_v1";
  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  var lang = ls(LANG_KEY); if (["ar", "en", "fr"].indexOf(lang) < 0) lang = "ar";
  var L = {
    ar: { home: "الرئيسية", bell: "الإشعارات", store: "المتاجر", cart: "السلة", user: "حسابي" },
    en: { home: "Home", bell: "Notifications", store: "Stores", cart: "Cart", user: "Profile" },
    fr: { home: "Accueil", bell: "Notifications", store: "Magasins", cart: "Panier", user: "Profil" }
  }[lang];
  var ICON = {
    home: '<path class="fl" d="M4 11.2 12 4l8 7.2V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19v-7.8Z"/><path class="dt" d="M10 14.5v3M14 14.5v3"/>',
    bell: '<path class="fl" d="M6 16v-5a6 6 0 0 1 12 0v5l1.6 2.2H4.4L6 16Z"/><path d="M10 20.8a2.2 2.2 0 0 0 4 0"/>',
    store: '<path class="fl" d="M4 9.5 5.6 4.5h12.8L20 9.5a2.5 2.5 0 0 1-4 2 2.5 2.5 0 0 1-4 0 2.5 2.5 0 0 1-4 0 2.5 2.5 0 0 1-4-2Z"/><path d="M5.5 12.8V20h13v-7.2"/><path class="dt" d="M10 20v-3.5h4V20"/>',
    cart: '<path class="fl" d="M5 9h14l-1.4 9.2a1.5 1.5 0 0 1-1.5 1.3H7.9a1.5 1.5 0 0 1-1.5-1.3L5 9Z"/><path d="M8.5 9 11 4.5M15.5 9 13 4.5"/><path class="dt" d="M10 13v3M14 13v3"/>',
    user: '<circle class="fl" cx="12" cy="12" r="9"/><circle class="dt" cx="12" cy="10" r="2.8"/><path class="dt" d="M6.8 18.2c1.2-2.2 3.2-3.2 5.2-3.2s4 1 5.2 3.2"/>'
  };
  var NAV = [["home", "/"], ["bell", "/notifications/"], ["store", "/#stores"], ["cart", "/#cart"], ["user", "/#profile"]];
  var active = (document.body && document.body.dataset.nav) || "";

  function build() {
    if (document.querySelector(".sub-nav")) return;
    var nav = document.createElement("nav");
    nav.className = "sub-nav"; nav.setAttribute("aria-label", "Main");
    NAV.forEach(function (it) {
      var k = it[0], a = document.createElement("a");
      a.id = "nav_" + k; a.dataset.key = k; a.href = it[1];
      if (k === "user" && active === "user" && location.pathname.indexOf("/orders") === 0) a.href = "/orders/";
      if (k === "store" && active === "store" && location.pathname.indexOf("/stores") === 0) a.href = "/stores/";
      a.setAttribute("aria-label", L[k]);
      var ic = document.createElement("span"); ic.className = "ic"; ic.setAttribute("aria-hidden", "true");
      ic.innerHTML = '<svg viewBox="0 0 24 24" focusable="false">' + ICON[k] + "</svg>"; // static trusted strings only
      var lb = document.createElement("span"); lb.className = "lb"; lb.textContent = L[k];
      a.appendChild(ic); a.appendChild(lb);
      if (k === active) { a.classList.add("on"); a.setAttribute("aria-current", "page"); }
      if (k === "bell" || k === "cart") { var b = document.createElement("b"); b.id = k === "bell" ? "navNotifBadge" : "navBadge"; b.hidden = true; a.appendChild(b); }
      nav.appendChild(a);
    });
    document.body.appendChild(nav);
    document.body.classList.add("has-subnav");
  }

  function cartCount() {
    try {
      var o = JSON.parse(ls(CART_KEY) || "null"), n = 0;
      (o && Array.isArray(o.items) ? o.items : []).forEach(function (e) { n += Number(e && e[1]) || 0; });
      return n;
    } catch (e) { return 0; }
  }
  function setBadge(id, n) {
    var b = document.getElementById(id); if (!b) return;
    b.textContent = n > 99 ? "99+" : String(n); b.hidden = n < 1;
  }
  function refresh() {
    setBadge("navBadge", cartCount());
    var tk = ls(TOKEN_KEY);
    if (!tk || active === "bell") { setBadge("navNotifBadge", 0); return; } /* the notifications page marks them read */
    fetch("/api/customer/notifications", { headers: { Authorization: "Bearer " + tk } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { setBadge("navNotifBadge", d ? (window.SNotif ? window.SNotif.unreadCount(d) : Number(d.unreadCount || 0)) : 0); })
      .catch(function () {});
  }

  function ensureLogic(cb) { /* read-state helper (shared with the notification center) */
    if (window.SNotif) return cb();
    var s = document.createElement("script"); s.src = "/notif-logic.js?v=36"; s.onload = cb; s.onerror = cb;
    document.head.appendChild(s);
  }
  function start() { build(); ensureLogic(refresh); setInterval(refresh, 60000); window.addEventListener("siymon:online", refresh); }
  document.addEventListener("visibilitychange", function () { if (!document.hidden) refresh(); });
  window.addEventListener("pageshow", function (e) { if (e.persisted) refresh(); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();

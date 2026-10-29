/* Admin sidebar behaviour + page routing.
   The original nav buttons (#driversBtn, #customersBtn, ...) stay in the page, hidden, so admin.js keeps
   updating their text / .notify state and keeps its click handlers. The sidebar mirrors them.
   Sidebar clicks no longer open full-screen modals: they change the URL hash (#/customers, #/support, ...).
   A tiny hash router then opens the matching section inside #adminPages (same layout: sidebar + header stay),
   by forwarding to the original button so admin.js keeps its auth check, data loading and handlers.
   Direct links, reload and the browser back / forward buttons all go through the same router. */
(function () {
  "use strict";
  var doc = document, body = doc.body, html = doc.documentElement;
  var $ = function (id) { return doc.getElementById(id); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
  var COLLAPSE_KEY = "siymon_admin_sb_collapsed_v1";
  var TOKEN_KEY = "siymon_admin_token_v2";
  var mqMobile = window.matchMedia("(max-width: 860px)");

  /* ---------- strings owned by the sidebar (everything else mirrors admin.js) ---------- */
  var T = {
    ar: { menu: "القائمة", home: "الطلبات", group: "الأعمال", search: "بحث…", light: "فاتح", dark: "داكن", collapse: "طي القائمة", expand: "توسيع القائمة", open: "القائمة", logout: "تسجيل الخروج", nav: "التنقل", zones: "مناطق الخدمة" },
    fr: { menu: "Menu", home: "Commandes", group: "Activité", search: "Rechercher…", light: "Clair", dark: "Sombre", collapse: "Réduire", expand: "Agrandir", open: "Menu", logout: "Déconnexion", nav: "Navigation", zones: "Zones de service" },
    en: { menu: "Menu", home: "Orders", group: "Business", search: "Search…", light: "Light", dark: "Dark", collapse: "Collapse", expand: "Expand", open: "Menu", logout: "Logout", nav: "Navigation", zones: "Service zones" }
  };
  function L() { return T[(html.lang || "ar").slice(0, 2)] || T.en; }
  function isMobile() { return mqMobile.matches; }

  /* ---------- collapse / expand ---------- */
  function savedPref() { try { var v = localStorage.getItem(COLLAPSE_KEY); return v === null ? null : v === "1"; } catch (e) { return null; } }
  function autoCollapsed() { return window.innerWidth < 1100; }          // tablet: collapse automatically
  function setCollapsed(v, persist) {
    body.classList.toggle("sb-collapsed", !!v);
    if (persist) { try { localStorage.setItem(COLLAPSE_KEY, v ? "1" : "0"); } catch (e) {} }
    var t = $("sbToggle"); if (t) { t.setAttribute("aria-label", v ? L().expand : L().collapse); t.setAttribute("aria-expanded", String(!v)); }
    hideTip();
  }
  function applyInitial() { var p = savedPref(); setCollapsed(p === null ? autoCollapsed() : p, false); }

  /* ---------- mobile drawer ---------- */
  function openDrawer(v) {
    body.classList.toggle("sb-open", !!v);
    var b = $("navBurger"); if (b) b.setAttribute("aria-expanded", String(!!v));
    if (v) { var first = $("sbSearch"); if (first && !isMobile()) first.focus(); }
  }

  /* ---------- labels ---------- */
  function applyLabels() {
    var s = L();
    $$("[data-i]").forEach(function (n) {
      var k = n.getAttribute("data-i");
      if (k === "menuManage" || k === "drivers" || k === "customers" || k === "support" || k === "storeSupport" || k === "exceptions" || k === "feedback" || k === "reports" || k === "notifications" || k === "settings" || k === "topups" || k === "portal") return; // mirrored
      if (s[k] != null) n.textContent = s[k];
    });
    var inp = $("sbSearch"); if (inp) inp.placeholder = s.search;
    $("sideNav").setAttribute("aria-label", s.nav);
    var bb = $("navBurger"); if (bb) { bb.title = s.open; bb.setAttribute("aria-label", s.open); }
    var lg = $("sbLogout"); if (lg) lg.setAttribute("aria-label", s.logout);
    setCollapsed(body.classList.contains("sb-collapsed"), false);
    mirrorAll();
  }

  /* ---------- mirror admin.js text / counts / notify onto the sidebar ---------- */
  var COUNT_RE = /\s*[\(\[]\s*(\d+)\s*[\)\]]\s*$/;
  function mirrorItem(it) {
    var tid = it.getAttribute("data-text"), src = it.getAttribute("data-src");
    var txt = tid && $(tid) ? ($(tid).textContent || "").trim() : "";
    var tn = it.querySelector(".sb-text");
    if (tn && txt) {
      var m = txt.match(COUNT_RE);
      tn.textContent = m ? txt.replace(COUNT_RE, "") : txt;
      var badge = it.querySelector(".sb-badge");
      if (badge) { var n = m ? parseInt(m[1], 10) : 0; badge.hidden = !n; badge.textContent = n > 99 ? "99+" : String(n); }
    }
    if (src && $(src)) it.classList.toggle("notify", $(src).classList.contains("notify"));
    var label = tn ? tn.textContent : "";
    if (label) it.setAttribute("data-tip", label);
    if (it.tagName === "BUTTON" && label) it.setAttribute("aria-label", label);
  }
  function mirrorAll() {
    $$(".sb-item[data-text], .sb-subitem[data-text]").forEach(mirrorItem);
    var home = $("sbHome"); if (home) home.setAttribute("data-tip", L().home);
    $$(".sb-theme button").forEach(function (b) { b.setAttribute("data-tip", b.textContent.trim()); });
    var lg = $("sbLogout"); if (lg) lg.setAttribute("data-tip", ($("logoutBtn") && $("logoutBtn").textContent.trim()) || L().logout);
    var av = $("sbAvatar"); if (av) av.setAttribute("data-tip", ($("sbUserMail").textContent || $("sbUserName").textContent || "").trim());
    var sb = $("sbSearchBtn"); if (sb) sb.setAttribute("data-tip", L().search.replace("…", ""));
  }
  function watch() {
    var mo = new MutationObserver(function () { mirrorAll(); });
    $$(".sb-item[data-text], .sb-subitem[data-text]").forEach(function (it) {
      var t = $(it.getAttribute("data-text")); if (t) mo.observe(t, { childList: true, characterData: true, subtree: true });
      var s = it.getAttribute("data-src"); if (s && $(s)) mo.observe($(s), { attributes: true, attributeFilter: ["class"] });
    });
    var lg = $("logoutBtn"); if (lg) mo.observe(lg, { childList: true, characterData: true, subtree: true });
    new MutationObserver(applyLabels).observe(html, { attributes: true, attributeFilter: ["lang"] });
  }

  /* ---------- routing (hash router) ---------- */
  // route -> sidebar item key.  "" is the Orders view (home).
  var ROUTE_OF = { home: "", drivers: "drivers", dispatch: "dispatch", customers: "customers", support: "support", storeSupport: "store-support", exceptions: "exceptions", system: "system", feedback: "feedback", reports: "reports", notifications: "notifications",
                   settings: "settings", topups: "topups", menuManage: "menu", subRest: "menu/restaurants", subMeals: "menu/meals" };
  var ROUTE_KEY = {}; Object.keys(ROUTE_OF).forEach(function (k) { ROUTE_KEY[ROUTE_OF[k]] = k; });
  // page container -> the global admin.js function that closes it (keeps polling timers / state resets working)
  var PAGE_FN = { settingsModal: "showSettings", menuModal: "showMenu", driversModal: "showDrivers", dispatchModal: "showDispatch", customersModal: "showCustomers",
                  supportModal: "showSupport", storeSupportModal: "showStoreSupport", exceptionsModal: "showExceptions", systemModal: "showSystem", feedbackModal: "showFeedback", reportsModal: "showReports", notificationsModal: "showNotificationsModal", topupsModal: "showTopups" };
  var pending = null;        // {key} while a page is being opened (admin.js loads its data before showing it)
  var lastOpened = null, shownId = null;

  function routeKey() {
    var h = (location.hash || "").replace(/^#\/?/, "").split("?")[0].replace(/\/+$/, "").toLowerCase();
    return Object.prototype.hasOwnProperty.call(ROUTE_KEY, h) ? ROUTE_KEY[h] : "home";
  }
  function pageKey(k) { return (k === "subRest" || k === "subMeals") ? "menuManage" : k; }   // sub routes belong to the Menu page
  function pageItems() { return $$(".sb-item[data-modal]"); }
  function pageItem(key) { return pageItems().filter(function (i) { return i.getAttribute("data-key") === pageKey(key); })[0] || null; }
  function openPages() { return $$(".modal.page-view").filter(function (m) { return m.classList.contains("show"); }); }
  function hasToken() { try { return !!localStorage.getItem(TOKEN_KEY); } catch (e) { return true; } }
  function authOpen() { var a = $("authModal"); return !!(a && a.classList.contains("show")); }
  function closePage(m) {
    var fn = window[PAGE_FN[m.id]];
    if (typeof fn === "function") fn(false); else m.classList.remove("show");
  }
  function setActive(el) {
    $$(".sb-item").forEach(function (b) {
      var on = b === el; b.classList.toggle("active", on);
      if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
  }

  // navigate to a sidebar key (changes the URL, so history / back / direct links all work)
  function go(key) {
    if (key !== "home" && window.adminPerms && window.adminPerms.perms() && !window.adminPerms.canNav(key)) return;   // not allowed for this role
    var r = ROUTE_OF[key]; if (r == null) r = "";
    pending = key === "home" ? null : { key: key };
    if (routeKey() === key) applyRoute(); else location.hash = "#/" + r;
  }

  // make the screen match the current URL
  function applyRoute() {
    var key = routeKey();
    if (key === "home") { pending = null; openPages().forEach(closePage); return; }
    if (!hasToken() || authOpen()) return;                 // sign in first; the route is applied once the login closes
    var P = window.adminPerms;
    if (P) {                                                // a typed / bookmarked #/route must obey the same permissions as the sidebar
      var perms = P.perms();
      if (!perms) { P.ready().then(function () { if (P.perms()) applyRoute(); }); return; }   // wait until we know the role
      if (!P.canNav(key)) { pending = null; location.replace(location.pathname + location.search + "#/"); return; }
    }
    var it = pageItem(key), m = it && $(it.getAttribute("data-modal"));
    if (!it || !m) return;
    var already = m.classList.contains("show");
    if (already) {
      pending = null;
      openPages().forEach(function (o) { if (o !== m) closePage(o); });
    } else {
      var mine = pending = { key: key };
      var src = $(it.getAttribute("data-src")); if (src) src.click();      // original handler: auth check + load data + show
      setTimeout(function () { if (pending === mine) { pending = null; reconcile(); } }, 8000);   // load failed / was refused
    }
    if (key === "subRest" || key === "subMeals") {
      var sub = $$(".sb-subitem").filter(function (b) { return b.getAttribute("data-key") === key; })[0];
      var tab = sub && $(sub.getAttribute("data-tab"));
      if (tab) { if (already) tab.click(); else setTimeout(function () { if (routeKey() === key) tab.click(); }, 60); }
    }
  }

  // keep layout, sidebar highlight and URL consistent with whichever page is actually open
  function reconcile() {
    var open = openPages();
    if (open.length > 1) {                                  // only one page at a time: the latest one wins
      var keep = open.filter(function (m) { return m.id === lastOpened; })[0] || open[open.length - 1];
      open.forEach(function (m) { if (m !== keep) closePage(m); });
      open = [keep];
    }
    var cur = open[0] || null, item = null;
    body.classList.toggle("page-active", !!cur);
    if (cur) {
      pending = null;
      item = pageItems().filter(function (i) { return i.getAttribute("data-modal") === cur.id; })[0] || null;
      var key = item ? item.getAttribute("data-key") : "home";
      if (pageKey(routeKey()) !== key) location.hash = "#/" + ROUTE_OF[key];   // opened by something else (e.g. a notification)
      if (shownId !== cur.id) { shownId = cur.id; window.scrollTo(0, 0); }
    } else {
      shownId = null;
      // the page closed itself (its ✕ button) -> back to Orders
      if (!pending && !authOpen() && hasToken() && routeKey() !== "home") location.hash = "#/";
    }
    setActive(item || $("sbHome"));
  }

  function bindNav() {
    $$(".sb-item").forEach(function (it) {
      if (it.tagName === "A") { it.addEventListener("click", function () { if (isMobile()) openDrawer(false); }); return; }
      it.addEventListener("click", function () {
        var key = it.getAttribute("data-key");
        if (key === "home") { go("home"); window.scrollTo({ top: 0, behavior: "smooth" }); if (isMobile()) openDrawer(false); return; }
        if (it.classList.contains("sb-parent") && !body.classList.contains("sb-collapsed") || (it.classList.contains("sb-parent") && isMobile())) {
          var open = it.getAttribute("aria-expanded") !== "true";
          it.setAttribute("aria-expanded", String(open)); $("sbSubMenu").hidden = !open; return;
        }
        go(key);
        if (isMobile()) openDrawer(false);
      });
    });
    $$(".sb-subitem").forEach(function (b) {
      b.addEventListener("click", function () {
        go(b.getAttribute("data-key"));
        if (isMobile()) openDrawer(false);
      });
    });
    $("sbToggle").addEventListener("click", function () { setCollapsed(!body.classList.contains("sb-collapsed"), true); });
    $("navBurger").addEventListener("click", function () { openDrawer(!body.classList.contains("sb-open")); });
    $("sbBackdrop").addEventListener("click", function () { openDrawer(false); });
    doc.addEventListener("keydown", function (e) { if (e.key === "Escape") openDrawer(false); });
    $("sbLogout").addEventListener("click", function () { if ($("logoutBtn")) $("logoutBtn").click(); openDrawer(false); });
    $$(".sb-theme button").forEach(function (b) {
      b.addEventListener("click", function () {
        var want = b.getAttribute("data-set"), cur = html.getAttribute("data-theme") === "dark" ? "dark" : "light";
        if (want !== cur && $("themeToggle")) $("themeToggle").click();     // reuse the existing theme logic + storage
      });
    });
    $("sbSearchBtn").addEventListener("click", function () {
      if (body.classList.contains("sb-collapsed") && !isMobile()) { setCollapsed(false, true); }
      $("sbSearch").focus();
    });
    $("sbSearch").addEventListener("input", function () {
      var q = this.value.trim().toLowerCase();
      $$(".sb-item[data-key]").forEach(function (it) {
        if (it.id === "sbHome" || true) {
          var t = (it.querySelector(".sb-text") ? it.querySelector(".sb-text").textContent : "").toLowerCase();
          it.style.display = !q || t.indexOf(q) !== -1 ? "" : "none";
        }
      });
      $$(".sb-label, .sb-sep").forEach(function (l) { l.style.display = q ? "none" : ""; });
      if (q) { $("sbSubMenu").hidden = true; }
    });
    $("sbSearch").addEventListener("keydown", function (e) {
      if (e.key === "Enter") { var first = $$(".sb-item[data-key]").filter(function (i) { return i.style.display !== "none"; })[0]; if (first) first.click(); }
    });
    $("sbHome").addEventListener("click", function () {});
  }

  /* ---------- active item + layout follow the open page ---------- */
  function watchModals() {
    var mo = new MutationObserver(function (recs) {
      recs.forEach(function (r) {
        var was = (r.oldValue || "").split(/\s+/).indexOf("show") !== -1;
        if (!was && r.target.classList.contains("show")) lastOpened = r.target.id;
      });
      setTimeout(reconcile, 0);
    });
    $$(".modal.page-view").forEach(function (m) { mo.observe(m, { attributes: true, attributeFilter: ["class"], attributeOldValue: true }); });
  }

  /* ---------- theme switch mirrors <html data-theme> ---------- */
  function syncTheme() {
    var dark = html.getAttribute("data-theme") === "dark";
    $$(".sb-theme button").forEach(function (b) { var on = (b.getAttribute("data-set") === "dark") === dark; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); });
  }

  /* ---------- tooltip (collapsed mode) ---------- */
  var tip = null, tipTimer = null;
  function hideTip() { if (!tip) tip = $("sbTip"); if (tip) tip.classList.remove("show"); }
  function showTip(el) {
    if (!body.classList.contains("sb-collapsed") || isMobile()) return;
    var text = el.getAttribute("data-tip"); if (!text) return;
    tip = tip || $("sbTip"); tip.textContent = text;
    var r = el.getBoundingClientRect(), sb = $("sideNav").getBoundingClientRect(), rtl = html.dir === "rtl";
    tip.style.top = (r.top + r.height / 2) + "px";
    tip.classList.add("show");
    var w = tip.offsetWidth;
    tip.style.left = (rtl ? sb.left - 10 - w : sb.right + 10) + "px";
  }
  function bindTips() {
    var sel = ".sb-item, .sb-subitem, .sb-theme button, .sb-logout, .sb-avatar, .sb-search-btn";
    $("sideNav").addEventListener("mouseover", function (e) { var t = e.target.closest(sel); if (t) showTip(t); });
    $("sideNav").addEventListener("mouseout", function (e) { if (e.target.closest(sel)) hideTip(); });
    $("sideNav").addEventListener("focusin", function (e) { var t = e.target.closest(sel); if (t) showTip(t); });
    $("sideNav").addEventListener("focusout", hideTip);
    $("sbScroll").addEventListener("scroll", hideTip);
  }

  /* ---------- real user (GET /api/admin/me) ---------- */
  function setUser(name, mail) {
    $("sbUserName").textContent = name || "—";
    $("sbUserMail").textContent = mail || "";
    $("sbAvatar").textContent = ((name || mail || "A").trim().charAt(0) || "A");
    mirrorAll();
  }
  function loadUser() {
    var tok = null; try { tok = localStorage.getItem(TOKEN_KEY); } catch (e) {}
    if (!tok) { setUser("", ""); return; }
    fetch("/api/admin/me", { headers: { "X-Admin-Token": tok } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d) return;
        var mail = d.email || "", name = d.name || (mail ? mail.split("@")[0] : (d.phone || ""));
        setUser(name, mail || d.phone || "");
      }).catch(function () {});
  }
  function watchAuth() {
    var m = $("authModal"); if (!m) return;
    new MutationObserver(function () { if (m.classList.contains("show")) setUser("", ""); else { setTimeout(loadUser, 150); if (window.adminPerms) window.adminPerms.reload().then(function () { applyRoute(); }); else setTimeout(applyRoute, 250); } })
      .observe(m, { attributes: true, attributeFilter: ["class"] });
  }

  /* ---------- init ---------- */
  applyInitial();
  applyLabels();
  bindNav(); bindTips(); watch(); watchModals(); watchAuth();
  window.addEventListener("hashchange", applyRoute);           // sidebar clicks, direct links, back / forward
  window.adminNav = { go: go };                                 // lets admin.js navigate (e.g. Customers -> Support chat)
  new MutationObserver(syncTheme).observe(html, { attributes: true, attributeFilter: ["data-theme"] });
  syncTheme(); applyRoute(); reconcile(); loadUser();           // applyRoute first: a direct link like /admin/#/customers opens that page on load
  mqMobile.addEventListener && mqMobile.addEventListener("change", function () { openDrawer(false); hideTip(); });
  window.addEventListener("resize", function () { if (savedPref() === null && !isMobile()) setCollapsed(autoCollapsed(), false); });
  // header controls keep an accessible name / tooltip in sync (icon-only on narrow widths)
  ["adminLangToggle", "soundToggle", "restToggleBtn", "logoutBtn"].forEach(function (id) {
    var b = $(id); if (!b) return;
    function sync() { var t = (b.textContent || "").trim(); if (t) { b.title = t; b.setAttribute("aria-label", t); } }
    sync(); new MutationObserver(sync).observe(b, { childList: true, characterData: true, subtree: true });
  });
})();

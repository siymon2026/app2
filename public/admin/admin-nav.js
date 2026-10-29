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
    ar: { menu: "القائمة", home: "الطلبات", group: "الأعمال", search: "بحث…", light: "فاتح", dark: "داكن", collapse: "طي القائمة", expand: "توسيع القائمة", open: "القائمة", logout: "تسجيل الخروج", nav: "التنقل", zones: "مناطق الخدمة", audit: "سجل التدقيق", staff: "الموظفون والصلاحيات", promos: "أكواد الخصم", payments: "طرق الدفع", loyalty: "نقاط الوفاء", storeEnter: "دخول متجر", loading: "جارٍ تحميل القسم…" },
    fr: { menu: "Menu", home: "Commandes", group: "Activité", search: "Rechercher…", light: "Clair", dark: "Sombre", collapse: "Réduire", expand: "Agrandir", open: "Menu", logout: "Déconnexion", nav: "Navigation", zones: "Zones de service", audit: "Journal d’audit", staff: "Équipe et rôles", promos: "Codes promo", payments: "Moyens de paiement", loyalty: "Points de fidélité", storeEnter: "Entrer en boutique", loading: "Chargement de la section…" },
    en: { menu: "Menu", home: "Orders", group: "Business", search: "Search…", light: "Light", dark: "Dark", collapse: "Collapse", expand: "Expand", open: "Menu", logout: "Logout", nav: "Navigation", zones: "Service zones", audit: "Audit log", staff: "Staff & roles", promos: "Discount codes", payments: "Payment methods", loyalty: "Loyalty points", storeEnter: "Enter store", loading: "Loading section…" }
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

  /* ---------- routing (the same hash router used by Orders) ---------- */
  var ROUTE_OF = { home: "", drivers: "drivers", dispatch: "dispatch", customers: "customers", support: "support", storeSupport: "store-support", exceptions: "exceptions", system: "system", audit: "audit", feedback: "feedback", reports: "reports", notifications: "notifications",
                   settings: "settings", topups: "topups", menuManage: "menu", subRest: "menu/restaurants", subMeals: "menu/meals", zones: "zones", storeEnter: "store-enter", portal: "portal", staff: "staff", promos: "promos", payments: "payments", loyalty: "loyalty" };
  var ROUTE_KEY = {}; Object.keys(ROUTE_OF).forEach(function (k) { ROUTE_KEY[ROUTE_OF[k]] = k; });
  // Close through each page's own function so its polling and other state are cleaned up.
  var PAGE_FN = { settingsModal: "showSettings", menuModal: "showMenu", driversModal: "showDrivers", dispatchModal: "showDispatch", customersModal: "showCustomers",
                  supportModal: "showSupport", storeSupportModal: "showStoreSupport", exceptionsModal: "showExceptions", systemModal: "showSystem", feedbackModal: "showFeedback", reportsModal: "showReports", notificationsModal: "showNotificationsModal", topupsModal: "showTopups",
                  zonesModal: "showZones", storeEnterModal: "showStoreEnter", portalModal: "showPortal", staffModal: "showStaff", promosModal: "showPromos", paymentsModal: "showPayments", loyaltyModal: "showLoyalty" };
  var pending = null;              // the requested page while its original handler loads data
  var started = Object.create(null); // outstanding async source handlers
  var abandoned = Object.create(null); // timed-out handlers may still complete later
  var lastOpened = null, shownId = null, appliedKey = null;

  function routeKey() {
    var h = (location.hash || "").replace(/^#\/?/, "").split("?")[0].replace(/\/+$/, "").toLowerCase();
    return Object.prototype.hasOwnProperty.call(ROUTE_KEY, h) ? ROUTE_KEY[h] : "home";
  }
  function pageKey(k) { return (k === "subRest" || k === "subMeals") ? "menuManage" : k; }
  function pageItems() { return $$(".sb-item[data-modal]"); }
  function pageItem(key) { return pageItems().filter(function (i) { return i.getAttribute("data-key") === pageKey(key); })[0] || null; }
  function openPages() { return $$("#adminPages .modal.page-view.show"); }
  function hasToken() { try { return !!localStorage.getItem(TOKEN_KEY); } catch (e) { return true; } }
  function authOpen() { var a = $("authModal"); return !!(a && a.classList.contains("show")); }
  function closePage(m) {
    started[m.id] = false;
    var fn = window[PAGE_FN[m.id]];
    if (typeof fn === "function") fn(false); else m.classList.remove("show");
  }
  function setActive(el) {
    var key = routeKey(), sub = key === "subRest" || key === "subMeals";
    $$(".sb-item").forEach(function (b) {
      var on = b === el; b.classList.toggle("active", on);
      if (on && !sub) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    $$(".sb-subitem").forEach(function (b) {
      var on = sub && b.getAttribute("data-key") === key; b.classList.toggle("active", on);
      if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
  }
  function selectRouteTab(key) {
    var tab = null, activeClass = "active";
    if (key === "subRest" || key === "subMeals") {
      var parent = pageItem(key); if (parent) parent.setAttribute("aria-expanded", "true");
      $("sbSubMenu").hidden = false;
      var sub = $$(".sb-subitem").filter(function (b) { return b.getAttribute("data-key") === key; })[0];
      tab = sub && $(sub.getAttribute("data-tab"));
    } else if (key === "audit" || key === "system") {
      tab = $(key === "audit" ? "sysTabA" : "sysTabS"); activeClass = "pri";
    }
    if (tab && !tab.hidden && !tab.classList.contains(activeClass)) tab.click();
  }

  function go(key) {
    if (!Object.prototype.hasOwnProperty.call(ROUTE_OF, key)) return;
    if (key !== "home" && window.adminPerms && window.adminPerms.perms() && !window.adminPerms.canNav(key)) return;
    // Set the intent synchronously: an older async page must not win while hashchange is queued.
    pending = key === "home" ? null : { key: key };
    if (routeKey() === key) applyRoute(); else location.hash = "#/" + ROUTE_OF[key];
  }

  function applyRoute() {
    var key = routeKey(); appliedKey = key;
    if (key === "home") {
      pending = null; openPages().forEach(closePage); reconcile(); return;
    }
    if (!hasToken() || authOpen()) return; // apply the bookmarked route after login
    var P = window.adminPerms;
    if (P) {
      if (!P.perms()) {
        pending = { key: key };
        P.ready().then(function () { if (P.perms()) applyRoute(); });
        return;
      }
      if (!P.canNav(key)) { pending = null; openPages().forEach(closePage); location.replace(location.pathname + location.search + "#/"); return; }
    }
    var it = pageItem(key), m = it && $(it.getAttribute("data-modal"));
    if (!it || !m) return;
    var already = m.classList.contains("show");
    pending = already ? null : { key: key, id: m.id };
    // Leave the old page via its cleanup hook, not as a second overlay.
    openPages().forEach(function (o) { if (o !== m) closePage(o); });
    if (already) { selectRouteTab(key); reconcile(); return; }
    reconcile();
    if (!started[m.id]) {
      started[m.id] = true;
      var src = $(it.getAttribute("data-src"));
      if (src) src.click();
    }
    var id = m.id, request = pending;
    setTimeout(function () {
      if (pending === request && request.id === id && routeKey() === request.key) {
        // A handler may never complete. Permit a retry but still reject its late
        // response if the user has moved to another section.
        started[id] = false; abandoned[id] = true;
        pending = null; reconcile();
      }
    }, 8000);
  }

  function reconcile() {
    // A history/hash change can precede its hashchange event. Apply that new
    // intent before interpreting a still-visible old page as a new navigation.
    if (appliedKey !== routeKey()) { applyRoute(); return; }
    var desired = pageItem(routeKey()), open = openPages();
    // Fail closed on logout/permission refresh, including late callbacks from
    // the previous account. An abandoned response is not a new navigation.
    var P = window.adminPerms;
    open.forEach(function (m) {
      var source = desired && desired.getAttribute("data-modal") === m.id ? desired :
        pageItems().filter(function (i) { return i.getAttribute("data-modal") === m.id; })[0];
      if (!hasToken() || authOpen() || (P && (!P.perms() || !source || !P.canNav(source.getAttribute("data-key")))) ||
          ((started[m.id] || abandoned[m.id]) && (!desired || desired.getAttribute("data-modal") !== m.id))) closePage(m);
    });
    open = openPages();
    if (pending && pending.id) {
      open.forEach(function (m) { if (m.id !== pending.id) closePage(m); });
      open = openPages();
      if (open.some(function (m) { return m.id === pending.id; })) pending = null;
    }
    if (open.length > 1) {
      var keep = open.filter(function (m) { return m.id === lastOpened; })[0] || open[open.length - 1];
      open.forEach(function (m) { if (m !== keep) closePage(m); }); open = [keep];
    }
    var cur = open[0] || null, item = null;
    body.classList.toggle("page-active", !!cur || !!(pending && pending.id));
    $("adminPageLoading").hidden = !(pending && pending.id && !cur);
    if (cur) {
      started[cur.id] = false;
      item = desired && desired.getAttribute("data-modal") === cur.id ? desired : pageItems().filter(function (i) { return i.getAttribute("data-modal") === cur.id; })[0] || null;
      var key = item ? item.getAttribute("data-key") : "home";
      if (pageKey(routeKey()) !== key) location.hash = "#/" + ROUTE_OF[key]; // opened by an existing internal action
      else selectRouteTab(routeKey());
      if (shownId !== cur.id) { shownId = cur.id; window.scrollTo(0, 0); }
    } else if (pending) {
      item = pageItem(pending.key);
    } else {
      shownId = null;
      if (!authOpen() && hasToken() && routeKey() !== "home") location.hash = "#/";
    }
    setActive(item || $("sbHome"));
  }

  // Keep the existing standalone zone manager intact and preserve an unsaved draft while changing sections.
  function signalZones() {
    var frame = $("zonesFrame");
    if (frame && frame.contentWindow) frame.contentWindow.postMessage({ type: "siymon:zones-visible" }, location.origin);
  }
  window.showZones = function (show) {
    var m = $("zonesModal"); m.classList.toggle("show", !!show);
    if (!show) return;
    var frame = $("zonesFrame");
    if (!frame) {
      frame = doc.createElement("iframe"); frame.id = "zonesFrame"; frame.className = "admin-embedded-page";
      frame.title = L().zones; frame.src = "/admin/zones/?embedded=1";
      frame.addEventListener("load", function () { setTimeout(signalZones, 50); }); m.appendChild(frame);
    }
    setTimeout(signalZones, 50);
  };
  $("zonesBtn").addEventListener("click", function () {
    if (window.adminPerms && !window.adminPerms.canNav("zones")) return;
    window.showZones(true);
  });

  function bindNav() {
    $$(".sb-item").forEach(function (it) {
      it.addEventListener("click", function () {
        var key = it.getAttribute("data-key");
        if (key === "home") { go("home"); window.scrollTo({ top: 0, behavior: "smooth" }); if (isMobile()) openDrawer(false); return; }
        if (it.classList.contains("sb-parent") && !body.classList.contains("sb-collapsed") || (it.classList.contains("sb-parent") && isMobile())) {
          var open = it.getAttribute("aria-expanded") !== "true";
          it.setAttribute("aria-expanded", String(open)); $("sbSubMenu").hidden = !open;
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
        var t = (it.querySelector(".sb-text") ? it.querySelector(".sb-text").textContent : "").toLowerCase();
        it.style.display = !q || t.indexOf(q) !== -1 ? "" : "none";
      });
      $$(".sb-label, .sb-sep").forEach(function (l) { l.style.display = q ? "none" : ""; });
      if (q) { $("sbSubMenu").hidden = true; var parent = document.querySelector('.sb-parent[data-key="menuManage"]'); if (parent) parent.setAttribute("aria-expanded", "false"); }
    });
    $("sbSearch").addEventListener("keydown", function (e) {
      if (e.key === "Enter") { var first = $$(".sb-item[data-key]").filter(function (i) { return i.style.display !== "none" && getComputedStyle(i).display !== "none"; })[0]; if (first) first.click(); }
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
        // A delayed /me response must never restore a previous account's identity.
        try { if (!d || !tok || localStorage.getItem(TOKEN_KEY) !== tok || authOpen()) return; } catch (e) { return; }
        var mail = d.email || "", name = d.name || (mail ? mail.split("@")[0] : (d.phone || ""));
        setUser(name, mail || d.phone || "");
      }).catch(function () {});
  }
  function watchAuth() {
    var m = $("authModal"); if (!m) return;
    new MutationObserver(function () {
      if (m.classList.contains("show")) {
        pending = null; openPages().forEach(closePage);
        // Old requests may never finish; a subsequent account must be able to load its own pages.
        started = Object.create(null); abandoned = Object.create(null);
        var z = $("zonesFrame"); if (z) z.remove();
        setUser("", ""); reconcile();
      } else { setTimeout(loadUser, 150); if (window.adminPerms) window.adminPerms.reload().then(function () { applyRoute(); }); else setTimeout(applyRoute, 250); }
    })
      .observe(m, { attributes: true, attributeFilter: ["class"] });
  }

  /* ---------- init ---------- */
  applyInitial();
  applyLabels();
  bindNav(); bindTips(); watch(); watchModals(); watchAuth();
  if (window.adminPerms) window.adminPerms.onChange(function (perms) { if (perms && hasToken() && !authOpen()) applyRoute(); });
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

/* global api, lang, toast */
/* Enter the real store dashboard or restaurant portal inside the admin page.
 * The existing server-issued owner token is passed in the iframe fragment, never
 * in the parent URL or a request URL. The embedded apps keep their own session. */
(function () {
  "use strict";
  var doc = document;
  // Bind translated labels to their DOM nodes so switching language in the
  // persistent shell updates an open page without destroying an unsaved form.
  function L(ar, en, fr) {
    var text = { ar: ar, en: en, fr: fr || en };
    return { adminTranslation: text, toString: function () {
      return text[(doc.documentElement.lang || "ar").slice(0, 2)] || text.en;
    } };
  }
  var nm = function (o) { return o && typeof o === "object" ? o[lang] || o.ar || o.fr || o.en || "" : String(o || ""); };
  function h(tag, props) {
    var e = doc.createElement(tag), k, kids = Array.prototype.slice.call(arguments, 2);
    for (k in (props || {})) {
      var v = props[k]; if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k.indexOf("on") === 0 && typeof v === "function") e.addEventListener(k.slice(2), v);
      else {
        e.setAttribute(k, v === true ? "" : String(v));
        if (v && v.adminTranslation) (e.adminTranslations || (e.adminTranslations = {}))[k] = v;
      }
    }
    kids.forEach(function (kid) { (Array.isArray(kid) ? kid : [kid]).forEach(function (c) {
      if (c == null || c === false) return;
      var n = c instanceof Node ? c : doc.createTextNode(String(c));
      if (c && c.adminTranslation) n.adminTranslation = c;
      e.appendChild(n);
    }); });
    return e;
  }
  window.adminPageElements = { h: h, L: L };
  new MutationObserver(function () {
    var walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT), node;
    while ((node = walker.nextNode())) {
      if (node.adminTranslation) node.nodeValue = String(node.adminTranslation);
      if (node.adminTranslations) Object.keys(node.adminTranslations).forEach(function (k) { node.setAttribute(k, String(node.adminTranslations[k])); });
    }
  }).observe(doc.documentElement, { attributes: true, attributeFilter: ["lang"] });
  var say = function (m) { try { toast(m); } catch (e) {} };
  var TARGETS = { store: "/store/?adminEmbed=1", portal: "/restaurant/?adminEmbed=1" };
  var generations = { store: 0, portal: 0 };
  function mount(kind) { return doc.getElementById(kind === "store" ? "storeEnterModal" : "portalModal"); }
  function clearEmbeddedSessions() {
    // These keys are used only in the current admin tab, not a store owner's localStorage session.
    try { ["siymon_store_token", "siymon_store_id", "siymon_store_list", "siymon_restaurant_token_v1", "siymon_restaurant_profile_v1"].forEach(function (k) { sessionStorage.removeItem(k); }); } catch (e) {}
  }
  function show(kind, visible) {
    var m = mount(kind);
    m.classList.toggle("show", !!visible);
    if (!visible) { generations[kind]++; m.replaceChildren(); clearEmbeddedSessions(); }
  }
  window.showStoreEnter = function (v) { show("store", v); };
  window.showPortal = function (v) { show("portal", v); };

  function syncTheme(frame) {
    try {
      var root = frame.contentDocument && frame.contentDocument.documentElement;
      if (root) root.setAttribute("data-theme", doc.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
    } catch (e) { /* the same-origin app may still be loading */ }
  }
  new MutationObserver(function () { doc.querySelectorAll(".admin-store-frame").forEach(syncTheme); })
    .observe(doc.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  function enter(id, target, btn, pageKind) {
    var m = mount(pageKind), mine = ++generations[pageKind];
    btn.disabled = true;
    api("/api/admin/stores/" + encodeURIComponent(id) + "/enter", { method: "POST", body: "{}" }).then(function (r) {
      if (mine !== generations[pageKind] || !m.classList.contains("show")) return;
      var hash = "#admintoken=" + encodeURIComponent(r.token) + (target === "store" ? "&store=" + encodeURIComponent(id) : "");
      var frame = h("iframe", { class: "admin-embedded-page admin-store-frame", title: target === "store" ? L("لوحة المتجر", "Store dashboard", "Tableau de bord") : L("بوابة المطعم", "Restaurant portal", "Portail restaurant"), referrerpolicy: "no-referrer", src: TARGETS[target] + hash });
      frame.addEventListener("load", function () { syncTheme(frame); });
      var back = h("button", { class: "sen-btn", type: "button", onclick: function () { clearEmbeddedSessions(); open(pageKind); } }, L("اختيار متجر آخر", "Choose another store", "Choisir une autre boutique"));
      m.replaceChildren(h("div", { class: "sen-frame-head" }, back), frame);
    }).catch(function (e) {
      if (mine === generations[pageKind]) say("❌ " + (e && e.message ? e.message : "Error"));
    }).then(function () { btn.disabled = false; });
  }

  function open(kind) {
    generations[kind]++;
    var m = mount(kind);
    var list = h("div", { class: "sen-list" }, h("p", { class: "sen-muted" }, "…"));
    var search = h("input", { class: "sen-search", type: "search", placeholder: L("ابحث عن متجر أو مطعم…", "Search a store…", "Rechercher…"), "aria-label": L("بحث", "Search", "Recherche") });
    var box = h("div", { class: "modal-card sen-box", role: "region" },
      h("div", { class: "sen-head" }, h("h3", {}, kind === "portal" ? L("الدخول إلى بوابة المطعم", "Open restaurant portal", "Ouvrir le portail") : L("الدخول إلى لوحة المتجر", "Open store dashboard", "Ouvrir le tableau de bord")),
        h("button", { class: "sen-x", type: "button", "aria-label": L("إغلاق", "Close", "Fermer"), onclick: function () { show(kind, false); } }, "✕")),
      h("p", { class: "sen-muted" }, L("تدخل بصلاحية المالك وبإمكانك التعديل مباشرة، بدون كلمة مرور.", "You enter with owner rights and can edit directly, no password.", "Accès propriétaire, modification directe, sans mot de passe.")),
      search, list);
    m.replaceChildren(box);
    show(kind, true);
    var stores = [];
    function render() {
      var q = search.value.trim().toLowerCase();
      list.replaceChildren();
      var rows = stores.filter(function (s) { return !q || (nm(s.name) + " " + (s.type || "")).toLowerCase().indexOf(q) >= 0; });
      if (!rows.length) { list.appendChild(h("p", { class: "sen-muted" }, L("لا توجد نتائج", "No results", "Aucun résultat"))); return; }
      rows.forEach(function (s) {
        var b1, b2;
        b1 = h("button", { class: "sen-btn" + (kind === "store" ? " primary" : ""), type: "button", onclick: function () { enter(s.id, "store", b1, kind); } }, "🛍️ ", L("لوحة المتجر", "Store dashboard", "Tableau de bord"));
        b2 = h("button", { class: "sen-btn" + (kind === "portal" ? " primary" : ""), type: "button", onclick: function () { enter(s.id, "portal", b2, kind); } }, "🍽️ ", L("بوابة المطعم", "Restaurant portal", "Portail"));
        list.appendChild(h("div", { class: "sen-row" + (s.isActive === false ? " off" : "") },
          h("div", { class: "sen-name" }, h("b", {}, nm(s.name) || String(s.id)), h("small", {}, (s.type || "restaurant") + (s.isActive === false ? " · " + L("معطّل", "disabled", "désactivé") : ""))),
          h("div", { class: "sen-acts" }, b1, b2)));
      });
    }
    search.addEventListener("input", render);
    api("/api/admin/restaurants").then(function (r) { stores = r.restaurants || []; render(); })
      .catch(function (e) { list.replaceChildren(h("p", { class: "sen-muted" }, "❌ " + (e && e.message || "Error"))); });
  }

  [["storeEnterBtn", "store", "storeEnter"], ["restaurantPortalBtn", "portal", "portal"]].forEach(function (item) {
    doc.getElementById(item[0]).addEventListener("click", function () {
      if (window.adminPerms && !window.adminPerms.canNav(item[2])) return;
      open(item[1]);
    });
  });
})();

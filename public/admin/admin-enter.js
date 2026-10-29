/* global api, lang, toast */
/* Super-admin: enter a store's dashboard (/store/) or the restaurant portal (/restaurant/) from the sidebar.
 * The admin picks a store; the server issues a short-lived owner token (POST /api/admin/stores/:id/enter),
 * which is handed to the target page in the URL fragment so it signs in without a password and the admin
 * can edit exactly what the store owner can. All names are inserted with textContent. */
(function () {
  "use strict";
  var doc = document;
  var L = function (ar, en, fr) { var l = (doc.documentElement.lang || lang || "ar").slice(0, 2); return l === "ar" ? ar : l === "fr" ? (fr || en) : en; };
  var nm = function (o) { return o && typeof o === "object" ? o[lang] || o.ar || o.fr || o.en || "" : String(o || ""); };
  function h(tag, props) {
    var e = doc.createElement(tag), k, i, kids = Array.prototype.slice.call(arguments, 2);
    for (k in (props || {})) {
      var v = props[k]; if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k.indexOf("on") === 0 && typeof v === "function") e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? "" : String(v));
    }
    kids.forEach(function (kid) { (Array.isArray(kid) ? kid : [kid]).forEach(function (c) { if (c == null || c === false) return; e.appendChild(c instanceof Node ? c : doc.createTextNode(String(c))); }); });
    return e;
  }
  var say = function (m) { try { toast(m); } catch (e) {} };

  var TARGETS = { store: "/store/", portal: "/restaurant/" };

  function enter(id, kind, btn) {
    var win = window.open("about:blank", "_blank");           // opened synchronously so popup blockers allow it
    if (btn) btn.disabled = true;
    api("/api/admin/stores/" + encodeURIComponent(id) + "/enter", { method: "POST", body: "{}" }).then(function (r) {
      var hash = "#admintoken=" + encodeURIComponent(r.token) + (kind === "store" ? "&store=" + encodeURIComponent(id) : "");
      var url = TARGETS[kind] + hash;
      if (win) win.location.href = url; else window.location.href = url;
    }).catch(function (e) {
      if (win) win.close();
      say("❌ " + (e && e.message ? e.message : "Error"));
    }).then(function () { if (btn) btn.disabled = false; });
  }

  function open(kind) {
    var list = h("div", { class: "sen-list" }, h("p", { class: "sen-muted" }, "…"));
    var search = h("input", { class: "sen-search", type: "search", placeholder: L("ابحث عن متجر أو مطعم…", "Search a store…", "Rechercher…"), "aria-label": L("بحث", "Search", "Recherche") });
    var ov = h("div", { class: "sen-ov", onclick: function (e) { if (e.target === ov) ov.remove(); } },
      h("div", { class: "sen-box", role: "dialog", "aria-modal": "true" },
        h("div", { class: "sen-head" }, h("h3", {}, kind === "portal" ? L("الدخول إلى بوابة المطعم", "Open restaurant portal", "Ouvrir le portail") : L("الدخول إلى لوحة المتجر", "Open store dashboard", "Ouvrir le tableau de bord")),
          h("button", { class: "sen-x", type: "button", "aria-label": L("إغلاق", "Close", "Fermer"), onclick: function () { ov.remove(); } }, "✕")),
        h("p", { class: "sen-muted" }, L("تدخل بصلاحية المالك وبإمكانك التعديل مباشرة، بدون كلمة مرور.", "You enter with owner rights and can edit directly, no password.", "Accès propriétaire, modification directe, sans mot de passe.")),
        search, list));
    doc.body.appendChild(ov);
    search.focus();
    var stores = [];
    function render() {
      var q = search.value.trim().toLowerCase();
      while (list.firstChild) list.removeChild(list.firstChild);
      var rows = stores.filter(function (s) { return !q || (nm(s.name) + " " + (s.type || "")).toLowerCase().indexOf(q) >= 0; });
      if (!rows.length) { list.appendChild(h("p", { class: "sen-muted" }, L("لا توجد نتائج", "No results", "Aucun résultat"))); return; }
      rows.forEach(function (s) {
        var b1, b2;
        b1 = h("button", { class: "sen-btn" + (kind === "store" ? " primary" : ""), type: "button", onclick: function () { enter(s.id, "store", b1); } }, "🛍️ " + L("لوحة المتجر", "Store dashboard", "Tableau de bord"));
        b2 = h("button", { class: "sen-btn" + (kind === "portal" ? " primary" : ""), type: "button", onclick: function () { enter(s.id, "portal", b2); } }, "🍽️ " + L("بوابة المطعم", "Restaurant portal", "Portail"));
        list.appendChild(h("div", { class: "sen-row" + (s.isActive === false ? " off" : "") },
          h("div", { class: "sen-name" }, h("b", {}, nm(s.name) || String(s.id)), h("small", {}, (s.type || "restaurant") + (s.isActive === false ? " · " + L("معطّل", "disabled", "désactivé") : ""))),
          h("div", { class: "sen-acts" }, b1, b2)));
      });
    }
    search.addEventListener("input", render);
    api("/api/admin/restaurants").then(function (r) { stores = r.restaurants || []; render(); })
      .catch(function (e) { while (list.firstChild) list.removeChild(list.firstChild); list.appendChild(h("p", { class: "sen-muted" }, "❌ " + (e && e.message || "Error"))); });
  }

  function setup() {
    var nav = doc.getElementById("sideNav"), portal = doc.getElementById("sbPortal");
    if (!nav || doc.getElementById("sbStoreEnter")) return;
    var svg = '<span class="sb-tile t-orange"><svg class="sb-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M9 22v-6h6v6"/></svg></span>';
    var btn = h("button", { class: "sb-item", id: "sbStoreEnter", type: "button", "data-key": "storeEnter" });
    btn.innerHTML = svg;                                        // static markup only
    var txt = h("span", { class: "sb-text" }); btn.appendChild(txt);
    function label() { var s = L("دخول المتجر", "Enter store", "Entrer en boutique"); txt.textContent = s; btn.setAttribute("data-tip", s); btn.setAttribute("aria-label", s); }
    label();
    btn.addEventListener("click", function () { open("store"); var m = doc.body; m.classList.remove("sb-open"); });
    if (portal && portal.parentNode) portal.parentNode.insertBefore(btn, portal); else nav.appendChild(btn);
    if (portal) portal.addEventListener("click", function (e) { e.preventDefault(); open("portal"); doc.body.classList.remove("sb-open"); });
    new MutationObserver(label).observe(doc.documentElement, { attributes: true, attributeFilter: ["lang"] });
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", setup); else setup();
})();

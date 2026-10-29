/* global api, lang, toast */
/* System admin only: manage back-office staff and their roles.
 * The server is the real gate (role is re-read on every request); this screen is only shown to a
 * system_admin and every value is inserted with textContent. */
(function () {
  "use strict";
  var doc = document;
  var L = function (ar, en, fr) { var l = (doc.documentElement.lang || lang || "ar").slice(0, 2); return l === "ar" ? ar : l === "fr" ? (fr || en) : en; };
  var say = function (m) { try { toast(m); } catch (e) {} };
  function h(tag, props) {
    var e = doc.createElement(tag), k, kids = Array.prototype.slice.call(arguments, 2);
    for (k in (props || {})) {
      var v = props[k]; if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k.indexOf("on") === 0 && typeof v === "function") e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? "" : String(v));
    }
    kids.forEach(function (kid) { (Array.isArray(kid) ? kid : [kid]).forEach(function (c) { if (c == null || c === false) return; e.appendChild(c instanceof Node ? c : doc.createTextNode(String(c))); }); });
    return e;
  }
  var ROLE_LABEL = {
    system_admin: ["مدير النظام", "System administrator", "Administrateur système"],
    order_supervisor: ["مشرف الطلبات", "Order supervisor", "Superviseur commandes"],
    driver_supervisor: ["مشرف السائقين", "Driver supervisor", "Superviseur livreurs"],
    accountant: ["محاسب", "Accountant", "Comptable"],
    support: ["دعم العملاء", "Customer support", "Support client"]
  };
  var roleName = function (r) { var x = ROLE_LABEL[r]; return x ? L(x[0], x[1], x[2]) : String(r); };

  function open() {
    var list = h("div", { class: "sen-list" }, h("p", { class: "sen-muted" }, "…"));
    var ov = h("div", { class: "sen-ov", onclick: function (e) { if (e.target === ov) ov.remove(); } });
    var box = h("div", { class: "sen-box", role: "dialog", "aria-modal": "true" });
    ov.appendChild(box);
    var email = h("input", { class: "sen-search", type: "email", placeholder: "email", autocomplete: "off" });
    var phone = h("input", { class: "sen-search", type: "tel", placeholder: L("الهاتف", "Phone", "Téléphone"), autocomplete: "off" });
    var name = h("input", { class: "sen-search", type: "text", placeholder: L("الاسم", "Name", "Nom"), maxlength: "80" });
    var pass = h("input", { class: "sen-search", type: "password", placeholder: L("كلمة المرور (8+)", "Password (8+)", "Mot de passe (8+)"), autocomplete: "new-password" });
    var role = h("select", { class: "sen-search" });
    var staffRoles = [];

    function load() {
      api("/api/admin/staff").then(function (r) {
        staffRoles = r.roles || [];
        while (role.firstChild) role.removeChild(role.firstChild);
        staffRoles.forEach(function (x) { role.appendChild(h("option", { value: x }, roleName(x))); });
        while (list.firstChild) list.removeChild(list.firstChild);
        (r.staff || []).forEach(function (s) {
          var sel = h("select", { class: "sen-search", "aria-label": "role" });
          staffRoles.forEach(function (x) { var o = h("option", { value: x }, roleName(x)); if (x === s.role) o.selected = true; sel.appendChild(o); });
          sel.addEventListener("change", function () { patch(s.id, { role: sel.value }); });
          var tog = h("button", { class: "sen-btn", type: "button", onclick: function () { patch(s.id, { disabled: !s.disabled }); } }, s.disabled ? L("تفعيل", "Enable", "Activer") : L("تعطيل", "Disable", "Désactiver"));
          list.appendChild(h("div", { class: "sen-row" + (s.disabled ? " off" : "") },
            h("div", { class: "sen-name" }, h("b", {}, s.name || s.email), h("small", {}, s.email + " · " + s.phone + (s.disabled ? " · " + L("معطّل", "disabled", "désactivé") : ""))),
            h("div", { class: "sen-acts" }, sel, tog)));
        });
      }).catch(function (e) { while (list.firstChild) list.removeChild(list.firstChild); list.appendChild(h("p", { class: "sen-muted" }, "❌ " + (e && e.message || "Error"))); });
    }
    function patch(id, body) {
      api("/api/admin/staff/" + encodeURIComponent(id), { method: "PATCH", body: JSON.stringify(body) })
        .then(function () { say("✅"); load(); })
        .catch(function (e) { say("❌ " + (e && e.message || "Error")); load(); });
    }
    var add = h("button", { class: "sen-btn primary", type: "button", onclick: function () {
      api("/api/admin/staff", { method: "POST", body: JSON.stringify({ email: email.value, phone: phone.value, name: name.value, password: pass.value, role: role.value }) })
        .then(function () { say("✅"); email.value = phone.value = name.value = pass.value = ""; load(); })
        .catch(function (e) { say("❌ " + (e && e.message || "Error")); });
    } }, L("إضافة موظف", "Add staff", "Ajouter"));
    box.appendChild(h("div", { class: "sen-head" }, h("h3", {}, L("الموظفون والصلاحيات", "Staff & roles", "Équipe et rôles")),
      h("button", { class: "sen-x", type: "button", "aria-label": L("إغلاق", "Close", "Fermer"), onclick: function () { ov.remove(); } }, "✕")));
    box.appendChild(h("p", { class: "sen-muted" }, L("لا يمكنك تغيير دورك أو تعطيل حسابك، ويجب أن يبقى مدير نظام نشط واحد على الأقل.", "You cannot change your own role or disable yourself, and one active system administrator must remain.", "Vous ne pouvez pas modifier votre propre rôle ; un administrateur système actif doit rester.")));
    box.appendChild(list);
    box.appendChild(h("h4", {}, L("موظف جديد", "New staff member", "Nouveau membre")));
    [name, email, phone, pass, role, add].forEach(function (n) { box.appendChild(n); });
    doc.body.appendChild(ov);
    load();
  }

  function setup(tries) {
    var nav = doc.getElementById("sideNav");
    if (!nav || doc.getElementById("sbStaff")) return;
    var tok = null; try { tok = localStorage.getItem("siymon_admin_token_v2"); } catch (e) {}
    if (!tok) { if (tries < 600) setTimeout(function () { setup(tries + 1); }, 2000); return; }
    api("/api/admin/me").then(function (me) {
      if (!me || !me.permissions || me.permissions.indexOf("*") < 0) return; // system_admin only
      if (doc.getElementById("sbStaff")) return;
      var btn = h("button", { class: "sb-item", id: "sbStaff", type: "button", "data-key": "staff" });
      btn.innerHTML = '<span class="sb-tile t-orange"><svg class="sb-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span>';
      var txt = h("span", { class: "sb-text" }, L("الموظفون", "Staff", "Équipe")); btn.appendChild(txt);
      btn.setAttribute("data-tip", txt.textContent);
      btn.addEventListener("click", function () { open(); doc.body.classList.remove("sb-open"); });
      nav.appendChild(btn);
    }).catch(function () { if (tries < 600) setTimeout(function () { setup(tries + 1); }, 2000); });
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", function () { setup(0); }); else setup(0);
})();

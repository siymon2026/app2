/* global api, lang, toast */
/* System admin only: manage back-office staff and their roles.
 * The server is the real gate (role is re-read on every request); this screen is only shown to a
 * system_admin and every value is inserted with textContent. */
(function () {
  "use strict";
  var doc = document;
  var L = window.adminPageElements.L, h = window.adminPageElements.h;
  var say = function (m) { try { toast(m); } catch (e) {} };
  var ROLE_LABEL = {
    system_admin: ["مدير النظام", "System administrator", "Administrateur système"],
    order_supervisor: ["مشرف الطلبات", "Order supervisor", "Superviseur commandes"],
    driver_supervisor: ["مشرف السائقين", "Driver supervisor", "Superviseur livreurs"],
    accountant: ["محاسب", "Accountant", "Comptable"],
    support: ["دعم العملاء", "Customer support", "Support client"]
  };
  var roleName = function (r) { var x = ROLE_LABEL[r]; return x ? L(x[0], x[1], x[2]) : String(r); };

  function showStaff(show) {
    var m = doc.getElementById("staffModal"); m.classList.toggle("show", !!show);
    if (!show) { m.replaceChildren(); }
  }
  window.showStaff = showStaff;

  function open() {
    var list = h("div", { class: "sen-list" }, h("p", { class: "sen-muted" }, "…"));
    var ov = doc.getElementById("staffModal");
    var box = h("div", { class: "modal-card sen-box", role: "region" });
    ov.replaceChildren(box);
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
      h("button", { class: "sen-x", type: "button", "aria-label": L("إغلاق", "Close", "Fermer"), onclick: function () { showStaff(false); } }, "✕")));
    box.appendChild(h("p", { class: "sen-muted" }, L("لا يمكنك تغيير دورك أو تعطيل حسابك، ويجب أن يبقى مدير نظام نشط واحد على الأقل.", "You cannot change your own role or disable yourself, and one active system administrator must remain.", "Vous ne pouvez pas modifier votre propre rôle ; un administrateur système actif doit rester.")));
    box.appendChild(list);
    box.appendChild(h("h4", {}, L("موظف جديد", "New staff member", "Nouveau membre")));
    [name, email, phone, pass, role, add].forEach(function (n) { box.appendChild(n); });
    showStaff(true);
    load();
  }


  // The shared hash router clicks the original source button after checking the role.
  doc.getElementById("staffBtn").addEventListener("click", function () {
    if (window.adminPerms && !window.adminPerms.canNav("staff")) return;
    open();
  });
})();

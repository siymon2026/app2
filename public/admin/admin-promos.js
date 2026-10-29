/* global api, lang, toast */
/* System admin only: discount codes. The server computes every discount; this screen only manages
 * the definitions. Values are inserted with textContent. Reuses the .sen-* styles of admin-enter.css. */
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
  var numOrNull = function (v) { v = String(v == null ? "" : v).trim(); return v === "" ? null : Number(v); };
  var dateOrNull = function (v) { return v ? new Date(v + "T23:59:59").toISOString() : null; };

  function open() {
    var list = h("div", { class: "sen-list" }, h("p", { class: "sen-muted" }, "…"));
    var ov = h("div", { class: "sen-ov", onclick: function (e) { if (e.target === ov) ov.remove(); } });
    var box = h("div", { class: "sen-box", role: "dialog", "aria-modal": "true" });
    ov.appendChild(box);
    var f = {
      code: h("input", { class: "sen-search", type: "text", maxlength: "24", placeholder: L("الكود (مثال: WELCOME10)", "Code (e.g. WELCOME10)", "Code (ex. WELCOME10)"), autocomplete: "off" }),
      type: h("select", { class: "sen-search" }, h("option", { value: "percent" }, L("نسبة %", "Percent %", "Pourcentage %")), h("option", { value: "fixed" }, L("مبلغ ثابت", "Fixed amount", "Montant fixe"))),
      value: h("input", { class: "sen-search", type: "number", min: "0", step: "any", placeholder: L("القيمة", "Value", "Valeur") }),
      maxDiscount: h("input", { class: "sen-search", type: "number", min: "0", step: "any", placeholder: L("أقصى خصم (اختياري)", "Max discount (optional)", "Remise max (optionnel)") }),
      minSubtotal: h("input", { class: "sen-search", type: "number", min: "0", step: "any", placeholder: L("حد أدنى للسلة (اختياري)", "Min basket (optional)", "Panier min (optionnel)") }),
      maxUses: h("input", { class: "sen-search", type: "number", min: "1", step: "1", placeholder: L("أقصى عدد استخدامات (اختياري)", "Max uses (optional)", "Utilisations max (optionnel)") }),
      per: h("input", { class: "sen-search", type: "number", min: "1", step: "1", value: "1", placeholder: L("لكل زبون", "Per customer", "Par client") }),
      endsAt: h("input", { class: "sen-search", type: "date", title: L("ينتهي في", "Ends on", "Fin le") }),
      cats: h("input", { class: "sen-search", type: "text", placeholder: L("فئات القائمة (اختياري، مفصولة بفاصلة)", "Menu categories (optional, comma separated)", "Catégories (optionnel, séparées par des virgules)") }),
      first: h("input", { type: "checkbox", id: "promoFirst" })
    };

    function load() {
      api("/api/admin/promos").then(function (r) {
        while (list.firstChild) list.removeChild(list.firstChild);
        if (!(r.promos || []).length) list.appendChild(h("p", { class: "sen-muted" }, L("لا توجد أكواد بعد", "No codes yet", "Aucun code")));
        (r.promos || []).forEach(function (p) {
          var what = (p.type === "percent" ? p.value + "%" : p.value + " MAD") + (p.maxDiscount ? " ≤ " + p.maxDiscount : "") + (p.minSubtotal ? " · min " + p.minSubtotal : "");
          var uses = p.total + (p.maxUses ? "/" + p.maxUses : "") + " " + L("استخدام", "uses", "utilisations") + " · " + L("كلفة المنصة", "platform cost", "coût plateforme") + " " + Number(p.discountTotal || 0).toFixed(2);
          if (p.firstOrderOnly) uses += " · " + L("أول طلب", "first order", "1re commande");
          if ((p.categories || []).length) uses += " · " + p.categories.join("/");
          var tog = h("button", { class: "sen-btn", type: "button", onclick: function () {
            api("/api/admin/promos/" + encodeURIComponent(p.id), { method: "PATCH", body: JSON.stringify({ isActive: p.isActive === false }) })
              .then(function () { say("✅"); load(); }).catch(function (e) { say("❌ " + (e && e.message || "Error")); });
          } }, p.isActive === false ? L("تفعيل", "Enable", "Activer") : L("إيقاف", "Disable", "Désactiver"));
          list.appendChild(h("div", { class: "sen-row" + (p.isActive === false ? " off" : "") },
            h("div", { class: "sen-name" }, h("b", {}, p.code), h("small", {}, what + " · " + uses + (p.endsAt ? " · → " + String(p.endsAt).slice(0, 10) : ""))),
            h("div", { class: "sen-acts" }, tog)));
        });
      }).catch(function (e) { while (list.firstChild) list.removeChild(list.firstChild); list.appendChild(h("p", { class: "sen-muted" }, "❌ " + (e && e.message || "Error"))); });
    }

    var add = h("button", { class: "sen-btn primary", type: "button", onclick: function () {
      var body = {
        code: f.code.value, type: f.type.value, value: Number(f.value.value),
        maxDiscount: numOrNull(f.maxDiscount.value), minSubtotal: numOrNull(f.minSubtotal.value),
        maxUses: numOrNull(f.maxUses.value), maxUsesPerCustomer: numOrNull(f.per.value), endsAt: dateOrNull(f.endsAt.value),
        categories: f.cats.value.split(",").map(function (x) { return x.trim(); }).filter(Boolean), firstOrderOnly: f.first.checked
      };
      api("/api/admin/promos", { method: "POST", body: JSON.stringify(body) })
        .then(function () { say("✅"); f.code.value = f.value.value = f.maxDiscount.value = f.minSubtotal.value = f.maxUses.value = f.endsAt.value = ""; load(); })
        .catch(function (e) { say("❌ " + (e && e.message || "Error")); });
    } }, L("إنشاء الكود", "Create code", "Créer le code"));

    box.appendChild(h("div", { class: "sen-head" }, h("h3", {}, L("أكواد الخصم", "Discount codes", "Codes promo")),
      h("button", { class: "sen-x", type: "button", "aria-label": L("إغلاق", "Close", "Fermer"), onclick: function () { ov.remove(); } }, "✕")));
    box.appendChild(h("p", { class: "sen-muted" }, L("الخصم على قيمة البضاعة فقط (لا على التوصيل) وتتحمّله المنصة: لا ينقص من مستحقات المتجر. يتطلب تسجيل دخول الزبون.", "Discount applies to goods only (not delivery) and is funded by the platform: the store's net is unchanged. Customers must be signed in.", "La remise porte sur les marchandises uniquement et est financée par la plateforme. Connexion client requise.")));
    box.appendChild(list);
    box.appendChild(h("h4", {}, L("كود جديد", "New code", "Nouveau code")));
    Object.keys(f).forEach(function (k) {
      if (k === "first") { box.appendChild(h("label", { class: "sen-muted" }, f.first, " " + L("لأول طلب للزبون فقط", "First order only", "Première commande uniquement"))); return; }
      box.appendChild(f[k]);
    });
    box.appendChild(add);
    doc.body.appendChild(ov);
    load();
  }

  function setup(tries) {
    var nav = doc.getElementById("sideNav");
    if (!nav || doc.getElementById("sbPromos")) return;
    var tok = null; try { tok = localStorage.getItem("siymon_admin_token_v2"); } catch (e) {}
    if (!tok) { if (tries < 600) setTimeout(function () { setup(tries + 1); }, 2000); return; }
    api("/api/admin/me").then(function (me) {
      if (!me || !me.permissions || me.permissions.indexOf("*") < 0) return; // system_admin only
      if (doc.getElementById("sbPromos")) return;
      var btn = h("button", { class: "sb-item", id: "sbPromos", type: "button", "data-key": "promos" });
      btn.innerHTML = '<span class="sb-tile t-green"><svg class="sb-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z"/><circle cx="7" cy="7" r="1.5"/></svg></span>';
      var txt = h("span", { class: "sb-text" }, L("أكواد الخصم", "Discount codes", "Codes promo")); btn.appendChild(txt);
      btn.setAttribute("data-tip", txt.textContent);
      btn.addEventListener("click", function () { open(); doc.body.classList.remove("sb-open"); });
      nav.appendChild(btn);
    }).catch(function () { if (tries < 600) setTimeout(function () { setup(tries + 1); }, 2000); });
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", function () { setup(0); }); else setup(0);
})();

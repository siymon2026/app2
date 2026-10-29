/* global api, lang, toast */
/* Super-admin: business types manager + store profile (type, status, accounts, stats).
 * All data is inserted with textContent (no innerHTML) so names can't inject markup.
 * Authorization is enforced by the server (requireAdmin) — this is only the UI. */
(function () {
  "use strict";
  const L = (ar, en, fr) => (lang === "ar" ? ar : lang === "fr" ? fr || en : en);
  const nm = (o) => (o && typeof o === "object" ? o[lang] || o.ar || o.fr || o.en || "" : String(o || ""));

  function h(tag, props, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
      else if (k === "value") e.value = v;
      else if (k === "checked" || k === "disabled" || k === "selected") e[k] = !!v;
      else e.setAttribute(k, v === true ? "" : String(v));
    }
    for (const kid of kids.flat()) {
      if (kid === null || kid === undefined || kid === false) continue;
      e.appendChild(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return e;
  }
  const clear = (e) => { while (e.firstChild) e.removeChild(e.firstChild); return e; };
  const say = (m) => { try { toast(m); } catch (_e) { /* no-op */ } };
  const J = (o) => JSON.stringify(o);

  function overlay(content) {
    const ov = h("div", { class: "stx-ov", onclick: (e) => { if (e.target === ov) ov.remove(); } }, h("div", { class: "stx-box", role: "dialog", "aria-modal": "true" }, content));
    document.body.appendChild(ov);
    return ov;
  }

  const FLOW = {
    admin_review: L("مراجعة الإدارة أولاً", "Admin review first", "Validation admin d'abord"),
    direct: L("مباشرة للمحل", "Straight to the store", "Direct vers la boutique"),
  };
  const flowLabel = (f) => (f === "direct" ? L("مباشرة للمحل", "Straight to the store", "Direct vers la boutique") : L("مراجعة الإدارة أولاً", "Admin review first", "Validation admin d'abord"));
  const SECTION_LABEL = {
    dashboard: ["لوحة المعلومات", "Dashboard", "Tableau de bord"], orders_new: ["الطلبات الجديدة", "New orders", "Nouvelles commandes"], orders: ["جميع الطلبات", "All orders", "Toutes les commandes"],
    products: ["المنتجات", "Products", "Produits"], categories: ["الفئات", "Categories", "Catégories"], pricing: ["الأسعار والعروض", "Pricing", "Prix"], inventory: ["المخزون", "Inventory", "Stock"],
    customers: ["العملاء", "Customers", "Clients"], chat: ["المحادثات", "Chat", "Messages"], notifications: ["الإشعارات", "Notifications", "Notifications"], reports: ["التقارير", "Reports", "Rapports"],
    settings: ["إعدادات المتجر", "Settings", "Paramètres"], hours: ["ساعات العمل", "Hours", "Horaires"], delivery: ["التوصيل", "Delivery", "Livraison"], help: ["المساعدة", "Help", "Aide"],
  };
  const secLabel = (k) => L(...(SECTION_LABEL[k] || [k, k, k]));

  /* ------------------------------------------------------------ types manager */
  async function openTypesManager() {
    const body = h("div", {});
    const ov = overlay(body);
    const show = async () => {
      clear(body).appendChild(h("p", {}, L("جارٍ التحميل…", "Loading…", "Chargement…")));
      let data;
      try { data = await api("/api/admin/store-types", { method: "GET" }); }
      catch (e) { return clear(body).appendChild(h("p", { class: "stx-err" }, e.message)); }
      clear(body);
      body.appendChild(h("div", { class: "stx-head" }, h("h3", {}, "🧩 " + L("أنواع الأنشطة التجارية", "Business types", "Types d'activité")), h("span", { class: "sp" }),
        h("button", { class: "btn small", type: "button", onclick: () => edit(null, data) }, "＋ " + L("نوع جديد", "New type", "Nouveau type")),
        h("button", { class: "btn ghost small", type: "button", onclick: () => ov.remove() }, "✕")));
      body.appendChild(h("div", { class: "stx-list" }, data.types.map((t) => h("div", { class: "stx-item" },
        h("span", { class: "ic" }, t.icon || "🏪"),
        h("div", { class: "grow" }, h("div", { class: "nm" }, nm(t.name) + (t.builtin ? "" : " ★")), h("small", {}, t.id + " · " + t.stores + " " + L("متجر", "stores", "boutiques"))),
        h("span", { class: "stx-tag " + t.flow }, flowLabel(t.flow)), t.enabled === false ? h("span", { class: "stx-tag off" }, L("معطّل", "Disabled", "Désactivé")) : null,
        h("label", { class: "st-check" }, h("input", { type: "checkbox", checked: t.enabled !== false, onchange: async (e) => {
          try { await api("/api/admin/store-types/" + encodeURIComponent(t.id), { method: "PUT", body: J({ enabled: e.target.checked }) }); say("✅"); show(); reloadTypes(); }
          catch (er) { say(er.message); e.target.checked = !e.target.checked; }
        } }), L("مفعّل", "Enabled", "Activé")),
        h("button", { class: "btn ghost small", type: "button", onclick: () => edit(t, data) }, L("تعديل", "Edit", "Modifier")),
        !t.builtin && !t.stores ? h("button", { class: "btn ghost small", type: "button", onclick: async () => {
          if (!confirm(L("حذف هذا النوع؟", "Delete this type?", "Supprimer ce type ?"))) return;
          try { await api("/api/admin/store-types/" + encodeURIComponent(t.id), { method: "DELETE" }); say("✅"); show(); reloadTypes(); } catch (er) { say(er.message); }
        } }, L("حذف", "Delete", "Supprimer")) : null))));
      body.appendChild(h("p", { class: "st-hint" }, L("الأنواع الأساسية لا تُحذف لكن يمكن تعطيلها. النوع المستخدم من متجر لا يُحذف.", "Built-in types can't be deleted (disable them instead). A type used by a store can't be deleted.", "Les types intégrés ne peuvent pas être supprimés (désactivez-les). Un type utilisé ne peut pas être supprimé.")));
    };

    function edit(t, data) {
      const isNew = !t;
      const cur = t || { id: "", icon: "🏪", name: { ar: "", fr: "", en: "" }, flow: "direct", sections: ["dashboard", "orders_new", "orders", "products", "customers", "chat", "settings", "help"], productFields: [], enabled: true };
      const inp = (v, ph, extra) => h("input", Object.assign({ value: v || "", placeholder: ph || "", maxlength: "60" }, extra || {}));
      const id = inp(cur.id, "toys", { disabled: !isNew, dir: "ltr" }), icon = inp(cur.icon, "🏪", { maxlength: "8" });
      const nAr = inp(cur.name && cur.name.ar), nFr = inp(cur.name && cur.name.fr), nEn = inp(cur.name && cur.name.en);
      const flow = h("select", {}, ["direct", "admin_review"].map((f) => h("option", { value: f, selected: cur.flow === f }, flowLabel(f))));
      const secBoxes = data.sections.map((k) => ({ k, cb: h("input", { type: "checkbox", checked: (cur.sections || []).includes(k) || k === "dashboard", disabled: k === "dashboard" }) }));
      const fldBox = h("div", {});
      const rows = [];
      const addRow = (f) => {
        f = f || { key: "", kind: "text", label: { ar: "", fr: "" }, options: [], required: false };
        const r = {
          key: h("input", { value: f.key, placeholder: "key", dir: "ltr", maxlength: "30" }),
          ar: h("input", { value: (f.label && f.label.ar) || "", placeholder: L("التسمية (عربي)", "Label (AR)", "Libellé (AR)") }),
          fr: h("input", { value: (f.label && f.label.fr) || "", placeholder: L("التسمية (فرنسي)", "Label (FR)", "Libellé (FR)") }),
          kind: h("select", {}, ["text", "number", "bool", "select"].map((k) => h("option", { value: k, selected: f.kind === k }, k))),
          opts: h("input", { value: (f.options || []).join(","), placeholder: L("خيارات مفصولة بفاصلة", "options, comma separated", "options séparées par virgule") }),
          req: h("input", { type: "checkbox", checked: !!f.required }),
        };
        r.el = h("div", { class: "stx-fld" }, r.key, r.ar, r.fr, r.kind, r.opts, h("label", {}, r.req, " *"), h("button", { class: "btn ghost small", type: "button", onclick: () => { rows.splice(rows.indexOf(r), 1); r.el.remove(); } }, "✕"));
        rows.push(r); fldBox.appendChild(r.el);
      };
      (cur.productFields || []).forEach(addRow);
      const err = h("div", { class: "stx-err", role: "alert" });
      const save = async () => {
        err.textContent = "";
        const payload = {
          id: id.value.trim(), icon: icon.value.trim(), name: { ar: nAr.value.trim(), fr: nFr.value.trim(), en: nEn.value.trim() },
          flow: flow.value, enabled: cur.enabled !== false, sections: secBoxes.filter((x) => x.cb.checked).map((x) => x.k),
          productFields: rows.filter((r) => r.key.value.trim()).map((r) => ({
            key: r.key.value.trim(), kind: r.kind.value, required: r.req.checked, label: { ar: r.ar.value.trim() || r.key.value.trim(), fr: r.fr.value.trim() || r.ar.value.trim() || r.key.value.trim() },
            options: r.opts.value.split(",").map((x) => x.trim()).filter(Boolean),
          })),
        };
        try {
          await api(isNew ? "/api/admin/store-types" : "/api/admin/store-types/" + encodeURIComponent(cur.id), { method: isNew ? "POST" : "PUT", body: J(payload) });
          say("✅ " + L("تم الحفظ", "Saved", "Enregistré")); reloadTypes(); show();
        } catch (e) { err.textContent = e.message; }
      };
      clear(body);
      body.appendChild(h("div", {},
        h("div", { class: "stx-head" }, h("h3", {}, isNew ? L("نوع جديد", "New type", "Nouveau type") : L("تعديل النوع", "Edit type", "Modifier le type")), h("span", { class: "sp" })),
        h("div", { class: "stx-grid" }, h("div", {}, h("label", {}, "ID"), id), h("div", {}, h("label", {}, L("الأيقونة", "Icon", "Icône")), icon), h("div", {}, h("label", {}, L("الاسم (عربي)", "Name (AR)", "Nom (AR)")), nAr),
          h("div", {}, h("label", {}, L("الاسم (فرنسي)", "Name (FR)", "Nom (FR)")), nFr), h("div", {}, h("label", {}, L("الاسم (إنجليزي)", "Name (EN)", "Nom (EN)")), nEn),
          h("div", {}, h("label", {}, L("مسار الطلب", "Order flow", "Flux des commandes")), flow)),
        h("h4", {}, L("القوائم الظاهرة لصاحب المحل", "Sections shown to the store", "Rubriques visibles")),
        h("div", { class: "stx-chips" }, secBoxes.map((x) => h("label", {}, x.cb, secLabel(x.k)))),
        h("h4", {}, L("حقول المنتج الخاصة بهذا النوع", "Product fields for this type", "Champs produit pour ce type")), fldBox,
        h("button", { class: "btn ghost small", type: "button", onclick: () => addRow() }, "＋ " + L("حقل", "Field", "Champ")), err,
        h("div", { class: "stx-foot" }, h("button", { class: "btn ghost", type: "button", onclick: show }, L("رجوع", "Back", "Retour")), h("button", { class: "btn", type: "button", onclick: save }, L("حفظ", "Save", "Enregistrer")))));
    }
    show();
  }

  function reloadTypes() { if (typeof window.storesReloadTypes === "function") window.storesReloadTypes(); }

  /* ------------------------------------------------------------ store profile */
  async function openProfile(storeId) {
    const body = h("div", {});
    const ov = overlay(body);
    const show = async () => {
      clear(body).appendChild(h("p", {}, L("جارٍ التحميل…", "Loading…", "Chargement…")));
      let d;
      try { d = await api("/api/admin/stores/" + encodeURIComponent(storeId) + "/overview", { method: "GET" }); }
      catch (e) { return clear(body).appendChild(h("p", { class: "stx-err" }, e.message)); }
      const s = d.stats, st = d.store;
      const stat = (label, val) => h("div", { class: "stx-stat" }, h("b", {}, String(val)), h("small", {}, label));
      const money = (n) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 }) + " MAD";
      const roleSel = (u) => h("select", { onchange: async (e) => { try { await api("/api/admin/restaurant-users/" + encodeURIComponent(u.id), { method: "PATCH", body: J({ role: e.target.value }) }); say("✅"); } catch (er) { say(er.message); show(); } } },
        ["owner", "manager", "cashier"].map((r) => h("option", { value: r, selected: u.role === r }, r)));
      const email = h("input", { type: "email", placeholder: "email", dir: "ltr" }), phone = h("input", { placeholder: L("هاتف", "phone", "téléphone"), dir: "ltr", inputmode: "tel" });
      const pw = h("input", { type: "password", placeholder: L("كلمة مرور (6+)", "password (6+)", "mot de passe (6+)"), autocomplete: "new-password" });
      const role = h("select", {}, ["owner", "manager", "cashier"].map((r) => h("option", { value: r }, r)));
      const err = h("div", { class: "stx-err", role: "alert" });
      clear(body);
      body.appendChild(h("div", {},
        h("div", { class: "stx-head" }, h("h3", {}, `${(d.type && d.type.icon) || "🏪"} ${nm(st.name)}`), h("span", { class: "sp" }), h("button", { class: "btn ghost small", type: "button", onclick: () => ov.remove() }, "✕")),
        h("p", {}, h("span", { class: "stx-tag " + ((d.type && d.type.flow) || "") }, d.type ? nm(d.type.name) : ""), h("span", { class: "stx-tag" }, flowLabel(d.type && d.type.flow)), h("span", { class: "stx-tag" }, String(st.status || "")), " ", st.city || "", " ", st.phone || ""),
        h("h4", {}, L("آخر 30 يوماً", "Last 30 days", "30 derniers jours")),
        h("div", { class: "stx-stats" }, stat(L("طلبات جديدة", "New orders", "Nouvelles"), s.newOrders), stat(L("قيد التحضير", "Preparing", "En préparation"), s.preparingOrders), stat(L("مكتملة", "Completed", "Terminées"), s.completedOrders),
          stat(L("قيمة الطلبات", "Orders value", "Valeur"), money(s.ordersValue)), stat(L("المبيعات الفعلية", "Actual sales", "Ventes réelles"), money(s.sales)), stat(L("المنتجات", "Products", "Produits"), s.productsTotal),
          stat(L("غير متوفرة", "Unavailable", "Indisponibles"), s.unavailableProducts), stat(L("مخزون منخفض", "Low stock", "Stock faible"), s.lowStockProducts), stat(L("العملاء", "Customers", "Clients"), s.customers), stat(L("رسائل غير مقروءة", "Unread", "Non lus"), s.unreadMessages)),
        h("h4", {}, L("حسابات المتجر", "Store accounts", "Comptes")),
        d.accounts.length ? h("div", { style: "overflow-x:auto" }, h("table", { class: "stx-table" }, h("tbody", {}, d.accounts.map((u) => h("tr", {},
          h("td", { dir: "ltr" }, u.email || u.phone || "—"), h("td", {}, roleSel(u)),
          h("td", {}, h("label", { class: "st-check" }, h("input", { type: "checkbox", checked: u.isActive, onchange: async (e) => { try { await api("/api/admin/restaurant-users/" + encodeURIComponent(u.id), { method: "PATCH", body: J({ isActive: e.target.checked }) }); say("✅"); } catch (er) { say(er.message); e.target.checked = !e.target.checked; } } }), L("فعّال", "Active", "Actif"))),
          h("td", {}, h("button", { class: "btn ghost small", type: "button", onclick: async () => {
            const p = prompt(L("كلمة المرور الجديدة (6 أحرف على الأقل)", "New password (min 6 chars)", "Nouveau mot de passe (min 6)"));
            if (!p) return; if (p.length < 6) return say(L("قصيرة جداً", "Too short", "Trop court"));
            try { await api("/api/admin/restaurant-users/" + encodeURIComponent(u.id), { method: "PATCH", body: J({ password: p }) }); say("✅"); } catch (er) { say(er.message); }
          } }, L("تغيير كلمة المرور", "Reset password", "Réinitialiser"))))))))
          : h("p", { class: "st-hint" }, L("لا توجد حسابات بعد — أضف حساب المالك أدناه.", "No accounts yet — add the owner below.", "Aucun compte — ajoutez le propriétaire ci-dessous.")),
        h("h4", {}, L("إضافة حساب", "Add account", "Ajouter un compte")),
        h("div", { class: "stx-grid" }, h("div", {}, email), h("div", {}, phone), h("div", {}, pw), h("div", {}, role)), err,
        h("div", { class: "stx-foot" }, h("button", { class: "btn small", type: "button", onclick: async () => {
          err.textContent = "";
          const b = { restaurantId: storeId, password: pw.value, role: role.value };
          if (email.value.trim()) b.email = email.value.trim(); if (phone.value.trim()) b.phone = phone.value.trim();
          try { await api("/api/admin/restaurant-users", { method: "POST", body: J(b) }); say("✅"); show(); } catch (e) { err.textContent = e.message; }
        } }, "＋ " + L("إضافة", "Add", "Ajouter"))),
        h("p", { class: "st-hint" }, L("نفس البريد/الهاتف وكلمة المرور في متجرين = حساب واحد يدير المتجرين.", "Same email/phone and password in two stores = one login managing both.", "Même e-mail/téléphone et mot de passe dans deux boutiques = une seule connexion."))));
    };
    show();
  }

  document.addEventListener("click", (e) => {
    const t = e.target.closest && e.target.closest("[data-action='store-profile'],#stTypesBtn");
    if (!t) return;
    if (t.id === "stTypesBtn") openTypesManager();
    else openProfile(t.getAttribute("data-id"));
  });
  window.openStoreTypesManager = openTypesManager;
  window.openStoreProfile = openProfile;
})();

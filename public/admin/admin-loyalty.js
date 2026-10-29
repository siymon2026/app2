/* global api, toast */
/* "إدارة نقاط الوفاء" — loyalty programme + customer points/wallet administration.
 *
 * The server is the only authority:
 *   - reading needs loyalty.read,
 *   - adjusting points needs loyalty.adjust,
 *   - changing the rules needs loyalty.settings (never granted by default),
 *   - adjusting wallet balance needs wallet.adjust.
 * This page only *hides* what a role cannot do; every endpoint re-checks the role,
 * and every change is written to the audit log (actor, time, before/after, reason). */
(function () {
  "use strict";
  var doc = document;
  var L = window.adminPageElements.L, h = window.adminPageElements.h;
  var say = function (m) { try { toast(m); } catch (e) {} };
  function lang() { return (doc.documentElement.lang || "ar").slice(0, 2); }
  function can(p) { return !!(window.adminPerms && window.adminPerms.can(p)); }
  function money(v) { return (Math.round((Number(v) || 0) * 100) / 100).toFixed(2); }
  function input(type, value, extra) {
    var e = h("input", Object.assign({ class: "sen-search", type: type, autocomplete: "off" }, extra || {}));
    if (type === "checkbox") e.checked = !!value; else e.value = value == null ? "" : value;
    return e;
  }
  function row(label, el) { return h("div", { class: "sen-field" }, h("label", { class: "sen-muted" }, label), el); }
  function errText(e) {
    var c = e && e.body && e.body.code;
    var M = {
      VERSION_CONFLICT: L("تم التعديل من مستخدم آخر — أعد التحميل", "Changed by someone else — reload", "Modifié par quelqu'un d'autre — rechargez"),
      UNKNOWN_SETTING: L("إعداد غير معروف", "Unknown setting", "Paramètre inconnu"),
      INVALID_SETTING: L("قيمة غير صالحة", "Invalid value", "Valeur invalide"),
      REASON_REQUIRED: L("السبب إلزامي", "A reason is required", "Motif obligatoire"),
      BAD_POINTS: L("عدد نقاط غير صالح", "Invalid points", "Points invalides"),
      INSUFFICIENT_POINTS: L("النقاط المتاحة لا تكفي (لن يُنشأ رصيد سالب)", "Not enough points (no negative balance allowed)", "Points insuffisants (solde négatif interdit)"),
      NOT_FOUND: L("غير موجود", "Not found", "Introuvable"),
    };
    return (M[c] || (e && e.message) || "Error") + (e && e.body && e.body.available != null ? " — " + L("المتاح", "available", "disponible") + ": " + e.body.available : "");
  }

  /* ------------------------------------------------------------------ sink */
  var root = null;
  function box(title, close) {
    var b = h("div", { class: "modal-card sen-box", role: "region" });
    b.appendChild(h("div", { class: "sen-head" }, h("h3", {}, title),
      h("button", { class: "sen-x", type: "button", "aria-label": L("إغلاق", "Close", "Fermer"), onclick: function () { if (close) close(); } }, "✕")));
    return b;
  }

  /* -------------------------------------------------------------- settings */
  function settingsPanel(settings, canEdit, reload) {
    var wrap = h("div", { class: "loy-settings" });
    wrap.appendChild(h("h4", {}, L("إعدادات البرنامج والقواعد", "Programme settings and rules", "Paramètres et règles du programme")));
    if (!canEdit) wrap.appendChild(h("p", { class: "sen-muted" }, L("عرض فقط — لا تملك صلاحية تعديل القواعد.", "Read-only — you cannot change the rules.", "Lecture seule — vous ne pouvez pas modifier les règles.")));

    var on = input("checkbox", settings.enabled);
    var earnOn = input("checkbox", settings.earn.enabled);
    var unit = input("number", settings.earn.unitAmount, { min: "0.01", step: "any" });
    var perUnit = input("number", settings.earn.pointsPerUnit, { min: "0.01", step: "any" });
    var base = h("select", { class: "sen-search" });
    [["paid", L("المبلغ المدفوع فعليًا", "Amount actually paid", "Montant réellement payé")],
     ["subtotal", L("قيمة المنتجات قبل الخصم", "Items value before discount", "Articles avant remise")],
     ["total", L("إجمالي الطلب", "Order total", "Total de la commande")]].forEach(function (o) {
      var op = h("option", { value: o[0] }, o[1]); base.appendChild(op);
    });
    base.value = settings.earn.base;
    var withDelivery = input("checkbox", settings.earn.includeDeliveryFee);
    var afterDiscount = input("checkbox", !settings.earn.includeDiscount);
    var minOrder = input("number", settings.earn.minOrderAmount, { min: "0", step: "any" });
    var capOrder = input("number", settings.earn.maxPointsPerOrder, { min: "0", step: "1" });
    var capDay = input("number", settings.earn.maxPointsPerDay, { min: "0", step: "1" });
    var holdDays = input("number", settings.earn.pendingDays, { min: "0", step: "1" });

    var redeemOn = input("checkbox", settings.redeem.enabled);
    var minPoints = input("number", settings.redeem.minPoints, { min: "1", step: "1" });
    var perCurrency = input("number", settings.redeem.pointsPerCurrencyUnit, { min: "1", step: "1" });
    var maxTx = input("number", settings.redeem.maxPointsPerTx, { min: "0", step: "1" });
    var maxDay = input("number", settings.redeem.maxPointsPerDay, { min: "0", step: "1" });
    var expiryOn = input("checkbox", settings.expiry.enabled);
    var expiryDays = input("number", settings.expiry.days, { min: "1", step: "1" });

    var fields = h("div", { class: "loy-grid" },
      row(L("البرنامج مفعّل", "Programme enabled", "Programme activé"), on),
      row(L("احتساب النقاط مفعّل", "Earning enabled", "Gain activé"), earnOn),
      row(L("مبلغ الوحدة (درهم)", "Unit amount (MAD)", "Montant unitaire (MAD)"), unit),
      row(L("نقاط لكل وحدة", "Points per unit", "Points par unité"), perUnit),
      row(L("أساس الاحتساب", "Earning base", "Base de calcul"), base),
      row(L("شامل رسوم التوصيل", "Include delivery fee", "Inclure la livraison"), withDelivery),
      row(L("بعد الخصومات", "Apply after discounts", "Après remises"), afterDiscount),
      row(L("حد أدنى للطلب", "Minimum order", "Commande minimum"), minOrder),
      row(L("سقف نقاط لكل طلب", "Max points per order", "Points max par commande"), capOrder),
      row(L("سقف نقاط يومي", "Max points per day", "Points max par jour"), capDay),
      row(L("أيام التعليق قبل الإتاحة", "Hold days before available", "Jours d'attente avant disponibilité"), holdDays),
      row(L("التحويل مفعّل", "Conversion enabled", "Conversion activée"), redeemOn),
      row(L("حد أدنى للتحويل (نقاط)", "Minimum conversion (points)", "Minimum de conversion (points)"), minPoints),
      row(L("نقاط لكل 1 درهم", "Points per 1 MAD", "Points par 1 MAD"), perCurrency),
      row(L("سقف لكل عملية (نقاط)", "Max per conversion (points)", "Max par conversion (points)"), maxTx),
      row(L("سقف يومي للتحويل", "Daily conversion cap", "Plafond journalier"), maxDay),
      row(L("تفعيل انتهاء الصلاحية", "Expiry enabled", "Expiration activée"), expiryOn),
      row(L("صلاحية النقاط (أيام)", "Validity (days)", "Validité (jours)"), expiryDays)
    );
    if (!canEdit) fields.querySelectorAll("input,select").forEach(function (el) { el.disabled = true; });
    wrap.appendChild(fields);

    // campaigns
    var camps = (settings.campaigns || []).slice();
    var campBox = h("div", {});
    function renderCamps() {
      campBox.replaceChildren();
      camps.forEach(function (c, i) {
        if (!c.id) c.id = "camp_" + (i + 1);
        var name = input("text", c.name || "", { placeholder: L("اسم الحملة", "Campaign name", "Nom de la campagne") });
        var bonus = input("number", c.points != null ? c.points : c.bonusPoints || 0, { min: "1", step: "1" });
        var active = input("checkbox", c.active !== false);
        name.addEventListener("input", function () { camps[i].name = name.value; });
        bonus.addEventListener("input", function () { camps[i].points = Number(bonus.value) || 0; });
        active.addEventListener("change", function () { camps[i].active = active.checked; });
        campBox.appendChild(h("div", { class: "sen-row" },
          h("div", { class: "sen-name" }, name, bonus, h("small", {}, L("نقاط إضافية", "bonus points", "points bonus"))),
          h("div", { class: "sen-acts" }, active,
            h("button", { class: "sen-btn", type: "button", onclick: function () { camps.splice(i, 1); renderCamps(); } }, L("حذف", "Remove", "Supprimer")))));
      });
      campBox.appendChild(h("button", { class: "sen-btn", type: "button", onclick: function () { camps.push({ id: "camp_" + Date.now().toString(36), name: "", points: 10, active: true }); renderCamps(); } }, L("+ حملة", "+ Campaign", "+ Campagne")));
    }
    renderCamps();
    wrap.appendChild(h("h4", {}, L("الحملات والمكافآت", "Campaigns and bonuses", "Campagnes et bonus")));
    wrap.appendChild(h("p", { class: "sen-muted" }, L("تُعلن الحملات للزبائن في صفحة المحفظة عندما تكون مفعّلة.", "Active campaigns are announced on the wallet page.", "Les campagnes actives sont annoncées sur la page portefeuille.")));
    wrap.appendChild(campBox);
    if (!canEdit) campBox.querySelectorAll("input,button").forEach(function (el) { el.disabled = true; });

    // terms in 3 languages
    var terms = {};
    var termsBox = h("div", {});
    ["ar", "fr", "en"].forEach(function (l) {
      var ta = h("textarea", { class: "sen-search", rows: "3", placeholder: l.toUpperCase() });
      ta.value = (settings.terms && settings.terms[l]) || "";
      terms[l] = ta; termsBox.appendChild(ta);
      ta.disabled = !canEdit;
    });
    wrap.appendChild(h("h4", {}, L("شروط إضافية تظهر للزبون", "Extra terms shown to customers", "Conditions supplémentaires")));
    wrap.appendChild(termsBox);

    // preview
    var previewBox = h("div", { class: "loy-preview" });
    wrap.appendChild(h("h4", {}, L("معاينة ما يراه الزبون (قبل النشر)", "Customer preview (before publishing)", "Aperçu client (avant publication)")));
    wrap.appendChild(previewBox);
    var previewBtn = h("button", { class: "sen-btn", type: "button" }, L("تحديث المعاينة", "Refresh preview", "Actualiser l'aperçu"));
    wrap.appendChild(previewBtn);

    function body() {
      return {
        expectedVersion: settings.version,
        enabled: on.checked,
        earn: {
          enabled: earnOn.checked, unitAmount: Number(unit.value), pointsPerUnit: Number(perUnit.value),
          base: base.value, includeDeliveryFee: withDelivery.checked, includeDiscount: !afterDiscount.checked,
          minOrderAmount: Number(minOrder.value) || 0, maxPointsPerOrder: Number(capOrder.value) || 0,
          maxPointsPerDay: capDay.value === "" ? 0 : Number(capDay.value), pendingDays: Number(holdDays.value) || 0,
        },
        redeem: {
          enabled: redeemOn.checked, minPoints: Number(minPoints.value), pointsPerCurrencyUnit: Number(perCurrency.value),
          maxPointsPerTx: Number(maxTx.value) || 0, maxPointsPerDay: Number(maxDay.value) || 0,
        },
        expiry: { enabled: expiryOn.checked, days: Number(expiryDays.value) || 0 },
        campaigns: camps
          .filter(function (c) { return String(c.name || "").trim() && Number(c.points) > 0; })
          .map(function (c) { return { id: c.id, name: String(c.name).trim(), points: Number(c.points), active: c.active !== false }; }),
        terms: { ar: terms.ar.value, fr: terms.fr.value, en: terms.en.value },
      };
    }
    // Real preview: the draft is validated by the server (nothing is saved) and the
    // customer-facing texts are generated with the SAME code the customer page uses.
    function preview() {
      api("/api/admin/loyalty/preview", { method: "POST", body: JSON.stringify(body()) }).then(function (r) {
        previewBox.replaceChildren();
        ["ar", "fr", "en"].forEach(function (l) {
          var p = r.preview[l];
          previewBox.appendChild(h("div", { class: "loy-term" },
            h("b", {}, l.toUpperCase()),
            h("p", {}, p.earn.rule),
            h("p", { class: "sen-muted" }, p.terms),
            h("p", { class: "sen-muted" }, L("الحد الأدنى للتحويل", "Minimum conversion", "Minimum de conversion") + ": " + p.redeem.minPoints + " " + L("نقطة", "points", "points") + " · " + p.redeem.pointsPerCurrencyUnit + " = 1 MAD · " + L("الصلاحية", "validity", "validité") + ": " + (p.expiry.enabled ? p.expiry.days + " j" : "—"))));
        });
      }).catch(function (e) { previewBox.replaceChildren(h("p", { class: "sen-muted" }, "❌ " + errText(e))); });
    }
    previewBtn.addEventListener("click", preview);
    wrap.appendChild(h("div", { style: "margin-top:12px;display:flex;gap:10px;flex-wrap:wrap" },
      h("button", {
        class: "sen-btn primary", type: "button", disabled: !canEdit,
        onclick: function (ev) {
          if (!canEdit) return;
          var wasOn = !!settings.enabled;
          if (wasOn && !on.checked && !confirm(L("إيقاف البرنامج يوقف كسب النقاط فقط؛ أرصدة الزبائن وسجلاتهم تبقى محفوظة. تأكيد؟",
            "Turning the programme off only stops earning; customer balances and history are kept. Confirm?",
            "Désactiver le programme arrête uniquement le gain ; les soldes et l'historique sont conservés. Confirmer ?"))) return;
          ev.target.disabled = true;
          api("/api/admin/loyalty/settings", { method: "PUT", body: JSON.stringify(body()) })
            .then(function () { say("✅ " + L("تم الحفظ", "Saved", "Enregistré")); preview(); reload(); })
            .catch(function (e) { ev.target.disabled = false; say("❌ " + errText(e)); });
        },
      }, L("نشر الإعدادات", "Publish settings", "Publier les paramètres"))));

    preview();
    return wrap;
  }

  /* -------------------------------------------------------------- customer */
  function detailPanel(customerId, back) {
    var wrap = h("div", { class: "loy-detail" }, h("p", { class: "sen-muted" }, "…"));
    function load() {
      api("/api/admin/loyalty/customers/" + encodeURIComponent(customerId)).then(function (r) {
        wrap.replaceChildren();
        wrap.appendChild(h("div", { class: "sen-head" },
          h("h3", {}, r.customer.name || r.customer.id),
          h("button", { class: "sen-x", type: "button", "aria-label": L("رجوع", "Back", "Retour"), onclick: back }, "✕")));
        wrap.appendChild(h("p", { class: "sen-muted" }, [r.customer.id, r.customer.phone, r.customer.email].filter(Boolean).join(" · ")));

        var b = r.loyalty.balances;
        wrap.appendChild(h("div", { class: "loy-stat-row" },
          h("div", { class: "loy-stat" }, h("span", {}, L("النقاط المتاحة", "Available points", "Points disponibles")), h("b", {}, String(b.available))),
          h("div", { class: "loy-stat" }, h("span", {}, L("قيد التأكيد", "Pending", "En attente")), h("b", {}, String(b.pending))),
          h("div", { class: "loy-stat" }, h("span", {}, L("المستخدمة", "Used", "Utilisés")), h("b", {}, String(b.used))),
          h("div", { class: "loy-stat" }, h("span", {}, L("المنتهية", "Expired", "Expirés")), h("b", {}, String(b.expired))),
          h("div", { class: "loy-stat" }, h("span", {}, L("رصيد المحفظة", "Wallet balance", "Solde portefeuille")), h("b", {}, money(r.wallet.balance) + " " + r.wallet.currency))));
        if (r.reconcile && r.reconcile.diff) {
          wrap.appendChild(h("p", { class: "sen-muted", style: "color:#b45309" },
            "⚠ " + L("عدم تطابق بين الرصيد والسجل", "Balance/ledger mismatch", "Écart solde/journal") + ": " + money(r.reconcile.diff)));
        }

        /* adjust points */
        if (r.canAdjustPoints) {
          var dir = h("select", { class: "sen-search" },
            h("option", { value: "credit" }, L("إضافة نقاط", "Add points", "Ajouter des points")),
            h("option", { value: "debit" }, L("خصم نقاط", "Deduct points", "Déduire des points")));
          var pts = input("number", "", { min: "1", step: "1", placeholder: L("عدد النقاط", "Points", "Points") });
          var reason = input("text", "", { placeholder: L("السبب (إلزامي)", "Reason (required)", "Motif (obligatoire)"), maxlength: "160" });
          var refInput = input("text", "", { placeholder: L("مرجع اختياري", "Optional reference", "Référence (optionnel)"), maxlength: "60" });
          var go = h("button", { class: "sen-btn primary", type: "button" }, L("تنفيذ التعديل", "Apply adjustment", "Appliquer"));
          go.addEventListener("click", function () {
            var body = { direction: dir.value, points: Number(pts.value), reason: reason.value.trim(), reference: refInput.value.trim() || undefined };
            if (!body.reason) { say("❌ " + L("السبب إلزامي", "A reason is required", "Motif obligatoire")); return; }
            if (!(body.points > 0)) { say("❌ " + L("أدخل عدد نقاط صحيح", "Enter valid points", "Points invalides")); return; }
            var verb = dir.value === "credit" ? L("إضافة", "add", "ajouter") : L("خصم", "deduct", "déduire");
            if (!confirm(verb + " " + body.points + " " + L("نقطة", "points", "points") + " — " + body.reason + "؟")) return;
            go.disabled = true;
            api("/api/admin/loyalty/customers/" + encodeURIComponent(customerId) + "/adjust", { method: "POST", body: JSON.stringify(body) })
              .then(function (res) { say("✅ " + L("تم التعديل", "Adjusted", "Ajusté") + (res.duplicate ? " (" + L("مكرر", "duplicate", "doublon") + ")" : "")); load(); })
              .catch(function (e) { go.disabled = false; say("❌ " + errText(e)); });
          });
          wrap.appendChild(h("h4", {}, L("تعديل يدوي للنقاط", "Manual points adjustment", "Ajustement manuel des points")));
          wrap.appendChild(h("div", { class: "loy-grid" }, row(L("الاتجاه", "Direction", "Sens"), dir), row(L("النقاط", "Points", "Points"), pts),
            row(L("السبب", "Reason", "Motif"), reason), row(L("المرجع", "Reference", "Référence"), refInput)));
          wrap.appendChild(go);
        }

        /* adjust wallet */
        if (r.canAdjustWallet) {
          var wdir = h("select", { class: "sen-search" },
            h("option", { value: "credit" }, L("إضافة رصيد", "Add balance", "Ajouter du solde")),
            h("option", { value: "debit" }, L("خصم رصيد", "Deduct balance", "Déduire du solde")));
          var amt = input("number", "", { min: "0.01", step: "any", placeholder: "MAD" });
          var wreason = input("text", "", { placeholder: L("السبب (إلزامي)", "Reason (required)", "Motif (obligatoire)"), maxlength: "160" });
          var wgo = h("button", { class: "sen-btn primary", type: "button" }, L("تنفيذ", "Apply", "Appliquer"));
          wgo.addEventListener("click", function () {
            var body = { direction: wdir.value, amount: Number(amt.value), reason: wreason.value.trim() };
            if (!body.reason) { say("❌ " + L("السبب إلزامي", "A reason is required", "Motif obligatoire")); return; }
            if (!(body.amount > 0)) { say("❌ " + L("أدخل مبلغًا صحيحًا", "Enter a valid amount", "Montant invalide")); return; }
            if (!confirm(body.direction + " " + money(body.amount) + " — " + body.reason + "؟")) return;
            wgo.disabled = true;
            api("/api/admin/customers/" + encodeURIComponent(customerId) + "/wallet-adjust", { method: "POST", body: JSON.stringify(body) })
              .then(function () { say("✅"); load(); })
              .catch(function (e) { wgo.disabled = false; say("❌ " + errText(e)); });
          });
          wrap.appendChild(h("h4", {}, L("تعديل رصيد المحفظة", "Wallet balance adjustment", "Ajustement du solde")));
          wrap.appendChild(h("div", { class: "loy-grid" }, row(L("الاتجاه", "Direction", "Sens"), wdir), row(L("المبلغ", "Amount", "Montant"), amt),
            row(L("السبب", "Reason", "Motif"), wreason)));
          wrap.appendChild(wgo);
        }

        /* points ledger */
        wrap.appendChild(h("h4", {}, L("سجل النقاط", "Points ledger", "Journal des points")));
        var pl = h("div", { class: "sen-list" });
        (r.loyalty.entries || []).slice(0, 60).forEach(function (e) {
          pl.appendChild(h("div", { class: "sen-row" },
            h("div", { class: "sen-name" }, h("b", {}, (e.direction === "credit" ? "+" : "−") + e.points + " " + L("نقطة", "pts", "pts") + " · " + e.kind),
              h("small", {}, [e.reason, e.orderId ? "#" + e.orderId : "", e.at ? String(e.at).slice(0, 16).replace("T", " ") : ""].filter(Boolean).join(" · "))),
            h("div", { class: "sen-acts" }, h("span", { class: "sen-muted" }, e.status || ""))));
        });
        if (!(r.loyalty.entries || []).length) pl.appendChild(h("p", { class: "sen-muted" }, L("لا يوجد سجل بعد", "No history yet", "Aucun historique")));
        wrap.appendChild(pl);

        /* wallet ledger */
        wrap.appendChild(h("h4", {}, L("حركات المحفظة", "Wallet transactions", "Mouvements du portefeuille")));
        var wl = h("div", { class: "sen-list" });
        (r.transactions || []).slice(0, 60).forEach(function (tx) {
          wl.appendChild(h("div", { class: "sen-row" },
            h("div", { class: "sen-name" }, h("b", {}, (tx.direction === "credit" ? "+" : "−") + money(tx.amount) + " " + (tx.currency || "MAD") + " · " + tx.type),
              h("small", {}, [tx.at ? String(tx.at).slice(0, 16).replace("T", " ") : "", tx.reference, tx.orderId ? "#" + tx.orderId : "", tx.note].filter(Boolean).join(" · "))),
            h("div", { class: "sen-acts" }, h("span", { class: "sen-muted" }, tx.status))));
        });
        if (!(r.transactions || []).length) wl.appendChild(h("p", { class: "sen-muted" }, L("لا توجد حركات", "No transactions", "Aucun mouvement")));
        wrap.appendChild(wl);
      }).catch(function (e) { wrap.replaceChildren(h("p", { class: "sen-muted" }, "❌ " + errText(e))); });
    }
    load();
    return wrap;
  }

  /* ---------------------------------------------------------------- search */
  function customersPanel() {
    var wrap = h("div", { class: "loy-customers" });
    var q = input("search", "", { placeholder: L("ابحث بالمعرّف أو الهاتف أو البريد", "Search by id, phone or email", "Rechercher par id, téléphone ou email") });
    var out = h("div", { class: "sen-list" });
    var host = h("div", {});
    wrap.appendChild(h("h4", {}, L("إدارة أرصدة الزبائن", "Customer balances", "Soldes clients")));
    wrap.appendChild(q);
    wrap.appendChild(out);
    wrap.appendChild(host);

    var timer = null;
    function search() {
      api("/api/admin/loyalty/customers?q=" + encodeURIComponent(q.value.trim())).then(function (r) {
        out.replaceChildren();
        (r.customers || []).forEach(function (c) {
          out.appendChild(h("div", { class: "sen-row" },
            h("div", { class: "sen-name" }, h("b", {}, c.name || c.id),
              h("small", {}, [c.phone, c.email, L("نقاط", "pts", "pts") + ": " + c.points.available + " · " + L("محفظة", "wallet", "portefeuille") + ": " + money(c.walletBalance)].filter(Boolean).join(" · "))),
            h("div", { class: "sen-acts" }, h("button", {
              class: "sen-btn", type: "button",
              onclick: function () { out.classList.add("hidden"); var d = detailPanel(c.id, function () { d.remove(); out.classList.remove("hidden"); }); host.replaceChildren(d); },
            }, L("فتح", "Open", "Ouvrir")))));
        });
        if (!(r.customers || []).length) out.appendChild(h("p", { class: "sen-muted" }, L("لا نتائج", "No results", "Aucun résultat")));
      }).catch(function (e) { out.replaceChildren(h("p", { class: "sen-muted" }, "❌ " + errText(e))); });
    }
    q.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(search, 350); });
    search();
    return wrap;
  }

  /* ------------------------------------------------------------------ open */
  function open() {
    var ov = doc.getElementById("loyaltyModal");
    root = h("div", { class: "modal-card sen-box", role: "region" });
    ov.replaceChildren(root);
    root.appendChild(h("div", { class: "sen-head" },
      h("h3", {}, L("إدارة نقاط الوفاء", "Loyalty points management", "Gestion des points de fidélité")),
      h("button", { class: "sen-x", type: "button", "aria-label": L("إغلاق", "Close", "Fermer"), onclick: function () { window.showLoyalty(false); } }, "✕")));
    var body = h("div", {}, h("p", { class: "sen-muted" }, "…"));
    root.appendChild(body);

    api("/api/admin/loyalty/settings").then(function (r) {
      body.replaceChildren();
      var o = r.overview || {};
      body.appendChild(h("div", { class: "loy-stat-row" },
        h("div", { class: "loy-stat" }, h("span", {}, L("حسابات المشاركين", "Enrolled accounts", "Comptes inscrits")), h("b", {}, String(o.accounts || 0))),
        h("div", { class: "loy-stat" }, h("span", {}, L("نقاط متاحة", "Available points", "Points disponibles")), h("b", {}, String(o.availablePoints || 0))),
        h("div", { class: "loy-stat" }, h("span", {}, L("قيد التأكيد", "Pending points", "Points en attente")), h("b", {}, String(o.pendingPoints || 0))),
        h("div", { class: "loy-stat" }, h("span", {}, L("مستخدمة", "Used points", "Points utilisés")), h("b", {}, String(o.usedPoints || 0)))));

      body.appendChild(settingsPanel(r.settings, r.canEdit, open));

      if (can("loyalty.adjust")) {
        var sweep = h("button", { class: "sen-btn", type: "button" }, L("تسوية النقاط المستحقة والمنتهية", "Settle pending / expire due points", "Régler les points en attente / expirés"));
        sweep.addEventListener("click", function () {
          sweep.disabled = true;
          api("/api/admin/loyalty/sweep", { method: "POST", body: "{}" })
            .then(function (res) { say("✅ " + JSON.stringify(res.result || {})); open(); })
            .catch(function (e) { sweep.disabled = false; say("❌ " + errText(e)); });
        });
        body.appendChild(sweep);
      }

      body.appendChild(customersPanel());
      window.showLoyalty(true);
    }).catch(function (e) {
      body.replaceChildren(h("p", { class: "sen-muted" }, "❌ " + errText(e)));
      window.showLoyalty(true);
    });
  }

  function showLoyalty(show) {
    var m = doc.getElementById("loyaltyModal");
    m.classList.toggle("show", !!show);
    if (!show) m.replaceChildren();
    else if (!root || !m.contains(root)) root = m.firstChild;
  }
  window.showLoyalty = showLoyalty;

  var btn = doc.getElementById("loyaltyBtn");
  if (btn) btn.addEventListener("click", function () {
    if (window.adminPerms && !window.adminPerms.canNav("loyalty")) return;
    open();
  });
})();

/* global api, lang, toast */
/* "Payment Methods & Bank Accounts" - system administrators only (permission payments.manage; the server is the real gate).
 * The page only edits the registry; the server decides availability. Values are inserted with textContent / .value.
 * Account numbers are shown to the authorised admin who types them; the audit log stores them masked. */
(function () {
  "use strict";
  var doc = document;
  var L = window.adminPageElements.L, h = window.adminPageElements.h;
  var say = function (m) { try { toast(m); } catch (e) {} };
  var KIND = { stripe: ["بطاقة (Stripe)", "Card (Stripe)", "Carte (Stripe)"], cod: ["دفع عند الاستلام", "Cash on delivery", "À la livraison"], tpe: ["TPE عند التسليم", "TPE on delivery", "TPE à la livraison"], transfer: ["تحويل يدوي", "Manual transfer", "Virement manuel"] };
  var CTX = { checkout: ["الدفع عند الطلب", "Order checkout", "Paiement commande"], customerTopup: ["شحن محفظة الزبون", "Customer wallet top-up", "Recharge portefeuille client"], driverTopup: ["شحن محفظة السائق", "Driver wallet top-up", "Recharge portefeuille livreur"] };
  var DET = [["holderName", "اسم صاحب الحساب", "Account holder", "Titulaire"], ["bankName", "اسم البنك/الخدمة", "Bank / service", "Banque / service"], ["rib", "RIB", "RIB", "RIB"], ["iban", "IBAN", "IBAN", "IBAN"], ["accountNumber", "رقم الحساب", "Account number", "N° de compte"], ["paymentIdentifier", "معرّف الدفع (إن لزم)", "Payment identifier (if needed)", "Identifiant de paiement"], ["branch", "الوكالة/الفرع", "Branch / agency", "Agence"], ["referenceFormat", "شكل مرجع التحويل", "Reference format", "Format de référence"]];
  var AUD = { "default": ["الحساب الافتراضي", "Default account", "Compte par défaut"], customer: ["خاص بشحن الزبون (اختياري)", "Customer top-ups override (optional)", "Spécifique clients (optionnel)"], driver: ["خاص بشحن السائق (اختياري)", "Driver top-ups override (optional)", "Spécifique livreurs (optionnel)"] };

  function input(type, value, ph, extra) { var e = h("input", Object.assign({ class: "sen-search", type: type, placeholder: ph || "", autocomplete: "off" }, extra || {})); if (type === "checkbox") e.checked = !!value; else e.value = value == null ? "" : value; return e; }
  function i18nRow(label, obj, rows) {
    var ar = input("text", obj && obj.ar, "AR"), fr = input("text", obj && obj.fr, "FR"), en = input("text", obj && obj.en, "EN");
    if (rows) { [ar, fr, en].forEach(function (x, i) { var t = h("textarea", { class: "sen-search", rows: String(rows), placeholder: ["AR", "FR", "EN"][i] }); t.value = x.value; [ar, fr, en][i] = t; }); }
    return { ar: ar, fr: fr, en: en, el: h("div", {}, h("label", { class: "sen-muted" }, label), ar, fr, en), get: function () { return { ar: ar.value, fr: fr.value, en: en.value }; } };
  }

  function editor(rec, reload) {
    var ov = h("div", { class: "sen-ov", "data-payment-editor": "", onclick: function (e) { if (e.target === ov) ov.remove(); } });
    var box = h("div", { class: "sen-box", role: "dialog", "aria-modal": "true", style: "max-height:90vh;overflow:auto" });
    ov.appendChild(box);
    var kindName = KIND[rec.kind] || [rec.kind, rec.kind, rec.kind];
    box.appendChild(h("div", { class: "sen-head" }, h("h3", {}, (rec.name && (rec.name[lang] || rec.name.ar)) || rec.id), h("button", { class: "sen-x", type: "button", "aria-label": L("إغلاق", "Close", "Fermer"), onclick: function () { ov.remove(); } }, "✕")));
    box.appendChild(h("p", { class: "sen-muted" }, L.apply(null, kindName)));
    if (rec.kind === "stripe") box.appendChild(h("p", { class: "sen-muted" }, "⚠ ", L("لا يوجد تكامل Stripe فعلي في النظام: تبقى هذه الطريقة «غير متوفر حاليا» مهما فُعّلت، حتى يُنجز تكامل حقيقي ويُتحقق منه.", "There is no real Stripe integration in this system: the method stays «unavailable» whatever you toggle, until a real integration is built and verified.", "Aucune intégration Stripe réelle : la méthode reste indisponible tant qu'elle n'est pas développée et vérifiée.")));
    if (rec.kind === "transfer") box.appendChild(h("p", { class: "sen-muted" }, L("تحويل يدوي: لا يوجد ربط API مع البنك. لا يُضاف الرصيد إلا بعد أن يتحقق مشرف مخوّل من وصول المبلغ. أدخل بيانات حسابكم الحقيقية فقط.", "Manual transfer: no bank API is connected. Balance is credited only after an authorised supervisor verifies the money arrived. Enter your real account details only.", "Virement manuel : aucune API bancaire. Le solde n'est crédité qu'après vérification par un superviseur autorisé. Saisissez uniquement vos vraies coordonnées.")));

    var name = i18nRow(L("الاسم المعروض", "Display name", "Nom affiché"), rec.name);
    var status = i18nRow(L("رسالة الحالة العامة", "Public status message", "Message de statut public"), rec.statusMessage);
    var enabled = input("checkbox", rec.enabled);
    var ctxEls = {};
    var ctxRow = h("div", {});
    ["checkout", "customerTopup", "driverTopup"].forEach(function (c) {
      if ((rec.kind === "cod" || rec.kind === "tpe") && c !== "checkout") return; // order-payment methods are never wallet-funding
      ctxEls[c] = input("checkbox", rec.contexts && rec.contexts[c]);
      ctxRow.appendChild(h("label", { class: "sen-muted", style: "display:block" }, ctxEls[c], " ", L.apply(null, CTX[c])));
    });
    box.appendChild(h("label", { class: "sen-muted", style: "display:block" }, enabled, " ", L("مفعّلة", "Enabled", "Activée")));
    box.appendChild(h("label", { class: "sen-muted" }, L("أماكن الظهور", "Where it appears", "Où elle apparaît")));
    box.appendChild(ctxRow);
    box.appendChild(name.el);
    box.appendChild(status.el);

    var det = {};
    if (rec.kind === "transfer") {
      ["default", "customer", "driver"].forEach(function (a) {
        var cur = (rec.details && rec.details[a]) || {};
        var d = { fields: {} };
        var sec = h("div", {}, h("h4", {}, L.apply(null, AUD[a])));
        DET.forEach(function (f) { d.fields[f[0]] = input("text", cur[f[0]], L(f[1], f[2], f[3]), { maxlength: "120" }); sec.appendChild(d.fields[f[0]]); });
        d.instructions = i18nRow(L("تعليمات الدفع", "Payment instructions", "Instructions de paiement"), cur.instructions, 3);
        sec.appendChild(d.instructions.el);
        det[a] = d; box.appendChild(sec);
      });
    }
    var qr = input("text", rec.qrImage, L("رابط صورة QR / تعليمات (/uploads/... أو https)", "QR / instruction image URL (/uploads/... or https)", "URL image QR (/uploads/... ou https)"));
    var receipt = input("checkbox", rec.requireReceipt);
    var min = input("number", rec.minAmount, L("الحد الأدنى", "Minimum amount", "Montant min"), { min: "0", step: "any" });
    var max = input("number", rec.maxAmount, L("الحد الأقصى", "Maximum amount", "Montant max"), { min: "0", step: "any" });
    var sort = input("number", rec.sortOrder, L("ترتيب العرض", "Display order", "Ordre d'affichage"), { min: "0", step: "1" });
    if (rec.kind === "transfer") { box.appendChild(h("label", { class: "sen-muted" }, L("صورة QR", "QR image", "Image QR"))); box.appendChild(qr); box.appendChild(h("label", { class: "sen-muted", style: "display:block" }, receipt, " ", L("الإيصال مطلوب", "Receipt required", "Reçu obligatoire"))); box.appendChild(h("p", { class: "sen-muted" }, L("التحقق من المشرف مطلوب دائماً في التحويلات اليدوية.", "Supervisor verification is always required for manual transfers.", "La vérification par un superviseur est toujours requise."))); }
    box.appendChild(h("label", { class: "sen-muted" }, L("الحدود والترتيب", "Limits and order", "Limites et ordre"))); box.appendChild(min); box.appendChild(max); box.appendChild(sort);

    var save = h("button", { class: "sen-btn primary", type: "button", onclick: function () {
      if (rec.enabled && !enabled.checked && !confirm(L("تعطيل هذه الطريقة سيخفيها عن المستخدمين فوراً. تأكيد؟ (السجلات السابقة تبقى محفوظة)", "Disabling hides this method from users immediately. Confirm? (Past records are kept.)", "La désactiver la masque immédiatement. Confirmer ? (L'historique est conservé.)"))) return;
      var body = { expectedVersion: rec.version || 1, name: name.get(), statusMessage: status.get(), enabled: enabled.checked, contexts: {}, minAmount: min.value === "" ? null : Number(min.value), maxAmount: max.value === "" ? null : Number(max.value), sortOrder: Number(sort.value) };
      Object.keys(ctxEls).forEach(function (c) { body.contexts[c] = ctxEls[c].checked; });
      if (rec.kind === "transfer") {
        body.qrImage = qr.value; body.requireReceipt = receipt.checked; body.details = {};
        Object.keys(det).forEach(function (a) {
          var o = { instructions: det[a].instructions.get() }, any = false;
          Object.keys(det[a].fields).forEach(function (k) { o[k] = det[a].fields[k].value; if (o[k]) any = true; });
          if (any || a === "default" || (o.instructions.ar || o.instructions.fr || o.instructions.en)) body.details[a] = o;
        });
      }
      save.disabled = true;
      api("/api/admin/payment-methods/" + encodeURIComponent(rec.id), { method: "PUT", body: JSON.stringify(body) })
        .then(function () { say("✅"); ov.remove(); reload(); })
        .catch(function (e) {
          save.disabled = false;
          var code = e && e.body && e.body.code;
          say("❌ " + (code === "ACCOUNT_REQUIRED" ? L("أدخل اسم صاحب الحساب ورقم RIB/حساب/معرّف قبل التفعيل", "Enter the account holder and an RIB / account / identifier before enabling", "Saisissez le titulaire et un RIB / compte / identifiant avant l'activation") : code === "VERSION_CONFLICT" ? L("تم التعديل من مستخدم آخر، أعد التحميل", "Changed by someone else, reload", "Modifié par un autre utilisateur, rechargez") : (e && e.message || "Error")));
        });
    } }, L("حفظ", "Save", "Enregistrer"));
    box.appendChild(h("div", { style: "margin-top:12px" }, save));
    doc.body.appendChild(ov);
  }

  function showPayments(show) {
    var m = doc.getElementById("paymentsModal"); m.classList.toggle("show", !!show);
    if (!show) { m.replaceChildren(); doc.querySelectorAll('[data-payment-editor]').forEach(function (e) { e.remove(); }); }
  }
  window.showPayments = showPayments;

  function open() {
    var list = h("div", { class: "sen-list" }, h("p", { class: "sen-muted" }, "…"));
    var ov = doc.getElementById("paymentsModal");
    var box = h("div", { class: "modal-card sen-box", role: "region" });
    ov.replaceChildren(box);
    function load() {
      api("/api/admin/payment-methods").then(function (r) {
        while (list.firstChild) list.removeChild(list.firstChild);
        (r.methods || []).forEach(function (m) {
          var state = m.kind === "stripe" ? (r.stripeUnavailableLabel || "غير متوفر حاليا") : m.enabled ? L("مفعّلة", "Enabled", "Activée") : L("معطّلة", "Disabled", "Désactivée");
          var ctx = Object.keys(m.contexts || {}).filter(function (c) { return m.contexts[c]; }).map(function (c) { return L.apply(null, CTX[c]); }).join(" · ");
          list.appendChild(h("div", { class: "sen-row" + (m.enabled ? "" : " off") },
            h("div", { class: "sen-name" }, h("b", {}, (m.name && (m.name[lang] || m.name.ar)) || m.id), h("small", {}, state + " · " + ctx)),
            h("div", { class: "sen-acts" }, h("button", { class: "sen-btn", type: "button", onclick: function () { editor(m, load); } }, L("تعديل", "Edit", "Modifier")))));
        });
      }).catch(function (e) { while (list.firstChild) list.removeChild(list.firstChild); list.appendChild(h("p", { class: "sen-muted" }, "❌ " + (e && e.message || "Error"))); });
    }
    box.appendChild(h("div", { class: "sen-head" }, h("h3", {}, L("طرق الدفع والحسابات البنكية", "Payment methods & bank accounts", "Moyens de paiement et comptes bancaires")), h("button", { class: "sen-x", type: "button", "aria-label": L("إغلاق", "Close", "Fermer"), onclick: function () { showPayments(false); } }, "✕")));
    box.appendChild(h("p", { class: "sen-muted" }, L("لا تُدخل إلا بيانات حساباتكم الحقيقية. كل تعديل يُسجَّل في سجل التدقيق (أرقام الحسابات مخفية جزئياً).", "Enter only your real account details. Every change is audited (account numbers masked).", "Saisissez uniquement vos vraies coordonnées. Chaque modification est auditée (numéros masqués).")));
    box.appendChild(list);
    showPayments(true);
    load();
  }


  // The shared hash router clicks the original source button after checking the role.
  doc.getElementById("paymentsBtn").addEventListener("click", function () {
    if (window.adminPerms && !window.adminPerms.canNav("payments")) return;
    open();
  });
})();

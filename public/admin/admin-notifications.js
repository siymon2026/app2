/* ==========================================================================
   Admin notification editor
   - Loaded after admin.js; reuses its globals: api(), toast(), lang, token.
   - Talks to the real endpoints in server.js:
       GET  /api/admin/notifications            (list + limits + pushEnabled)
       GET  /api/admin/notifications/audience   (real recipient counts)
       POST /api/admin/notifications            (send now, or draft:true)
       PUT  /api/admin/notifications/:id        (update draft)
       POST /api/admin/notifications/:id/send   (send a saved draft)
       DEL  /api/admin/notifications/:id        (delete a draft)
       POST /api/admin/notifications/test       (test push to ONE customer)
   ========================================================================== */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var root = $("notificationsModal");
  if (!root) return;

  /* ---------------------------- i18n ---------------------------- */
  var DICT = {
    ar: {
      subtitle: "أنشئ إشعار عرض جديد، عاينه مباشرة، ثم أرسله إلى الزبناء.",
      secContent: "محتوى الإشعار", fTitle: "عنوان الإشعار", fMsg: "نص الرسالة", fLink: "رابط عند النقر", fImg: "صورة العرض",
      optional: "اختياري", linkHint: "مسار داخل الموقع (يبدأ بـ /) أو رابط https. إن تُرك فارغاً يفتح صندوق الإشعارات.",
      addImage: "إضافة صورة", replaceImage: "استبدال", removeImage: "إزالة",
      secAudience: "الجمهور المستهدف",
      audAll: "جميع الزبناء", audAllD: "كل الحسابات المسجلة. يصلهم الإشعار في التطبيق، وعلى الهاتف من فعّل الإشعارات.",
      audOrdered: "زبناء سبق أن طلبوا", audOrderedD: "لديهم طلب واحد على الأقل.",
      audNoOrders: "زبناء بلا أي طلب", audNoOrdersD: "سجّلوا ولم يُجروا أي طلب بعد.",
      secTest: "إشعار تجريبي", testHint: "يُرسل إلى جهاز زبون واحد محدد فقط (لا يُحفظ ولا يظهر لبقية الزبناء). أدخل بريده أو هاتفه أو معرّفه؛ يجب أن يكون قد فعّل الإشعارات.",
      phTest: "بريد / هاتف / معرّف الزبون المصرّح له", btnTest: "إرسال تجريبي",
      btnPreview: "معاينة", btnDraft: "حفظ كمسودة", btnDraftUpdate: "تحديث المسودة", btnSend: "إرسال الإشعار الآن", cancelEdit: "إلغاء تعديل المسودة",
      prevTitle: "معاينة مباشرة", now: "الآن",
      prevNote: "معاينة تقريبية وليست إشعاراً حقيقياً أُرسل إلى جهاز. الشكل الفعلي يختلف حسب الهاتف والمتصفح، وقد يُقتطع النص الطويل.",
      tabSent: "المرسلة", tabDraft: "المسودات", cancel: "إلغاء", histTitle: "سجل الإشعارات",
      phTitle: "مثال: خصم 20% على البيتزا اليوم", phMsg: "اكتب نص العرض الذي سيظهر للزبون…",
      prevTitlePh: "عنوان الإشعار", prevMsgPh: "نص الرسالة سيظهر هنا",
      opensLink: "يفتح عند النقر:", opensDefault: "يفتح عند النقر: صندوق الإشعارات",
      statCust: "زبون مستهدف", statPushCust: "زبون بإشعارات Push", statDev: "جهاز مشترك",
      audLoading: "جارٍ حساب المستلمين…", audError: "تعذّر حساب عدد المستلمين.", audRetry: "إعادة المحاولة", audZero: "لا يوجد زبناء في هذه الفئة.",
      warnPush: "Web Push غير مفعّل على الخادم (مفاتيح VAPID غير مضبوطة). الإشعار سيُحفظ في صندوق الزبناء داخل التطبيق فقط ولن يصل كإشعار على الهاتف.",
      confTitle: "تأكيد إرسال الإشعار", confOk: "تأكيد وإرسال", confSending: "جارٍ الإرسال…",
      rTitle: "العنوان", rAud: "الجمهور", rCust: "المستلمون المتوقعون", rPush: "وصول Push المتوقع", rLink: "الرابط", rImg: "صورة", yes: "نعم", no: "لا",
      confCust: "{n} زبون", confPush: "{c} زبون / {d} جهاز", confNote: "لا يمكن التراجع بعد الإرسال.",
      confNoPush: "لن يُرسل Push (غير مفعّل). سيظهر الإشعار داخل التطبيق فقط.",
      confNoDev: "لا يوجد أي جهاز مشترك في هذه الفئة: سيظهر الإشعار داخل التطبيق فقط.",
      sentOk: "تم الإرسال: وصل Push إلى {s} من {d} جهاز.", sentFailed: " فشل {f}.", sentNoPush: "حُفظ في صندوق الزبناء، لكن لم يُرسل Push (غير مفعّل على الخادم).",
      sentNoDev: "حُفظ في صندوق الزبناء. لا يوجد جهاز مشترك لاستقبال Push.", sentProcessing: "الإرسال جارٍ في الخلفية. تابع حالته في قائمة المرسلة.",
      sentPayload: "حُفظ في الصندوق لكن لم يُرسل Push لأن حجم الإشعار كبير جداً.", sentErr: "حُفظ في الصندوق لكن حدث خطأ أثناء إرسال Push.",
      draftSaved: "تم حفظ المسودة.", draftDeleted: "تم حذف المسودة.", draftDelConfirm: "حذف هذه المسودة نهائياً؟", draftDel: "حذف",
      testOk: "تم إرسال الإشعار التجريبي إلى جهاز الزبون.", testBusy: "جارٍ الإرسال…",
      edit: "تعديل", sendDraft: "إرسال", emptySent: "لم تُرسل أي إشعارات بعد.", emptyDraft: "لا توجد مسودات.", loading: "جارٍ التحميل…", loadErr: "تعذّر تحميل الإشعارات.", retry: "إعادة المحاولة",
      chSending: "قيد الإرسال", chNoPush: "بدون Push", chAudAll: "كل الزبناء", chAudOrdered: "زبناء سبق أن طلبوا", chAudNoOrders: "زبناء بلا طلب", chRecip: "{n} مستلم", chPush: "Push {s}/{d}", chFail: "فشل {f}",
      chDraft: "مسودة", chDraftAt: "آخر تعديل",
      e_missing_title: "اكتب عنوان الإشعار.", e_missing_message: "اكتب نص الرسالة.", e_title_too_long: "العنوان أطول من الحد المسموح.", e_message_too_long: "النص أطول من الحد المسموح.",
      e_url_invalid: "الرابط غير صالح. استعمل مساراً يبدأ بـ / أو رابط https.", e_url_too_long: "الرابط طويل جداً.", e_invalid_audience: "فئة الجمهور غير صالحة.",
      e_image_type: "صيغة الصورة غير مدعومة (JPG أو PNG أو WebP فقط).", e_image_too_large: "حجم الصورة كبير (الحد {mb} MB).", e_image_invalid: "الصورة غير صالحة.",
      e_audience_changed: "تغيّر عدد المستلمين (أصبح {n}). راجع الأرقام وأعد الإرسال.", e_duplicate_recent: "أُرسل إشعار مطابق قبل أقل من دقيقة. انتظر قليلاً قبل إعادة الإرسال.",
      e_no_recipients: "لا يوجد زبناء في الفئة المختارة.", e_push_disabled: "Web Push غير مفعّل على الخادم، لا يمكن إرسال إشعار تجريبي.",
      e_customer_not_found: "لم يُعثر على زبون بهذه البيانات.", e_no_device: "هذا الزبون لم يفعّل الإشعارات على أي جهاز.", e_send_failed: "رفضت خدمة Push الإشعار التجريبي (قد يكون الاشتراك منتهياً).",
      e_payload_too_large: "الإشعار كبير جداً لـ Web Push. قصّر النص.", e_missing_target: "أدخل بريد أو هاتف أو معرّف الزبون.", e_not_found: "العنصر غير موجود.", e_not_draft: "هذا الإشعار لم يعد مسودة.",
      e_already_sending: "هذا الإشعار قيد الإرسال بالفعل.", e_server_error: "خطأ في الخادم. حاول مجدداً.",
      e_network: "تعذّر الاتصال بالخادم. بياناتك محفوظة في النموذج. إن كنت غير متأكد من وصول الطلب فتحقق من قائمة المرسلة؛ إعادة الضغط آمنة ولن تُكرّر الإرسال.",
      e_auth: "انتهت الجلسة. سجّل الدخول مجدداً.", fix: "أصلح الحقول المحددة أولاً."
    },
    en: {
      subtitle: "Create an offer notification, preview it live, then send it to customers.",
      secContent: "Notification content", fTitle: "Title", fMsg: "Message", fLink: "Link on tap", fImg: "Offer image",
      optional: "optional", linkHint: "A site path (starting with /) or an https link. Empty opens the notifications inbox.",
      addImage: "Add image", replaceImage: "Replace", removeImage: "Remove",
      secAudience: "Audience",
      audAll: "All customers", audAllD: "Every registered account. Everyone sees it in-app; customers who enabled notifications get a push.",
      audOrdered: "Customers who ordered", audOrderedD: "At least one order.",
      audNoOrders: "Customers with no orders", audNoOrdersD: "Registered but never ordered.",
      secTest: "Test notification", testHint: "Goes to ONE chosen customer's device only (not saved, invisible to others). Enter their email, phone or id; they must have notifications enabled.",
      phTest: "Authorised customer email / phone / id", btnTest: "Send test",
      btnPreview: "Preview", btnDraft: "Save draft", btnDraftUpdate: "Update draft", btnSend: "Send notification now", cancelEdit: "Cancel draft editing",
      prevTitle: "Live preview", now: "now",
      prevNote: "Approximate preview, not a real notification sent to a device. The real look varies by phone and browser, and long text may be truncated.",
      tabSent: "Sent", tabDraft: "Drafts", cancel: "Cancel", histTitle: "Notification history",
      phTitle: "e.g. 20% off pizza today", phMsg: "Write the offer text customers will see…",
      prevTitlePh: "Notification title", prevMsgPh: "Message text appears here",
      opensLink: "Opens on tap:", opensDefault: "Opens on tap: notifications inbox",
      statCust: "targeted customers", statPushCust: "customers with push", statDev: "subscribed devices",
      audLoading: "Counting recipients…", audError: "Could not count recipients.", audRetry: "Retry", audZero: "No customers in this group.",
      warnPush: "Web Push is not enabled on the server (VAPID keys missing). The notification will only be saved to the in-app inbox and will not reach phones.",
      confTitle: "Confirm sending", confOk: "Confirm & send", confSending: "Sending…",
      rTitle: "Title", rAud: "Audience", rCust: "Expected recipients", rPush: "Expected push reach", rLink: "Link", rImg: "Image", yes: "Yes", no: "No",
      confCust: "{n} customers", confPush: "{c} customers / {d} devices", confNote: "This cannot be undone once sent.",
      confNoPush: "No push will be sent (disabled). It will only appear in the app.",
      confNoDev: "No subscribed device in this group: it will only appear in the app.",
      sentOk: "Sent: push delivered to {s} of {d} devices.", sentFailed: " {f} failed.", sentNoPush: "Saved to the customer inbox, but no push was sent (not enabled on the server).",
      sentNoDev: "Saved to the customer inbox. No subscribed device to receive push.", sentProcessing: "Sending continues in the background. Check its status in the Sent list.",
      sentPayload: "Saved to the inbox but push was skipped: notification too large.", sentErr: "Saved to the inbox but an error occurred sending push.",
      draftSaved: "Draft saved.", draftDeleted: "Draft deleted.", draftDelConfirm: "Delete this draft permanently?", draftDel: "Delete",
      testOk: "Test notification sent to the customer's device.", testBusy: "Sending…",
      edit: "Edit", sendDraft: "Send", emptySent: "No notifications sent yet.", emptyDraft: "No drafts.", loading: "Loading…", loadErr: "Could not load notifications.", retry: "Retry",
      chSending: "Sending", chNoPush: "No push", chAudAll: "All customers", chAudOrdered: "Ordered before", chAudNoOrders: "No orders", chRecip: "{n} recipients", chPush: "Push {s}/{d}", chFail: "{f} failed",
      chDraft: "Draft", chDraftAt: "Last edited",
      e_missing_title: "Enter a title.", e_missing_message: "Enter a message.", e_title_too_long: "Title is too long.", e_message_too_long: "Message is too long.",
      e_url_invalid: "Invalid link. Use a path starting with / or an https link.", e_url_too_long: "Link is too long.", e_invalid_audience: "Invalid audience.",
      e_image_type: "Unsupported image type (JPG, PNG or WebP only).", e_image_too_large: "Image is too large (max {mb} MB).", e_image_invalid: "Invalid image.",
      e_audience_changed: "Recipient count changed (now {n}). Review and send again.", e_duplicate_recent: "An identical notification was sent less than a minute ago. Wait before resending.",
      e_no_recipients: "No customers in the selected group.", e_push_disabled: "Web Push is not enabled on the server; cannot send a test.",
      e_customer_not_found: "No customer matches that value.", e_no_device: "This customer has not enabled notifications on any device.", e_send_failed: "The push service rejected the test (subscription may be expired).",
      e_payload_too_large: "Too large for Web Push. Shorten the text.", e_missing_target: "Enter the customer's email, phone or id.", e_not_found: "Not found.", e_not_draft: "This is no longer a draft.",
      e_already_sending: "Already being sent.", e_server_error: "Server error. Try again.",
      e_network: "Could not reach the server. Your input is kept. If unsure whether it went through, check the Sent list; pressing again is safe and will not send twice.",
      e_auth: "Session expired. Sign in again.", fix: "Fix the highlighted fields first."
    },
    fr: {
      subtitle: "Créez une notification d'offre, prévisualisez-la, puis envoyez-la aux clients.",
      secContent: "Contenu", fTitle: "Titre", fMsg: "Message", fLink: "Lien au clic", fImg: "Image de l'offre",
      optional: "optionnel", linkHint: "Chemin du site (commençant par /) ou lien https. Vide : ouvre la boîte de notifications.",
      addImage: "Ajouter une image", replaceImage: "Remplacer", removeImage: "Retirer",
      secAudience: "Audience",
      audAll: "Tous les clients", audAllD: "Tous les comptes. Visible dans l'app ; push pour ceux qui ont activé les notifications.",
      audOrdered: "Clients ayant déjà commandé", audOrderedD: "Au moins une commande.",
      audNoOrders: "Clients sans commande", audNoOrdersD: "Inscrits sans aucune commande.",
      secTest: "Notification de test", testHint: "Envoyée à UN seul client choisi (non enregistrée, invisible aux autres). Saisissez e-mail, téléphone ou identifiant ; notifications activées requises.",
      phTest: "E-mail / téléphone / id du client autorisé", btnTest: "Envoyer un test",
      btnPreview: "Aperçu", btnDraft: "Enregistrer le brouillon", btnDraftUpdate: "Mettre à jour le brouillon", btnSend: "Envoyer maintenant", cancelEdit: "Annuler la modification",
      prevTitle: "Aperçu en direct", now: "maintenant",
      prevNote: "Aperçu approximatif, pas une vraie notification. Le rendu réel varie selon l'appareil et le navigateur ; un long texte peut être tronqué.",
      tabSent: "Envoyées", tabDraft: "Brouillons", cancel: "Annuler", histTitle: "Historique",
      phTitle: "ex. -20 % sur les pizzas aujourd'hui", phMsg: "Texte de l'offre visible par le client…",
      prevTitlePh: "Titre de la notification", prevMsgPh: "Le message s'affichera ici",
      opensLink: "Ouvre au clic :", opensDefault: "Ouvre au clic : boîte de notifications",
      statCust: "clients ciblés", statPushCust: "clients avec push", statDev: "appareils inscrits",
      audLoading: "Calcul des destinataires…", audError: "Impossible de calculer les destinataires.", audRetry: "Réessayer", audZero: "Aucun client dans ce groupe.",
      warnPush: "Web Push n'est pas activé sur le serveur (clés VAPID manquantes). La notification sera seulement enregistrée dans la boîte de l'app.",
      confTitle: "Confirmer l'envoi", confOk: "Confirmer et envoyer", confSending: "Envoi…",
      rTitle: "Titre", rAud: "Audience", rCust: "Destinataires prévus", rPush: "Portée push prévue", rLink: "Lien", rImg: "Image", yes: "Oui", no: "Non",
      confCust: "{n} clients", confPush: "{c} clients / {d} appareils", confNote: "Irréversible après l'envoi.",
      confNoPush: "Aucun push ne sera envoyé (désactivé). Visible uniquement dans l'app.",
      confNoDev: "Aucun appareil inscrit dans ce groupe : visible uniquement dans l'app.",
      sentOk: "Envoyé : push reçu sur {s} appareil(s) sur {d}.", sentFailed: " {f} échec(s).", sentNoPush: "Enregistré dans la boîte clients, mais aucun push envoyé (désactivé sur le serveur).",
      sentNoDev: "Enregistré dans la boîte clients. Aucun appareil inscrit pour le push.", sentProcessing: "Envoi en cours en arrière-plan. Suivez-le dans la liste Envoyées.",
      sentPayload: "Enregistré mais push ignoré : notification trop volumineuse.", sentErr: "Enregistré mais erreur lors de l'envoi du push.",
      draftSaved: "Brouillon enregistré.", draftDeleted: "Brouillon supprimé.", draftDelConfirm: "Supprimer définitivement ce brouillon ?", draftDel: "Supprimer",
      testOk: "Notification de test envoyée à l'appareil du client.", testBusy: "Envoi…",
      edit: "Modifier", sendDraft: "Envoyer", emptySent: "Aucune notification envoyée.", emptyDraft: "Aucun brouillon.", loading: "Chargement…", loadErr: "Impossible de charger les notifications.", retry: "Réessayer",
      chSending: "En cours", chNoPush: "Sans push", chAudAll: "Tous les clients", chAudOrdered: "Ont commandé", chAudNoOrders: "Sans commande", chRecip: "{n} destinataires", chPush: "Push {s}/{d}", chFail: "{f} échec(s)",
      chDraft: "Brouillon", chDraftAt: "Dernière modif.",
      e_missing_title: "Saisissez un titre.", e_missing_message: "Saisissez un message.", e_title_too_long: "Titre trop long.", e_message_too_long: "Message trop long.",
      e_url_invalid: "Lien invalide. Chemin commençant par / ou lien https.", e_url_too_long: "Lien trop long.", e_invalid_audience: "Audience invalide.",
      e_image_type: "Format d'image non pris en charge (JPG, PNG ou WebP).", e_image_too_large: "Image trop lourde (max {mb} Mo).", e_image_invalid: "Image invalide.",
      e_audience_changed: "Le nombre de destinataires a changé ({n}). Vérifiez et renvoyez.", e_duplicate_recent: "Une notification identique a été envoyée il y a moins d'une minute.",
      e_no_recipients: "Aucun client dans le groupe choisi.", e_push_disabled: "Web Push désactivé sur le serveur ; test impossible.",
      e_customer_not_found: "Aucun client correspondant.", e_no_device: "Ce client n'a activé les notifications sur aucun appareil.", e_send_failed: "Le service push a rejeté le test (abonnement expiré ?).",
      e_payload_too_large: "Trop volumineux pour Web Push. Raccourcissez le texte.", e_missing_target: "Saisissez e-mail, téléphone ou id du client.", e_not_found: "Introuvable.", e_not_draft: "Ce n'est plus un brouillon.",
      e_already_sending: "Déjà en cours d'envoi.", e_server_error: "Erreur serveur. Réessayez.",
      e_network: "Serveur injoignable. Vos données sont conservées. En cas de doute, consultez la liste Envoyées ; réappuyer est sans risque (pas de double envoi).",
      e_auth: "Session expirée. Reconnectez-vous.", fix: "Corrigez d'abord les champs signalés."
    }
  };
  function L() { try { return (typeof lang !== "undefined" && DICT[lang]) ? lang : "ar"; } catch (_e) { return "ar"; } }
  function T(k, vars) {
    var s = (DICT[L()] && DICT[L()][k]) || DICT.en[k] || k;
    if (vars) Object.keys(vars).forEach(function (v) { s = s.split("{" + v + "}").join(String(vars[v])); });
    return s;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function nf(n) { try { return Number(n).toLocaleString(L() === "ar" ? "ar" : L()); } catch (_e) { return String(n); } }

  /* ---------------------------- state ---------------------------- */
  var LIM = { TITLE_MAX: 120, MESSAGE_MAX: 1000, URL_MAX: 500 };
  var state = {
    pushEnabled: true,
    maxImageBytes: 2000000,
    list: [], listStatus: "idle", tab: "sent",
    audience: "all", aud: { status: "idle", data: null }, audSeq: 0,
    file: null, previewUrl: null, serverImageUrl: null, removeImage: false,
    editingId: null, touched: {}, busy: false, requestId: null, pollTimer: null
  };
  var ALLOWED = ["image/jpeg", "image/png", "image/webp"];

  function newRequestId() {
    try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (_e) {}
    return "r_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  /* ---------------------------- validation ---------------------------- */
  function validUrl(s) {
    s = String(s || "").trim();
    if (!s) return { ok: true };
    if (s.length > LIM.URL_MAX) return { ok: false, key: "e_url_too_long" };
    if (/[\u0000-\u001f\u007f\s<>"'`\\]/.test(s)) return { ok: false, key: "e_url_invalid" };
    if (s.charAt(0) === "/" && s.charAt(1) !== "/") return { ok: true };
    try { if (new URL(s).protocol === "https:") return { ok: true }; } catch (_e) {}
    return { ok: false, key: "e_url_invalid" };
  }
  function imageProblem(file) {
    if (!file) return null;
    if (ALLOWED.indexOf(file.type) < 0) return T("e_image_type");
    if (file.size > state.maxImageBytes) return T("e_image_too_large", { mb: (state.maxImageBytes / 1e6).toFixed(state.maxImageBytes % 1e6 ? 1 : 0) });
    return null;
  }
  function values() {
    return {
      title: $("notifTitle").value.trim(),
      message: $("notifMsg").value.trim(),
      url: $("notifLink").value.trim()
    };
  }
  function errors() {
    var v = values(), e = {};
    if (!v.title) e.title = T("e_missing_title");
    else if (v.title.length > LIM.TITLE_MAX) e.title = T("e_title_too_long");
    if (!v.message) e.message = T("e_missing_message");
    else if (v.message.length > LIM.MESSAGE_MAX) e.message = T("e_message_too_long");
    var u = validUrl(v.url); if (!u.ok) e.link = T(u.key);
    var ip = imageProblem(state.file); if (ip) e.image = ip;
    return e;
  }
  function showErr(id, inputId, msg) {
    var n = $(id); if (!n) return;
    n.hidden = !msg; n.textContent = msg || "";
    var i = $(inputId); if (i) i.classList.toggle("invalid", !!msg);
  }
  function renderErrors(force) {
    var e = errors(), t = state.touched;
    showErr("neTitleErr", "notifTitle", (force || t.title) ? e.title : "");
    showErr("neMsgErr", "notifMsg", (force || t.message) ? e.message : "");
    showErr("neLinkErr", "notifLink", (force || t.link) ? e.link : "");
    showErr("neImgErr", "neImgPick", e.image || "");
    return e;
  }

  /* ---------------------------- messages ---------------------------- */
  function setMsg(kind, text) {
    var n = $("notifHint"); if (!n) return;
    n.className = "ne-msg" + (kind ? " " + kind : "");
    n.textContent = text || "";
  }
  function errText(e) {
    if (!e) return T("e_server_error");
    if (e.status === 401) return T("e_auth");
    var code = e.body && e.body.code;
    if (code === "audience_changed") return T("e_audience_changed", { n: nf(e.body.targetedCustomers) });
    if (code === "image_too_large") return T("e_image_too_large", { mb: (state.maxImageBytes / 1e6).toFixed(1) });
    if (code && DICT.en["e_" + code]) return T("e_" + code);
    if (e.status) return String(e.message || T("e_server_error"));
    return T("e_network"); // fetch rejected => no HTTP status
  }

  /* ---------------------------- preview ---------------------------- */
  function setCount(id, len, max) {
    var n = $(id); if (!n) return;
    n.textContent = len + "/" + max;
    n.classList.toggle("max", len >= max);
    n.classList.toggle("warn", len < max && len >= max * 0.9);
  }
  function updatePreview() {
    var v = values();
    var t = $("nePrevTitle"), m = $("nePrevMsg");
    t.textContent = v.title || T("prevTitlePh"); t.classList.toggle("ph", !v.title);
    m.textContent = v.message || T("prevMsgPh"); m.classList.toggle("ph", !v.message);
    var src = state.previewUrl || (!state.removeImage && state.serverImageUrl) || "";
    var img = $("nePrevImg");
    if (src) { img.src = src; img.hidden = false; } else { img.removeAttribute("src"); img.hidden = true; }
    var o = $("nePrevOpens");
    o.hidden = false;
    o.textContent = v.url && validUrl(v.url).ok ? T("opensLink") + " " + v.url : T("opensDefault");
    var d = new Date();
    $("nePhoneTime").textContent = ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
    setCount("neTitleCount", $("notifTitle").value.length, LIM.TITLE_MAX);
    setCount("neMsgCount", $("notifMsg").value.length, LIM.MESSAGE_MAX);
  }

  /* ---------------------------- image ---------------------------- */
  function renderImage() {
    var src = state.previewUrl || (!state.removeImage && state.serverImageUrl) || "";
    var has = !!src;
    $("neThumb").hidden = !has;
    $("neImgPick").hidden = has;
    var p = $("notifImgPrev");
    if (has) p.src = src; else p.removeAttribute("src");
    $("notifImgHint").textContent = state.file ? state.file.name + " · " + (state.file.size / 1024).toFixed(0) + " KB" : "";
  }
  function setFile(file) {
    if (state.previewUrl) { try { URL.revokeObjectURL(state.previewUrl); } catch (_e) {} }
    state.previewUrl = null; state.file = null;
    if (file) {
      state.file = file;
      if (!imageProblem(file)) state.previewUrl = URL.createObjectURL(file);
      state.removeImage = false;
    }
    state.requestId = null;
    renderImage(); renderErrors(); updatePreview(); refreshButtons();
  }
  function removeImage() {
    setFile(null);
    state.removeImage = true; // draft: also clear stored image
    $("notifImg").value = "";
    renderImage(); updatePreview();
  }

  /* ---------------------------- audience ---------------------------- */
  function audLabel(k) { return k === "ordered" ? T("chAudOrdered") : k === "no_orders" ? T("chAudNoOrders") : T("chAudAll"); }
  function renderAudience() {
    var box = $("neStats"), a = state.aud;
    if (a.status === "loading") { box.innerHTML = '<div class="ne-skel"></div><div class="ne-skel"></div><div class="ne-skel"></div>'; return; }
    if (a.status === "error") {
      box.innerHTML = '<div class="ne-stats-msg err">' + esc(T("audError")) + ' <button type="button" class="btn" id="neAudRetry">' + esc(T("audRetry")) + "</button></div>";
      var b = $("neAudRetry"); if (b) b.onclick = loadAudience; return;
    }
    if (a.status !== "ready" || !a.data) { box.innerHTML = ""; return; }
    var d = a.data;
    if (!d.targetedCustomers) { box.innerHTML = '<div class="ne-stats-msg">' + esc(T("audZero")) + "</div>"; return; }
    function stat(n, l) { return '<div class="ne-stat"><b>' + esc(nf(n)) + "</b><span>" + esc(l) + "</span></div>"; }
    box.innerHTML = stat(d.targetedCustomers, T("statCust")) + stat(d.pushCustomers, T("statPushCust")) + stat(d.pushDevices, T("statDev"));
  }
  function loadAudience() {
    var seq = ++state.audSeq;
    state.aud = { status: "loading", data: null };
    renderAudience(); refreshButtons();
    return api("/api/admin/notifications/audience?audience=" + encodeURIComponent(state.audience)).then(function (res) {
      if (seq !== state.audSeq) return;
      state.pushEnabled = res.pushEnabled !== false;
      state.aud = { status: "ready", data: res };
      renderBanner(); renderAudience(); refreshButtons();
    }).catch(function () {
      if (seq !== state.audSeq) return;
      state.aud = { status: "error", data: null };
      renderAudience(); refreshButtons();
    });
  }
  function renderBanner() {
    var b = $("neBanner");
    b.hidden = state.pushEnabled;
    b.textContent = state.pushEnabled ? "" : "⚠️ " + T("warnPush");
  }

  /* ---------------------------- buttons ---------------------------- */
  function refreshButtons() {
    var e = errors(), hasErr = Object.keys(e).length > 0;
    var audOk = state.aud.status === "ready" && state.aud.data && state.aud.data.targetedCustomers > 0;
    var send = $("sendNotifBtn");
    send.disabled = state.busy || hasErr || !audOk;
    $("neDraftBtn").disabled = state.busy || !!e.image || !!e.link || (!$("notifTitle").value.trim() && !$("notifMsg").value.trim());
    $("neTestBtn").disabled = state.busy || hasErr;
    $("neDraftText").textContent = state.editingId ? T("btnDraftUpdate") : T("btnDraft");
    $("neCancelEdit").hidden = !state.editingId;
  }
  function setBusy(on, which) {
    state.busy = !!on;
    ["sendNotifBtn", "neDraftBtn", "neTestBtn"].forEach(function (id) { $(id).classList.remove("busy"); });
    if (on && which) $(which).classList.add("busy");
    refreshButtons();
  }

  /* ---------------------------- payload helpers ---------------------------- */
  function readImage() {
    if (!state.file) return Promise.resolve("");
    return fileToDataUrl(state.file);
  }

  function saveDraft(silent) {
    var v = values(), e = errors();
    if (e.image || e.link) { renderErrors(true); setMsg("bad", T("fix")); return Promise.reject(new Error("invalid")); }
    return readImage().then(function (dataUrl) {
      var body = { title: v.title, message: v.message, url: v.url || "", audience: state.audience };
      if (dataUrl) body.image = dataUrl;
      if (state.editingId) {
        if (state.removeImage && !dataUrl) body.removeImage = true;
        return api("/api/admin/notifications/" + encodeURIComponent(state.editingId), { method: "PUT", body: JSON.stringify(body) });
      }
      body.draft = true; body.requestId = state.requestId || (state.requestId = newRequestId());
      return api("/api/admin/notifications", { method: "POST", body: JSON.stringify(body) });
    }).then(function (res) {
      if (!silent) { setMsg("ok", T("draftSaved")); toast("✅"); }
      return res;
    });
  }

  function onSaveDraft() {
    if (state.busy) return;
    setBusy(true, "neDraftBtn"); setMsg("", "");
    saveDraft(false).then(function () {
      resetForm(); state.tab = "draft"; return loadList();
    }).then(function () { setMsg("ok", T("draftSaved")); }).catch(function (e) {
      if (e && e.message === "invalid") return;
      setMsg("bad", errText(e));
    }).then(function () { setBusy(false); });
  }

  /* ---------------------------- confirm dialog ---------------------------- */
  var confirmResolve = null;
  function openConfirm(opts) {
    return new Promise(function (resolve) {
      confirmResolve = resolve;
      $("neConfTitle").textContent = opts.title;
      $("neConfBody").innerHTML = opts.html;
      $("neConfOkText").textContent = opts.okText;
      $("neConfOk").disabled = false;
      $("neConfirm").hidden = false;
      setTimeout(function () { try { $("neConfOk").focus(); } catch (_e) {} }, 30);
    });
  }
  function closeConfirm(result) {
    $("neConfirm").hidden = true;
    var r = confirmResolve; confirmResolve = null;
    if (r) r(!!result);
  }
  function row(k, v) { return '<div class="ne-conf-row"><span>' + esc(k) + "</span><b>" + esc(v) + "</b></div>"; }

  function confirmSend(v) {
    var d = state.aud.data, html = "";
    html += row(T("rTitle"), v.title);
    html += row(T("rAud"), audLabel(state.audience));
    html += row(T("rCust"), T("confCust", { n: nf(d.targetedCustomers) }));
    html += row(T("rPush"), T("confPush", { c: nf(d.pushCustomers), d: nf(d.pushDevices) }));
    html += row(T("rLink"), v.url || "—");
    html += row(T("rImg"), (state.file || (!state.removeImage && state.serverImageUrl)) ? T("yes") : T("no"));
    var warn = !state.pushEnabled ? T("confNoPush") : (d.pushDevices === 0 ? T("confNoDev") : "");
    if (warn) html += '<div class="ne-conf-warn">⚠️ ' + esc(warn) + "</div>";
    html += '<div class="ne-conf-warn" style="color:inherit;opacity:.75">' + esc(T("confNote")) + "</div>";
    return openConfirm({ title: T("confTitle"), html: html, okText: T("confOk") });
  }

  /* ---------------------------- send ---------------------------- */
  function deliveryMessage(res) {
    if (res.processing) return { kind: "warn", text: T("sentProcessing") };
    var d = res.delivery || {};
    if (d.pushEnabled === false || d.reason === "disabled") return { kind: "warn", text: T("sentNoPush") };
    if (d.reason === "payload_too_large") return { kind: "warn", text: T("sentPayload") };
    if (d.reason === "error") return { kind: "bad", text: T("sentErr") };
    if (!d.devices) return { kind: "warn", text: T("sentNoDev") };
    var t = T("sentOk", { s: nf(d.sent || 0), d: nf(d.devices || 0) });
    if (d.failed) t += T("sentFailed", { f: nf(d.failed) });
    return { kind: d.failed && !d.sent ? "bad" : (d.failed ? "warn" : "ok"), text: t };
  }

  function onSend() {
    if (state.busy || !$("neConfirm").hidden) return; // ignore double-clicks while the dialog is open
    state.touched = { title: 1, message: 1, link: 1 };
    var e = renderErrors(true);
    if (Object.keys(e).length) { setMsg("bad", T("fix")); refreshButtons(); return; }
    if (state.aud.status !== "ready" || !state.aud.data || !state.aud.data.targetedCustomers) return;
    var v = values();
    var expected = state.aud.data.targetedCustomers;

    confirmSend(v).then(function (ok) {
      if (!ok) return;
      setBusy(true, "sendNotifBtn"); setMsg("", "");
      var p;
      if (state.editingId) {
        var id = state.editingId;
        p = saveDraft(true).then(function () {
          return api("/api/admin/notifications/" + encodeURIComponent(id) + "/send", { method: "POST", body: JSON.stringify({ expectedRecipients: expected }) });
        });
      } else {
        if (!state.requestId) state.requestId = newRequestId();
        p = readImage().then(function (dataUrl) {
          var body = { title: v.title, message: v.message, url: v.url || "", audience: state.audience, requestId: state.requestId, expectedRecipients: expected };
          if (dataUrl) body.image = dataUrl;
          return api("/api/admin/notifications", { method: "POST", body: JSON.stringify(body) });
        });
      }
      return p.then(function (res) {
        var m = deliveryMessage(res);
        resetForm(); state.tab = "sent";
        setMsg(m.kind, m.text); toast("✅");
        return loadList().then(function () { if (res.processing) schedulePoll(); });
      }).catch(function (err) {
        if (err && err.message === "invalid") return;
        setMsg("bad", errText(err));
        if (err && err.body && err.body.code === "audience_changed") loadAudience();
      });
    }).then(function () { setBusy(false); });
  }

  function onTest() {
    if (state.busy) return;
    state.touched = { title: 1, message: 1, link: 1 };
    var e = renderErrors(true);
    if (Object.keys(e).length) { setMsg("bad", T("fix")); return; }
    var target = $("neTestTarget").value.trim();
    if (!target) { setMsg("bad", T("e_missing_target")); $("neTestTarget").focus(); return; }
    var v = values();
    setBusy(true, "neTestBtn"); setMsg("", "");
    readImage().then(function (dataUrl) {
      var body = { title: v.title, message: v.message, url: v.url || "", target: target };
      if (dataUrl) body.image = dataUrl;
      return api("/api/admin/notifications/test", { method: "POST", body: JSON.stringify(body) });
    }).then(function () { setMsg("ok", T("testOk")); toast("✅"); })
      .catch(function (err) { setMsg("bad", errText(err)); })
      .then(function () { setBusy(false); });
  }

  /* ---------------------------- form reset / edit ---------------------------- */
  function resetForm() {
    $("notifTitle").value = ""; $("notifMsg").value = ""; $("notifLink").value = "";
    $("notifImg").value = "";
    if (state.previewUrl) { try { URL.revokeObjectURL(state.previewUrl); } catch (_e) {} }
    state.previewUrl = null; state.file = null; state.serverImageUrl = null; state.removeImage = false;
    state.editingId = null; state.touched = {}; state.requestId = null;
    setAudience("all");
    renderImage(); renderErrors(); updatePreview(); refreshButtons();
  }
  function setAudience(key) {
    state.audience = key;
    var r = root.querySelector('input[name="neAudience"][value="' + key + '"]'); if (r) r.checked = true;
    loadAudience();
  }
  function loadDraftIntoForm(n) {
    if (state.previewUrl) { try { URL.revokeObjectURL(state.previewUrl); } catch (_e) {} }
    $("notifTitle").value = n.title || ""; $("notifMsg").value = n.message || ""; $("notifLink").value = n.linkUrl || "";
    $("notifImg").value = "";
    state.file = null; state.previewUrl = null; state.removeImage = false;
    state.serverImageUrl = n.imageUrl || null;
    state.editingId = n.id; state.touched = {}; state.requestId = null;
    setAudience(n.audienceKey || "all");
    renderImage(); renderErrors(); updatePreview(); refreshButtons(); setMsg("", "");
    try { $("notifTitle").scrollIntoView({ behavior: "smooth", block: "center" }); $("notifTitle").focus({ preventScroll: true }); } catch (_e) {}
  }

  /* ---------------------------- history list ---------------------------- */
  function fmt(iso) { try { return (typeof fmtDateTime === "function") ? fmtDateTime(iso) : new Date(iso).toLocaleString(); } catch (_e) { return String(iso || ""); } }
  function renderList() {
    var box = $("notifList");
    var camp = state.list.filter(function (n) { return n && n.type === "broadcast"; });
    var drafts = camp.filter(function (n) { return n.status === "draft"; });
    var sent = camp.filter(function (n) { return n.status !== "draft"; });
    $("neCntSent").textContent = sent.length; $("neCntDraft").textContent = drafts.length;
    $("neTabSent").classList.toggle("on", state.tab === "sent"); $("neTabDraft").classList.toggle("on", state.tab === "draft");
    $("neTabSent").setAttribute("aria-selected", state.tab === "sent"); $("neTabDraft").setAttribute("aria-selected", state.tab === "draft");

    if (state.listStatus === "loading") { box.innerHTML = '<div class="ne-state">' + esc(T("loading")) + "</div>"; return; }
    if (state.listStatus === "error") {
      box.innerHTML = '<div class="ne-state err">' + esc(T("loadErr")) + ' <button type="button" class="btn" id="neListRetry">' + esc(T("retry")) + "</button></div>";
      $("neListRetry").onclick = loadList; return;
    }
    var items = state.tab === "draft" ? drafts : sent;
    if (!items.length) { box.innerHTML = '<div class="ne-empty">' + esc(state.tab === "draft" ? T("emptyDraft") : T("emptySent")) + "</div>"; return; }

    box.innerHTML = items.map(function (n) {
      var chips = "";
      if (n.status === "draft") chips += '<span class="ne-chip warn">' + esc(T("chDraft")) + "</span>";
      if (n.status === "sending") chips += '<span class="ne-chip warn">' + esc(T("chSending")) + "</span>";
      chips += '<span class="ne-chip">' + esc(audLabel(n.audienceKey)) + "</span>";
      var d = n.delivery;
      if (n.status !== "draft" && d) {
        if (d.targetedCustomers != null) chips += '<span class="ne-chip">' + esc(T("chRecip", { n: nf(d.targetedCustomers) })) + "</span>";
        if (d.pushEnabled === false) chips += '<span class="ne-chip warn">' + esc(T("chNoPush")) + "</span>";
        else if (d.devices != null && d.finishedAt) chips += '<span class="ne-chip ' + (d.sent ? "ok" : "warn") + '">' + esc(T("chPush", { s: nf(d.sent || 0), d: nf(d.devices || 0) })) + "</span>";
        if (d.failed) chips += '<span class="ne-chip bad">' + esc(T("chFail", { f: nf(d.failed) })) + "</span>";
      }
      var when = n.status === "draft" ? T("chDraftAt") + ": " + fmt(n.updatedAt || n.createdAt) : fmt(n.sentAt || n.createdAt);
      var actions = n.status === "draft"
        ? '<div class="ne-item-actions"><button class="btn" type="button" data-act="edit" data-id="' + esc(n.id) + '">' + esc(T("edit")) + '</button><button class="btn good" type="button" data-act="send" data-id="' + esc(n.id) + '">' + esc(T("sendDraft")) + '</button><button class="btn ne-danger" type="button" data-act="del" data-id="' + esc(n.id) + '">' + esc(T("draftDel")) + "</button></div>"
        : "";
      return '<article class="ne-item"><b dir="auto">' + esc(n.title || "—") + '</b><p dir="auto">' + esc(n.message || "") + "</p>" +
        (n.imageUrl ? '<img loading="lazy" alt="" src="' + esc(n.imageUrl) + '" />' : "") +
        '<div class="ne-chips">' + chips + "</div><small>" + esc(when) + "</small>" + actions + "</article>";
    }).join("");
  }

  function loadList() {
    state.listStatus = "loading"; renderList();
    return api("/api/admin/notifications").then(function (res) {
      state.list = Array.isArray(res.notifications) ? res.notifications : [];
      if (res.pushEnabled !== undefined) state.pushEnabled = res.pushEnabled !== false;
      if (res.limits) { LIM.TITLE_MAX = res.limits.TITLE_MAX || LIM.TITLE_MAX; LIM.MESSAGE_MAX = res.limits.MESSAGE_MAX || LIM.MESSAGE_MAX; LIM.URL_MAX = res.limits.URL_MAX || LIM.URL_MAX; }
      if (res.maxImageBytes) state.maxImageBytes = res.maxImageBytes;
      state.listStatus = "ready";
      $("notifTitle").maxLength = LIM.TITLE_MAX; $("notifMsg").maxLength = LIM.MESSAGE_MAX;
      renderBanner(); renderList(); updatePreview();
    }).catch(function () { state.listStatus = "error"; renderList(); });
  }
  function schedulePoll() {
    clearTimeout(state.pollTimer);
    var tries = 0;
    (function tick() {
      state.pollTimer = setTimeout(function () {
        tries++;
        loadList().then(function () {
          var still = state.list.some(function (n) { return n.status === "sending"; });
          if (still && tries < 12) tick();
        });
      }, 5000);
    })();
  }

  function onListClick(ev) {
    var b = ev.target.closest && ev.target.closest("button[data-act]"); if (!b || state.busy) return;
    var id = b.getAttribute("data-id"), act = b.getAttribute("data-act");
    var n = state.list.filter(function (x) { return x.id === id; })[0]; if (!n) return;
    if (act === "edit") { loadDraftIntoForm(n); return; }
    if (act === "send") { loadDraftIntoForm(n); setTimeout(function () { var c = $("sendNotifBtn"); if (!c.disabled) onSend(); else { /* audience still loading */ var t = setInterval(function () { if (state.aud.status === "ready") { clearInterval(t); onSend(); } else if (state.aud.status === "error") clearInterval(t); }, 150); } }, 50); return; }
    if (act === "del") {
      openConfirm({ title: T("draftDel"), html: '<div class="ne-conf-row"><b dir="auto">' + esc(n.title || "—") + "</b></div><div class=\"ne-conf-warn\" style=\"color:inherit\">" + esc(T("draftDelConfirm")) + "</div>", okText: T("draftDel") }).then(function (ok) {
        if (!ok) return;
        api("/api/admin/notifications/" + encodeURIComponent(id), { method: "DELETE" }).then(function () {
          if (state.editingId === id) resetForm();
          toast("✅"); setMsg("ok", T("draftDeleted")); return loadList();
        }).catch(function (err) { setMsg("bad", errText(err)); });
      });
    }
  }

  /* ---------------------------- i18n apply ---------------------------- */
  function applyLang() {
    root.querySelectorAll("[data-ne]").forEach(function (n) { n.textContent = T(n.getAttribute("data-ne")); });
    root.querySelectorAll("[data-ne-ph]").forEach(function (n) { n.placeholder = T(n.getAttribute("data-ne-ph")); });
    var h = $("notifListTitle"); if (h) h.textContent = T("histTitle");
    var c = $("closeNotifText"); if (c) c.textContent = (L() === "ar" ? "إغلاق" : L() === "fr" ? "Fermer" : "Close");
    $("neConfOkText").textContent = T("confOk");
    root.querySelector("#neConfCancel span").textContent = T("cancel");
    renderBanner(); renderAudience(); renderList(); updatePreview(); refreshButtons();
  }

  /* ---------------------------- init ---------------------------- */
  function init() {
    $("notifTitle").addEventListener("input", function () { state.requestId = null; updatePreview(); renderErrors(); refreshButtons(); });
    $("notifMsg").addEventListener("input", function () { state.requestId = null; updatePreview(); renderErrors(); refreshButtons(); });
    $("notifLink").addEventListener("input", function () { state.requestId = null; updatePreview(); renderErrors(); refreshButtons(); });
    $("notifTitle").addEventListener("blur", function () { state.touched.title = 1; renderErrors(); });
    $("notifMsg").addEventListener("blur", function () { state.touched.message = 1; renderErrors(); });
    $("notifLink").addEventListener("blur", function () { state.touched.link = 1; renderErrors(); });

    $("neImgPick").addEventListener("click", function () { $("notifImg").click(); });
    $("neImgReplace").addEventListener("click", function () { $("notifImg").click(); });
    $("neImgRemove").addEventListener("click", removeImage);
    $("notifImg").addEventListener("change", function (e) { var f = e.target.files && e.target.files[0]; if (f) setFile(f); });

    root.querySelectorAll('input[name="neAudience"]').forEach(function (r) {
      r.addEventListener("change", function () { if (r.checked) { state.audience = r.value; state.requestId = null; loadAudience(); } });
    });

    $("sendNotifBtn").addEventListener("click", onSend);
    $("neDraftBtn").addEventListener("click", onSaveDraft);
    $("neTestBtn").addEventListener("click", onTest);
    $("nePreviewBtn").addEventListener("click", function () { $("nePrevCol").scrollIntoView({ behavior: "smooth", block: "start" }); });
    $("neCancelEdit").addEventListener("click", function () { resetForm(); setMsg("", ""); });

    $("neConfOk").addEventListener("click", function () { $("neConfOk").disabled = true; closeConfirm(true); });
    $("neConfCancel").addEventListener("click", function () { closeConfirm(false); });
    $("neConfirm").addEventListener("click", function (e) { if (e.target === $("neConfirm")) closeConfirm(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("neConfirm").hidden) closeConfirm(false); });

    $("neTabSent").addEventListener("click", function () { state.tab = "sent"; renderList(); });
    $("neTabDraft").addEventListener("click", function () { state.tab = "draft"; renderList(); });
    $("notifList").addEventListener("click", onListClick);

    window.addEventListener("beforeunload", function (e) {
      if (!state.busy) return; e.preventDefault(); e.returnValue = "";
    });

    applyLang(); renderImage(); renderErrors(); updatePreview(); refreshButtons();
  }

  /* Public hooks used by admin.js */
  window.NotifEditor = {
    refresh: function () { applyLang(); loadAudience(); return loadList(); },
    applyLang: applyLang
  };

  init();
})();

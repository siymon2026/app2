/* SIYMON — customer wallet page.
 * Every number shown here comes from /api/customer/wallet (server-side ledger).
 * The page never computes a balance, never sends an amount the server should own,
 * and never claims a top-up succeeded: it shows the real status of the request. */
(function () {
  "use strict";

  var TOKEN_KEY = "siymon_customer_token_v1";
  var LANG_KEY = "siymon_lang_v1";
  var HIDE_KEY = "siymon_wallet_hidden";
  var EMBED = /[?&]embed=1/.test(location.search);

  /* ------------------------------------------------------------------ i18n */
  var T = {
    ar: {
      title: "المحفظة", back: "رجوع", clear: "إظهار/إخفاء الرصيد",
      bal: "الرصيد المتاح", note: "يُستخدم لدفع قيمة المنتجات؛ رسوم التوصيل تُدفع عند التسليم",
      topup: "شحن المحفظة", history: "السجل",
      added: "إجمالي المُضاف", used: "إجمالي المُستخدم", refunded: "إجمالي المُسترجع",
      loyalty: "نقاط الوفاء", points: "نقطة", value: "قيمتها", pointsAvailable: "النقاط المتاحة",
      earned: "مكتسبة", pendingPts: "قيد التأكيد", usedPts: "مستخدمة", expired: "منتهية",
      convert: "تحويل", convertTitle: "تحويل النقاط إلى رصيد",
      convertHint: "أدخل عدد النقاط؛ سيحوّلها الخادم بسعر الصرف الرسمي.",
      convertBtn: "تحويل إلى المحفظة", preview: "ستُضاف إلى محفظتك",
      minPts: "الحد الأدنى للتحويل", rate: "سعر الصرف", expiry: "الصلاحية", noExpiry: "بدون انتهاء",
      disabledLoyalty: "برنامج نقاط الوفاء غير مفعّل حاليًا. رصيدك ونقاطك السابقة محفوظة كما هي.",
      needPoints: "أدخل عدد نقاط صحيح", belowMin: "الحد الأدنى للتحويل هو {n} نقطة",
      notEnough: "نقاطك المتاحة لا تكفي ({n} نقطة)", converted: "تم تحويل {p} نقطة إلى {m}",
      convertFail: "تعذّر إتمام التحويل",
      terms: "الشروط والأحكام", rules: "كيف تكسب النقاط؟", campaigns: "العروض الحالية",
      topTitle: "شحن المحفظة", topLead: "اختر طريقة متاحة، حوّل المبلغ، ثم أرسل المرجع. لن يُضاف الرصيد قبل تحقق المشرف.",
      method: "طريقة الدفع", noneMethod: "لا توجد طريقة شحن متاحة حاليًا.",
      unavailable: "غير متاحة", amount: "المبلغ", limits: "من {min} إلى {max} درهم",
      fee: "الرسوم", credit: "سيُضاف إلى رصيدك", reference: "مرجع التحويل", receipt: "صورة الوصل",
      fine: "لا يُضاف الرصيد إلا بعد التحقق من وصول المبلغ. الاحتيال يعرّض الحساب للإيقاف.",
      send: "إرسال طلب الشحن", sending: "جارٍ الإرسال…",
      sentPending: "تم إرسال الطلب وهو قيد المراجعة. سيُضاف الرصيد بعد التأكيد.",
      needMethod: "اختر طريقة دفع متاحة", needAmount: "أدخل مبلغًا صحيحًا",
      needRef: "أدخل مرجع التحويل (٤ أحرف على الأقل)", needReceipt: "أرفق صورة الوصل",
      retry: "إعادة المحاولة", other: "اختيار طريقة أخرى",
      failed: "فشل إرسال الطلب", viewHistory: "عرض السجل",
      histTitle: "سجل الحركات", all: "الكل", tTopup: "شحن", tPay: "دفع طلب", tRefund: "استرجاع",
      tLoyalty: "تحويل نقاط", tAdjust: "تعديل إداري", tOther: "حركة أخرى", empty: "لا توجد حركات بعد",
      stSucceeded: "ناجحة", stPending: "قيد المراجعة", stFailed: "فاشلة", stCanceled: "ملغاة", stReversed: "معكوسة",
      login: "سجّل الدخول لعرض محفظتك ورصيدك ونقاطك.", loginBtn: "تسجيل الدخول",
      errNet: "تعذّر الاتصال بالخادم. تحقق من الشبكة وحاول مجددًا.", errAuth: "انتهت الجلسة. سجّل الدخول مجددًا.",
      ref: "المرجع", orderRef: "الطلب", termsWallet: "الحد الأدنى للشحن {min} والحد الأقصى {max} درهم. لا يمكن استخدام الرصيد إلا بعد تأكيد الشحن.",
    },
    fr: {
      title: "Portefeuille", back: "Retour", clear: "Afficher/masquer le solde",
      bal: "Solde disponible", note: "Sert à payer les articles ; la livraison se paie à la réception",
      topup: "Recharger", history: "Historique",
      added: "Total ajouté", used: "Total utilisé", refunded: "Total remboursé",
      loyalty: "Points de fidélité", points: "points", value: "Valeur", pointsAvailable: "Points disponibles",
      earned: "Gagnés", pendingPts: "En attente", usedPts: "Utilisés", expired: "Expirés",
      convert: "Convertir", convertTitle: "Convertir les points en solde",
      convertHint: "Saisissez un nombre de points ; la conversion utilise le taux officiel.",
      convertBtn: "Convertir en solde", preview: "Sera ajouté au portefeuille",
      minPts: "Minimum de conversion", rate: "Taux", expiry: "Validité", noExpiry: "Sans expiration",
      disabledLoyalty: "Le programme de fidélité est désactivé. Votre solde et vos points sont conservés.",
      needPoints: "Saisissez un nombre de points valide", belowMin: "Le minimum est de {n} points",
      notEnough: "Points insuffisants ({n} disponibles)", converted: "{p} points convertis en {m}",
      convertFail: "La conversion a échoué",
      terms: "Conditions d'utilisation", rules: "Comment gagner des points ?", campaigns: "Offres en cours",
      topTitle: "Recharger le portefeuille", topLead: "Choisissez un mode disponible, effectuez le virement puis indiquez la référence. Le solde est crédité après vérification.",
      method: "Mode de paiement", noneMethod: "Aucun mode de recharge disponible.",
      unavailable: "Indisponible", amount: "Montant", limits: "De {min} à {max} MAD",
      fee: "Frais", credit: "Sera crédité", reference: "Référence du virement", receipt: "Reçu",
      fine: "Le solde n'est crédité qu'après vérification du paiement. Toute fraude entraîne la suspension du compte.",
      send: "Envoyer la demande", sending: "Envoi…",
      sentPending: "Demande envoyée, en attente de vérification. Le solde sera crédité après confirmation.",
      needMethod: "Choisissez un mode disponible", needAmount: "Montant invalide",
      needRef: "Indiquez la référence (4 caractères min.)", needReceipt: "Joignez le reçu",
      retry: "Réessayer", other: "Choisir un autre mode",
      failed: "Échec de l'envoi", viewHistory: "Voir l'historique",
      histTitle: "Historique", all: "Tout", tTopup: "Recharge", tPay: "Paiement commande", tRefund: "Remboursement",
      tLoyalty: "Conversion", tAdjust: "Ajustement", tOther: "Autre", empty: "Aucun mouvement",
      stSucceeded: "Réussie", stPending: "En attente", stFailed: "Échouée", stCanceled: "Annulée", stReversed: "Annulée (contre-passation)",
      login: "Connectez-vous pour voir votre portefeuille et vos points.", loginBtn: "Se connecter",
      errNet: "Connexion au serveur impossible. Vérifiez le réseau et réessayez.", errAuth: "Session expirée. Reconnectez-vous.",
      ref: "Référence", orderRef: "Commande", termsWallet: "Recharge minimale {min}, maximale {max} MAD. Le solde n'est utilisable qu'après confirmation.",
    },
    en: {
      title: "Wallet", back: "Back", clear: "Show/hide balance",
      bal: "Available balance", note: "Used to pay for items; delivery is paid on delivery",
      topup: "Top up", history: "History",
      added: "Total added", used: "Total used", refunded: "Total refunded",
      loyalty: "Loyalty points", points: "points", value: "Worth", pointsAvailable: "Available points",
      earned: "Earned", pendingPts: "Pending", usedPts: "Used", expired: "Expired",
      convert: "Convert", convertTitle: "Convert points to balance",
      convertHint: "Enter a number of points; the server applies the official rate.",
      convertBtn: "Convert to wallet", preview: "Will be added to your wallet",
      minPts: "Minimum conversion", rate: "Rate", expiry: "Validity", noExpiry: "No expiry",
      disabledLoyalty: "The loyalty programme is currently off. Your balance and points are kept as they are.",
      needPoints: "Enter a valid number of points", belowMin: "The minimum is {n} points",
      notEnough: "Not enough points ({n} available)", converted: "{p} points converted to {m}",
      convertFail: "The conversion failed",
      terms: "Terms & conditions", rules: "How do you earn points?", campaigns: "Current offers",
      topTitle: "Top up your wallet", topLead: "Pick an available method, send the transfer, then submit the reference. The balance is credited only after verification.",
      method: "Payment method", noneMethod: "No top-up method is available right now.",
      unavailable: "Unavailable", amount: "Amount", limits: "From {min} to {max} MAD",
      fee: "Fee", credit: "Will be credited", reference: "Transfer reference", receipt: "Receipt",
      fine: "The balance is credited only after the payment is verified. Fraud leads to account suspension.",
      send: "Submit top-up request", sending: "Sending…",
      sentPending: "Request sent and pending review. The balance is credited once confirmed.",
      needMethod: "Choose an available method", needAmount: "Enter a valid amount",
      needRef: "Enter the transfer reference (4 characters min.)", needReceipt: "Attach the receipt",
      retry: "Try again", other: "Choose another method",
      failed: "Could not send the request", viewHistory: "View history",
      histTitle: "Transactions", all: "All", tTopup: "Top-up", tPay: "Order payment", tRefund: "Refund",
      tLoyalty: "Points conversion", tAdjust: "Manual adjustment", tOther: "Other", empty: "No transactions yet",
      stSucceeded: "Successful", stPending: "Pending", stFailed: "Failed", stCanceled: "Canceled", stReversed: "Reversed",
      login: "Sign in to see your wallet, balance and points.", loginBtn: "Sign in",
      errNet: "Cannot reach the server. Check your connection and try again.", errAuth: "Session expired. Please sign in again.",
      ref: "Reference", orderRef: "Order", termsWallet: "Minimum top-up {min}, maximum {max} MAD. The balance can only be used after confirmation.",
    },
  };

  /* ----------------------------------------------------------------- state */
  var state = {
    lang: "ar",
    token: "",
    data: null,
    methods: [],
    methodId: "",
    filter: "all",
    hidden: false,
    sending: false,
    converting: false,
    notice: "",
    noticeKind: "",
  };

  try { state.lang = localStorage.getItem(LANG_KEY) || "ar"; } catch (e) {}
  if (["ar", "fr", "en"].indexOf(state.lang) < 0) state.lang = "ar";
  try { state.token = localStorage.getItem(TOKEN_KEY) || ""; } catch (e) {}
  try { state.hidden = localStorage.getItem(HIDE_KEY) === "1"; } catch (e) {}

  function t(key) { return (T[state.lang] && T[state.lang][key]) || T.ar[key] || key; }
  function fmt(key, vars) {
    var s = t(key);
    Object.keys(vars || {}).forEach(function (k) { s = s.replace("{" + k + "}", vars[k]); });
    return s;
  }
  function $(id) { return document.getElementById(id); }
  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function mad(v) { return num(v).toFixed(2); }
  function r2(v) { return Math.round(num(v) * 100) / 100; }
  function fmtDate(iso) {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleString(state.lang === "ar" ? "ar-MA" : state.lang, {
        dateStyle: "medium", timeStyle: "short",
      });
    } catch (e) { return String(iso).slice(0, 16).replace("T", " "); }
  }
  function mname(m) { return (m && m.name && (m.name[state.lang] || m.name.ar || m.name.en)) || (m && m.id) || ""; }

  /* ------------------------------------------------------------------- api */
  function api(path, opts) {
    opts = opts || {};
    var headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
    if (state.token) headers["X-Customer-Token"] = state.token;
    return fetch(path, Object.assign({}, opts, { headers: headers, cache: "no-store" })).then(function (res) {
      return res.text().then(function (text) {
        var body = {};
        try { body = text ? JSON.parse(text) : {}; } catch (e) { body = {}; }
        if (!res.ok) {
          var err = new Error(body.error || "HTTP " + res.status);
          err.status = res.status;
          err.code = body.code || "";
          err.body = body;
          throw err;
        }
        return body;
      });
    });
  }

  function notifyParent() {
    if (!EMBED) return;
    try { window.parent.postMessage({ type: "siymon:wallet", event: "changed" }, "*"); } catch (e) {}
  }

  /* ------------------------------------------------------------ navigation */
  function showPanel(which) {
    $("wHome").classList.toggle("hidden", which !== "home");
    $("wTopPanel").classList.toggle("hidden", which !== "topup");
    $("wHistPanel").classList.toggle("hidden", which !== "history");
    if (which === "topup") renderMethods();
    if (which === "history") renderHistory();
    try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch (e) {}
  }

  /* ---------------------------------------------------------------- render */
  function applyStatic() {
    var html = document.documentElement;
    html.lang = state.lang;
    html.dir = state.lang === "ar" ? "rtl" : "ltr";
    document.title = "siymon | " + t("title");
    $("wTitle").textContent = t("title");
    $("wBalLabel").textContent = t("bal");
    $("wTopBtn").textContent = t("topup");
    $("wHistBtn").textContent = t("history");
    $("wTopTitle").textContent = t("topTitle");
    $("wTopLead").textContent = t("topLead");
    $("wAmountLabel").textContent = t("amount");
    $("wRefLabel").textContent = t("reference");
    $("wRcptLabel").textContent = t("receipt");
    $("wFine").textContent = t("fine");
    $("wSend").textContent = t("send");
    $("wHistTitle").textContent = t("histTitle");
    $("wTermsTitle").textContent = t("terms");
    $("wRetryBtn").textContent = t("retry");
    $("wOtherBtn").textContent = t("other");
    $("wAmount").placeholder = "0.00";
    $("wEye").classList.toggle("is-off", state.hidden);
    Array.prototype.forEach.call(document.querySelectorAll("[data-lang]"), function (b) {
      b.classList.toggle("is-on", b.getAttribute("data-lang") === state.lang);
      b.setAttribute("aria-pressed", String(b.getAttribute("data-lang") === state.lang));
    });
    if (EMBED) $("wBack").setAttribute("href", "javascript:void 0");
  }

  function renderBalance() {
    var d = state.data || {};
    $("wBal").textContent = state.hidden ? "••••" : mad(d.walletBalance);
    $("wCur").textContent = d.currency || "MAD";
    $("wBalNote").textContent = t("note");
    $("wEye").classList.toggle("is-off", state.hidden);
    $("wEye").setAttribute("aria-pressed", String(!state.hidden));
    $("wEye").setAttribute("aria-label", t("clear"));
  }

  function renderStats() {
    var totals = (state.data && state.data.totals) || {};
    if (!totals.totalIn && !totals.added) {
      // derive from the visible movements when the server does not send totals
      var derived = { added: 0, used: 0, refunded: 0 };
      transactionsOf(state.data || {}).forEach(function (tx) {
        if (tx.status !== "succeeded") return;
        if (tx.type === "topup" && tx.direction === "credit") derived.added += num(tx.amount);
        if (tx.type === "refund" && tx.direction === "credit") derived.refunded += num(tx.amount);
        if (tx.type === "order_payment" && tx.direction === "debit") derived.used += num(tx.amount);
      });
      totals = Object.assign({}, totals, derived);
    }
    var box = $("wStats");
    box.innerHTML = [
      { k: "in", l: t("added"), v: totals.added },
      { k: "out", l: t("used"), v: totals.used },
      { k: "back", l: t("refunded"), v: totals.refunded },
    ].map(function (s) {
      return '<div class="w-stat ' + s.k + '"><span>' + esc(s.l) + "</span><b>" + esc(mad(s.v)) + "</b></div>";
    }).join("");
  }

  function renderLoyalty() {
    var box = $("wLoyalty");
    var loy = (state.data && state.data.loyalty) || null;
    if (!loy || !loy.program) { box.classList.add("hidden"); return; }
    box.classList.remove("hidden");
    var p = loy.program || {};
    var b = loy.balances || {};
    var on = !!p.enabled;
    var perUnit = num(loy.pointsPerCurrencyUnit) || 1;
    var minPoints = num(loy.minPoints) || 1;
    var maxTx = num(loy.maxPointsPerTx) || 0;
    var avail = num(b.available);

    var head =
      '<div class="w-card-head"><h2>' + esc(t("loyalty")) + "</h2>" +
      (on ? '<span class="w-pill">' + esc(t("pointsAvailable")) + "</span>"
          : '<span class="w-pill off">' + esc(state.lang === "ar" ? "متوقف" : state.lang === "fr" ? "En pause" : "Paused") + "</span>") +
      "</div>";

    var pointsRow =
      '<div class="w-points"><div class="w-points-val">' + esc(avail) + '<small>' + esc(t("points")) + "</small></div>" +
      '<div class="w-points-side"><b>' + esc(mad(loy.valueMAD)) + " " + esc((state.data && state.data.currency) || "MAD") + "</b><small>" + esc(t("value")) + "</small></div></div>";

    var grid =
      '<div class="w-loy-grid">' +
      "<div><span>" + esc(t("earned")) + "</span><b>" + esc(num(b.earnedTotal)) + "</b></div>" +
      "<div><span>" + esc(t("pendingPts")) + "</span><b>" + esc(num(b.pending)) + "</b></div>" +
      "<div><span>" + esc(t("usedPts")) + "</span><b>" + esc(num(b.used)) + "</b></div>" +
      "<div><span>" + esc(t("expired")) + "</span><b>" + esc(num(b.expired)) + "</b></div>" +
      "</div>";

    var notes = [];
    if (p.earn && p.earn.rule) notes.push(p.earn.rule);
    if (on) {
      notes.push(
        fmt("minPts", { n: minPoints }) + ": " + minPoints + " · " +
        t("rate") + ": " + (maxTx ? "max " + maxTx + " · " : "") + perUnit + " pts = 1 " + ((state.data && state.data.currency) || "MAD")
      );
      notes.push(t("expiry") + ": " + (p.expiry && p.expiry.enabled ? p.expiry.days + " " + (state.lang === "ar" ? "يوم" : state.lang === "fr" ? "jours" : "days") : t("noExpiry")));
      (p.campaigns || []).forEach(function (c) {
        if (c && (c.name || c.title)) notes.push(t("campaigns") + ": " + (c.name || c.title) + (c.bonusPoints ? " +" + c.bonusPoints + " " + t("points") : ""));
      });
    }

    var body = "";
    if (!on) {
      body = '<p class="w-muted" style="margin:10px 0 0">' + esc(t("disabledLoyalty")) + "</p>";
    } else {
      body =
        '<div class="w-convert">' +
        "<label class=\"w-label\" for=\"wPts\">" + esc(t("convertTitle")) + "</label>" +
        '<div class="w-convert-row">' +
        '<input id="wPts" type="number" inputmode="numeric" step="1" min="1" placeholder="' + esc(String(minPoints)) + '" dir="ltr" />' +
        '<button class="w-btn" type="button" id="wConvertBtn">' + esc(t("convert")) + "</button>" +
        "</div>" +
        '<p class="w-preview" id="wPreview">' + esc(t("convertHint")) + "</p>" +
        '<div class="w-loy-msg" id="wLoyMsg" role="alert"></div>' +
        "</div>";
    }

    box.innerHTML = head + pointsRow + grid +
      (notes.length ? '<ul class="w-loy-notes"><li>' + notes.map(esc).join("</li><li>") + "</li></ul>" : "") +
      body;

    if (on) bindConvert(avail, minPoints, perUnit, maxTx);
  }

  function bindConvert(avail, minPoints, perUnit, maxTx) {
    var input = $("wPts");
    var btn = $("wConvertBtn");
    var preview = $("wPreview");
    var msg = $("wLoyMsg");
    if (!input || !btn) return;

    function points() {
      var v = Number(input.value);
      return isFinite(v) && v > 0 ? Math.floor(v) : 0;
    }
    function update() {
      var pts = points();
      if (!pts) { preview.textContent = t("convertHint"); btn.disabled = true; return; }
      preview.innerHTML = esc(t("preview")) + ": <b>" + esc(mad(pts / perUnit)) + " " + esc((state.data && state.data.currency) || "MAD") + "</b>";
      btn.disabled = state.converting || pts < minPoints || pts > avail || (maxTx > 0 && pts > maxTx);
    }
    input.addEventListener("input", function () { msg.textContent = ""; msg.className = "w-loy-msg"; update(); });

    btn.addEventListener("click", function () {
      var pts = points();
      msg.className = "w-loy-msg";
      msg.textContent = "";
      if (!pts) { msg.className = "w-loy-msg err"; msg.textContent = t("needPoints"); return; }
      if (pts < minPoints) { msg.className = "w-loy-msg err"; msg.textContent = fmt("belowMin", { n: minPoints }); return; }
      if (pts > avail) { msg.className = "w-loy-msg err"; msg.textContent = fmt("notEnough", { n: avail }); return; }
      if (maxTx > 0 && pts > maxTx) { msg.className = "w-loy-msg err"; msg.textContent = fmt("belowMin", { n: maxTx }); return; }
      state.converting = true;
      btn.disabled = true;
      var requestId = "rd-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
      api("/api/customer/wallet/loyalty/redeem", {
        method: "POST",
        body: JSON.stringify({ points: pts, requestId: requestId }),
      }).then(function (res) {
        msg.className = "w-loy-msg ok";
        msg.textContent = fmt("converted", { p: num(res.points), m: mad(res.amount) + " " + (res.currency || "MAD") });
        input.value = "";
        notifyParent();
        return load();
      }).catch(function (err) {
        msg.className = "w-loy-msg err";
        msg.textContent = redeemError(err, { avail: avail, min: minPoints });
      }).then(function () {
        state.converting = false;
        update();
      });
    });
    update();
  }

  function redeemError(err, ctx) {
    var code = err.code || "";
    if (code === "BELOW_MIN_POINTS") return fmt("belowMin", { n: (err.body && err.body.minPoints) || ctx.min });
    if (code === "ABOVE_MAX_POINTS") return fmt("belowMin", { n: (err.body && err.body.maxPoints) || "" });
    if (code === "INSUFFICIENT_POINTS") return fmt("notEnough", { n: num(err.body && err.body.available) });
    if (code === "DAILY_LIMIT") return state.lang === "ar" ? "تم بلوغ الحد اليومي للتحويل." : state.lang === "fr" ? "Limite journalière atteinte." : "Daily conversion limit reached.";
    if (code === "REDEEM_DISABLED") return t("disabledLoyalty");
    if (err.status === 401) return t("errAuth");
    return (err.body && err.body.error) || err.message || t("convertFail");
  }

  function renderTerms() {
    var loy = (state.data && state.data.loyalty) || {};
    var program = loy.program || {};
    var wallet = (state.data && state.data.wallet) || {};
    var parts = [];
    if (program.terms) parts.push(program.terms);
    if (program.customTerms) parts.push(program.customTerms);
    parts.push(fmt("termsWallet", { min: mad(wallet.minTopup), max: mad(wallet.maxTopup) }));
    $("wTerms").textContent = parts.join("\n\n");
  }

  /* --------------------------------------------------------------- top-up */
  function renderMethods() {
    var box = $("wMethods");
    var list = state.methods || [];
    if (!list.length) {
      box.innerHTML = '<div class="w-empty">' + esc(t("noneMethod")) + "</div>";
      return;
    }
    if (!state.methodId) {
      var firstOk = list.filter(function (m) { return m.available; })[0];
      state.methodId = firstOk ? firstOk.id : "";
    }
    box.innerHTML = list.map(function (m) {
      var on = m.id === state.methodId && m.available;
      var icon = m.kind === "transfer" ? "🏦" : m.id === "stripe" ? "💳" : m.id === "paypal" ? "🅿️" : "•";
      var msg = m.statusMessage;
      var note = msg ? (typeof msg === "string" ? msg : msg[state.lang] || msg.ar || msg.en || "") : "";
      if (!note && !m.available) note = m.reason === "not_integrated" ? t("unavailable") : t("unavailable");
      return '<button type="button" class="w-method' + (on ? " is-on" : "") + '" data-m="' + esc(m.id) + '"' +
        (m.available ? "" : " disabled") + ' role="radio" aria-checked="' + (on ? "true" : "false") + '">' +
        '<span class="w-m-ic" aria-hidden="true">' + icon + "</span>" +
        '<span class="w-m-txt"><b>' + esc(mname(m)) + "</b>" + (note ? "<small>" + esc(note) + "</small>" : "") + "</span>" +
        (m.available ? (on ? '<span class="w-m-check" aria-hidden="true">✓</span>' : "")
                     : '<span class="w-m-badge">' + esc(t("unavailable")) + "</span>") +
        "</button>";
    }).join("");
    renderMethodInfo();
    renderPresets();
    renderQuote();
  }

  function currentMethod() {
    return (state.methods || []).filter(function (m) { return m.id === state.methodId; })[0] || null;
  }

  function renderMethodInfo() {
    var m = currentMethod();
    var box = $("wMethodInfo");
    if (!m || !m.available || !m.account) { box.classList.add("hidden"); box.innerHTML = ""; return; }
    var a = m.account;
    var rows = [];
    if (a.holderName) rows.push((state.lang === "ar" ? "المستفيد" : state.lang === "fr" ? "Bénéficiaire" : "Beneficiary") + ": " + a.holderName);
    if (a.bankName) rows.push((state.lang === "ar" ? "البنك" : state.lang === "fr" ? "Banque" : "Bank") + ": " + a.bankName);
    if (a.rib) rows.push("RIB: " + a.rib);
    if (a.iban) rows.push("IBAN: " + a.iban);
    if (a.accountNumber) rows.push("N°: " + a.accountNumber);
    if (a.paymentIdentifier) rows.push("ID: " + a.paymentIdentifier);
    if (a.branch) rows.push((state.lang === "ar" ? "الوكالة" : state.lang === "fr" ? "Agence" : "Branch") + ": " + a.branch);
    if (a.referenceFormat) rows.push(t("ref") + ": " + a.referenceFormat);
    if (a.instructions) rows.push(a.instructions[state.lang] || a.instructions.ar || "");
    box.innerHTML = esc(rows.join("\n")) + (m.qrImage ? '<img src="' + esc(m.qrImage) + '" alt="QR" />' : "");
    box.classList.remove("hidden");
  }

  function renderPresets() {
    var wallet = (state.data && state.data.wallet) || {};
    var presets = Array.isArray(wallet.presets) ? wallet.presets : [];
    var box = $("wPresets");
    box.innerHTML = presets.map(function (p) {
      return '<button type="button" class="w-chip" data-amount="' + esc(p) + '">' + esc(mad(p)) + "</button>";
    }).join("");
    box.classList.toggle("hidden", !presets.length);
    $("wLimits").textContent = fmt("limits", { min: mad(wallet.minTopup), max: mad(wallet.maxTopup) });
    $("wAmount").value = $("wAmount").value || "";
  }

  function quoteFor(amount) {
    var wallet = (state.data && state.data.wallet) || {};
    var m = currentMethod();
    var min = Math.max(num(wallet.minTopup), m && m.minAmount != null ? num(m.minAmount) : 0, 1);
    var max = Math.min(num(wallet.maxTopup) || 1e9, m && m.maxAmount != null && num(m.maxAmount) > 0 ? num(m.maxAmount) : 1e9);
    var a = r2(amount);
    var fee = 0;
    if (a > 0) fee = r2(Math.min(a, num(wallet.feeFixed) + (a * num(wallet.feePercent)) / 100));
    return { amount: a, fee: fee, credit: r2(a - fee), min: min, max: max };
  }

  function renderQuote() {
    var box = $("wQuote");
    var a = Number($("wAmount").value);
    if (!(a > 0) || !currentMethod()) { box.classList.add("hidden"); box.innerHTML = ""; return; }
    var q = quoteFor(a);
    var cur = (state.data && state.data.currency) || "MAD";
    var rows =
      '<div><span>' + esc(t("amount")) + "</span><b>" + esc(mad(q.amount)) + " " + esc(cur) + "</b></div>" +
      '<div><span>' + esc(t("fee")) + "</span><b>" + esc(mad(q.fee)) + " " + esc(cur) + "</b></div>" +
      '<div class="total"><span>' + esc(t("credit")) + "</span><b>" + esc(mad(q.credit)) + " " + esc(cur) + "</b></div>";
    box.innerHTML = rows;
    box.classList.remove("hidden");
  }

  function toDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function setMsg(text, kind) {
    var box = $("wMsg");
    box.className = "w-msg" + (kind ? " " + kind : "");
    box.textContent = text || "";
    $("wRetry").classList.toggle("hidden", kind !== "err");
  }

  function topupError(err) {
    var code = err.code || "";
    var e = err.body || {};
    var cur = (state.data && state.data.currency) || "MAD";
    if (code === "BELOW_MIN") return fmt("limits", { min: mad(e.min), max: mad(e.max) });
    if (code === "ABOVE_MAX") return fmt("limits", { min: mad(e.min), max: mad(e.max) });
    if (code === "FEE_TOO_HIGH") return state.lang === "ar" ? "الرسوم تتجاوز المبلغ المطلوب." : state.lang === "fr" ? "Les frais dépassent le montant." : "The fee is higher than the amount.";
    if (code === "RECEIPT_REQUIRED") return t("needReceipt");
    if (code === "METHOD_UNAVAILABLE") return t("needMethod");
    if (code === "DUPLICATE") return state.lang === "ar" ? "هذا الطلب مُسجّل مسبقًا." : state.lang === "fr" ? "Cette demande existe déjà." : "This request already exists.";
    if (err.status === 401) return t("errAuth");
    if (err.status === 0) return t("errNet");
    return (e.error || err.message || t("failed"));
  }

  function submitTopup() {
    if (state.sending) return;
    var m = currentMethod();
    var amount = Number($("wAmount").value);
    var ref = String($("wRef").value || "").trim();
    var file = $("wRcpt").files && $("wRcpt").files[0];
    setMsg("", "");
    if (!m || !m.available) return setMsg(t("needMethod"), "err");
    if (!(amount > 0)) return setMsg(t("needAmount"), "err");
    var q = quoteFor(amount);
    if (amount < q.min || amount > q.max) return setMsg(fmt("limits", { min: mad(q.min), max: mad(q.max) }), "err");
    if (ref.replace(/[^A-Za-z0-9]/g, "").length < 4) return setMsg(t("needRef"), "err");
    if (m.requireReceipt && !file) return setMsg(t("needReceipt"), "err");

    state.sending = true;
    $("wSend").disabled = true;
    $("wSend").textContent = t("sending");
    setMsg("", "");

    var body = { methodId: m.id, amount: amount, reference: ref };
    var prep = file ? toDataUrl(file) : Promise.resolve(null);
    prep.then(function (dataUrl) {
      if (dataUrl) body.receipt = dataUrl;
      return api("/api/customer/wallet/topups", { method: "POST", body: JSON.stringify(body) });
    }).then(function (res) {
      var status = (res && res.topup && res.topup.status) || "pending";
      if (status === "pending") {
        setMsg(t("sentPending") + " " + t("viewHistory") + " ↓", "pending");
        $("wAmount").value = "";
        $("wRef").value = "";
        $("wRcpt").value = "";
        renderQuote();
        notifyParent();
        return load().then(function () { showPanel("history"); });
      }
      setMsg(t("sentPending"), "ok");
      return load();
    }).catch(function (err) {
      setMsg(topupError(err), "err");
    }).then(function () {
      state.sending = false;
      $("wSend").disabled = false;
      $("wSend").textContent = t("send");
    });
  }

  /* -------------------------------------------------------------- history */
  var FILTERS = ["all", "topup", "order_payment", "refund", "loyalty", "adjust"];
  function filterLabel(f) {
    return { all: t("all"), topup: t("tTopup"), order_payment: t("tPay"), refund: t("tRefund"), loyalty: t("tLoyalty"), adjust: t("tAdjust") }[f] || t("tOther");
  }
  function typeLabel(type) {
    return { topup: t("tTopup"), order_payment: t("tPay"), refund: t("tRefund"), loyalty: t("tLoyalty"), adjust: t("tAdjust") }[type] || t("tOther");
  }
  function statusLabel(s) {
    return { succeeded: t("stSucceeded"), pending: t("stPending"), failed: t("stFailed"), canceled: t("stCanceled"), reversed: t("stReversed") }[s] || s;
  }
  function iconFor(type, direction) {
    if (type === "topup") return "⬇";
    if (type === "refund") return "↩";
    if (type === "order_payment") return "🛒";
    if (type === "loyalty") return "★";
    if (type === "adjust") return "⚙";
    return direction === "credit" ? "＋" : "−";
  }

  // Build the history from the rich `transactions` list, or from the legacy
  // `walletHistory` entries when an older server answers. Never invent amounts.
  function transactionsOf(data) {
    if (Array.isArray(data.transactions) && data.transactions.length) return data.transactions;
    var legacy = Array.isArray(data.walletHistory) ? data.walletHistory : [];
    return legacy.map(function (h, i) {
      var amount = num(h.amount);
      return {
        id: h.id || "h" + i,
        type: h.type === "order_payment" || h.type === "order_refund" || h.type === "topup" || h.type === "loyalty_redeem" ? h.type === "loyalty_redeem" ? "loyalty" : h.type : /refund/.test(h.type || "") ? "refund" : /topup/.test(h.type || "") ? "topup" : /order/.test(h.type || "") ? "order_payment" : "other",
        direction: amount >= 0 ? "credit" : "debit",
        amount: Math.abs(amount),
        status: h.status || "succeeded",
        at: h.createdAt || h.at || null,
        orderId: h.orderId || null,
        reference: h.reference || null,
        note: h.note || "",
      };
    });
  }

  function renderHistory() {
    var box = $("wFilters");
    box.innerHTML = FILTERS.map(function (f) {
      return '<button type="button" class="w-filter' + (f === state.filter ? " is-on" : "") + '" data-f="' + f + '" role="tab" aria-selected="' + (f === state.filter) + '">' + esc(filterLabel(f)) + "</button>";
    }).join("");

    var all = state.data ? transactionsOf(state.data) : [];
    var rows = all.filter(function (tx) { return state.filter === "all" || tx.type === state.filter; });
    var list = $("wHist");
    if (!rows.length) { list.innerHTML = '<div class="w-empty">' + esc(t("empty")) + "</div>"; return; }

    list.innerHTML = rows.map(function (tx) {
      var credit = tx.direction === "credit";
      var amount = num(tx.amount);
      var sub = [fmtDate(tx.at)];
      if (tx.reference) sub.push(t("ref") + ": " + tx.reference);
      if (tx.orderId) sub.push(t("orderRef") + " #" + tx.orderId);
      if (tx.methodName) sub.push(tx.methodName);
      if (tx.note) sub.push(tx.note);
      return '<div class="w-tx' + (credit ? " deposit" : "") + '">' +
        '<span class="w-tx-ic" aria-hidden="true">' + iconFor(tx.type, tx.direction) + "</span>" +
        '<div class="w-tx-body"><b>' + esc(typeLabel(tx.type)) + "</b><small>" + esc(sub.filter(Boolean).join(" · ")) + "</small></div>" +
        '<div class="w-tx-amt"><b class="' + (credit ? "in" : "out") + '">' + (credit ? "+" : "−") + esc(mad(amount)) + "</b>" +
        '<span class="s-' + esc(tx.status) + '">' + esc(statusLabel(tx.status)) + "</span></div>" +
        "</div>";
    }).join("");
  }

  /* ---------------------------------------------------------------- login */
  function showAuth() {
    var box = $("wAuth");
    box.innerHTML = "<p>" + esc(t("login")) + "</p>" +
      '<a class="w-btn" href="/orders/?next=' + encodeURIComponent("/wallet/") + '">' + esc(t("loginBtn")) + "</a>";
    box.classList.remove("hidden");
    $("wHome").classList.add("hidden");
    $("wTopPanel").classList.add("hidden");
    $("wHistPanel").classList.add("hidden");
  }

  function hideAuth() {
    $("wAuth").classList.add("hidden");
    $("wHome").classList.remove("hidden");
  }

  /* ----------------------------------------------------------------- load */
  function load() {
    if (!state.token) { showAuth(); return Promise.resolve(); }
    return api("/api/customer/wallet?lang=" + encodeURIComponent(state.lang)).then(function (data) {
      state.data = data;
      hideAuth();
      renderBalance();
      renderStats();
      renderLoyalty();
      renderTerms();
      renderQuote();
      renderHistory();
      return data;
    }).catch(function (err) {
      if (err.status === 401) { showAuth(); return; }
      setMsg(err.status === 0 ? t("errNet") : (err.message || t("errNet")), "err");
      showPanel("topup");
    });
  }

  function loadMethods() {
    if (!state.token) return Promise.resolve();
    return api("/api/payment-methods?context=customerTopup").then(function (res) {
      // Every method of the top-up context is listed. Unsupported ones stay visible but
      // disabled: a customer must never see an unusable method presented as available.
      state.methods = (res.methods || []).map(function (m) {
        if (m.kind === "transfer") return m;
        return Object.assign({}, m, { available: false, reason: m.available ? "not_integrated" : m.reason });
      });
      renderMethods();
    }).catch(function () { state.methods = []; renderMethods(); });
  }

  /* --------------------------------------------------------------- events */
  document.addEventListener("click", function (e) {
    var langBtn = e.target.closest && e.target.closest("[data-lang]");
    if (langBtn) {
      state.lang = langBtn.getAttribute("data-lang");
      try { localStorage.setItem(LANG_KEY, state.lang); } catch (er) {}
      applyStatic();
      renderBalance(); renderStats(); renderLoyalty(); renderTerms(); renderMethods(); renderHistory();
      load();
      return;
    }
    var back = e.target.closest && e.target.closest("[data-back]");
    if (back) { showPanel("home"); return; }
    var mBtn = e.target.closest && e.target.closest(".w-method[data-m]");
    if (mBtn && !mBtn.disabled) {
      state.methodId = mBtn.getAttribute("data-m");
      setMsg("", "");
      renderMethods();
      return;
    }
    var chip = e.target.closest && e.target.closest(".w-chip[data-amount]");
    if (chip) {
      $("wAmount").value = chip.getAttribute("data-amount");
      Array.prototype.forEach.call(document.querySelectorAll(".w-chip"), function (c) { c.classList.remove("is-on"); });
      chip.classList.add("is-on");
      renderQuote();
      return;
    }
    var fBtn = e.target.closest && e.target.closest(".w-filter[data-f]");
    if (fBtn) { state.filter = fBtn.getAttribute("data-f"); renderHistory(); return; }
  });

  $("wTopBtn").addEventListener("click", function () { showPanel("topup"); });
  $("wHistBtn").addEventListener("click", function () { showPanel("history"); });
  $("wEye").addEventListener("click", function () {
    state.hidden = !state.hidden;
    try { localStorage.setItem(HIDE_KEY, state.hidden ? "1" : "0"); } catch (e) {}
    renderBalance();
  });
  $("wTermsBtn").addEventListener("click", function () {
    var open = $("wTermsBtn").getAttribute("aria-expanded") === "true";
    $("wTermsBtn").setAttribute("aria-expanded", String(!open));
    $("wTerms").classList.toggle("hidden", open);
  });
  $("wAmount").addEventListener("input", renderQuote);
  $("wSend").addEventListener("click", submitTopup);
  $("wRetryBtn").addEventListener("click", submitTopup);
  $("wOtherBtn").addEventListener("click", function () {
    state.methodId = "";
    setMsg("", "");
    renderMethods();
  });
  $("wBack").addEventListener("click", function (e) {
    if (!EMBED) return;
    e.preventDefault();
    try { window.parent.postMessage({ type: "siymon:wallet", event: "close" }, "*"); } catch (er) {}
  });

  // The parent (checkout sheet) can ask for a refresh after it changes something.
  window.addEventListener("message", function (e) {
    var d = e.data || {};
    if (d && d.type === "siymon:wallet-refresh") load();
  });

  if (EMBED) document.body.classList.add("embed");
  applyStatic();
  showPanel("home");
  if (!state.token) showAuth();
  else { load().then(loadMethods); }
})();

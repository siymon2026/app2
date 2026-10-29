(function () {
  "use strict";
  var TOKEN_KEY = "siymon_customer_token_v1", LANG_KEY = "siymon_lang_v1";
  var lang = "ar";
  try { lang = localStorage.getItem(LANG_KEY) || "ar"; } catch (e) {}
  if (["ar", "fr", "en"].indexOf(lang) < 0) lang = "ar";
  var token = "";
  try { token = localStorage.getItem(TOKEN_KEY) || ""; } catch (e) {}
  var T = {
    ar: { title: "المحفظة", bal: "الرصيد", top: "شحن المحفظة", method: "طريقة الدفع", pick: "اختر طريقة", amount: "المبلغ", ref: "مرجع التحويل", rcpt: "صورة الوصل", send: "إرسال", sending: "جارٍ الإرسال…", reqs: "طلبات الشحن", hist: "الحركات", none: "لا شيء بعد", login: "يرجى تسجيل الدخول أولا", loginBtn: "تسجيل الدخول", holder: "المستفيد", bank: "البنك/الخدمة", branch: "الوكالة", min: "الحد الأدنى", max: "الحد الأقصى", note: "لن يُضاف الرصيد إلا بعد أن يتحقق المشرف من وصول المبلغ.", ok: "تم إرسال الطلب وهو قيد المراجعة", needMethod: "اختر طريقة الدفع", needAmount: "أدخل مبلغا صحيحا", needRef: "أدخل مرجع التحويل", needRcpt: "أرفق صورة الوصل", st: { pending: "قيد المراجعة", approved: "مؤكد", rejected: "مرفوض", failed: "فشل" }, none_m: "لا توجد وسيلة شحن متاحة حاليا", view: "الوصل", topup: "شحن", order: "دفع طلب", refund: "استرجاع", other: "حركة" },
    fr: { title: "Portefeuille", bal: "Solde", top: "Recharger", method: "Mode de paiement", pick: "Choisir", amount: "Montant", ref: "Référence du virement", rcpt: "Reçu", send: "Envoyer", sending: "Envoi…", reqs: "Demandes de recharge", hist: "Mouvements", none: "Rien pour l'instant", login: "Veuillez vous connecter", loginBtn: "Se connecter", holder: "Bénéficiaire", bank: "Banque/Service", branch: "Agence", min: "Minimum", max: "Maximum", note: "Le solde n'est crédité qu'après vérification du virement par le superviseur.", ok: "Demande envoyée, en cours de vérification", needMethod: "Choisissez un mode", needAmount: "Montant invalide", needRef: "Saisissez la référence", needRcpt: "Joignez le reçu", st: { pending: "En attente", approved: "Confirmé", rejected: "Refusé", failed: "Échec" }, none_m: "Aucun mode de recharge disponible", view: "Reçu", topup: "Recharge", order: "Paiement commande", refund: "Remboursement", other: "Mouvement" },
    en: { title: "Wallet", bal: "Balance", top: "Top up", method: "Payment method", pick: "Select", amount: "Amount", ref: "Transfer reference", rcpt: "Receipt", send: "Submit", sending: "Sending…", reqs: "Top-up requests", hist: "Transactions", none: "Nothing yet", login: "Please sign in first", loginBtn: "Sign in", holder: "Beneficiary", bank: "Bank/Service", branch: "Branch", min: "Min", max: "Max", note: "The balance is credited only after the supervisor verifies the transfer.", ok: "Request sent and pending review", needMethod: "Choose a payment method", needAmount: "Enter a valid amount", needRef: "Enter the transfer reference", needRcpt: "Attach the receipt", st: { pending: "Pending", approved: "Confirmed", rejected: "Rejected", failed: "Failed" }, none_m: "No top-up method available", view: "Receipt", topup: "Top-up", order: "Order payment", refund: "Refund", other: "Transaction" },
  };
  var methods = [], sending = false;
  var $ = function (id) { return document.getElementById(id); };
  var t = function () { return T[lang]; };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fmt(d) { try { return new Date(d).toLocaleString(lang === "ar" ? "ar-MA" : lang, { dateStyle: "medium", timeStyle: "short" }); } catch (e) { return ""; } }
  async function api(url, opts) {
    opts = opts || {};
    var h = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
    if (token) h["X-Customer-Token"] = token;
    var r = await fetch(url, Object.assign({}, opts, { headers: h }));
    var j = {}; try { j = await r.json(); } catch (e) {}
    if (!r.ok) { var er = new Error(j.error || "HTTP " + r.status); er.status = r.status; throw er; }
    return j;
  }
  function showLogin() {
    var a = $("wAuth"); a.textContent = "";
    a.appendChild(document.createTextNode(t().login + " "));
    var l = document.createElement("a"); l.className = "w-btn w-login"; l.textContent = t().loginBtn;
    l.href = "/orders/?next=" + encodeURIComponent("/wallet/"); l.target = "_top"; // top window: also works inside the wallet sheet
    a.appendChild(l); a.classList.remove("hidden"); $("wForm").classList.add("hidden");
  }
  function applyText() {
    var x = t();
    document.documentElement.lang = lang; document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    $("wTitle").textContent = x.title; $("wBalLabel").textContent = x.bal; $("wTopTitle").textContent = x.top;
    $("wMethodLabel").textContent = x.method; $("wAmountLabel").textContent = x.amount; $("wRefLabel").textContent = x.ref;
    $("wRcptLabel").textContent = x.rcpt; $("wSend").textContent = x.send; $("wReqTitle").textContent = x.reqs; $("wHistTitle").textContent = x.hist;
    $("wLang").value = lang; renderMethods(); renderInfo();
  }
  function mname(m) { return (m.name && (m.name[lang] || m.name.ar)) || m.id; }
  function renderMethods() {
    var sel = $("wMethod"), cur = sel.value;
    sel.innerHTML = '<option value="">' + esc(t().pick) + "</option>" + methods.map(function (m) { return '<option value="' + esc(m.id) + '">' + esc(mname(m)) + "</option>"; }).join("");
    sel.value = cur;
  }
  function current() { return methods.find(function (m) { return m.id === $("wMethod").value; }) || null; }
  function renderInfo() {
    var m = current(), x = t();
    if (!m) { $("wInfo").textContent = methods.length ? "" : x.none_m; $("wQr").classList.add("hidden"); return; }
    var a = m.account || {};
    var rows = [a.holderName && x.holder + ": " + a.holderName, a.bankName && x.bank + ": " + a.bankName, a.rib && "RIB: " + a.rib, a.iban && "IBAN: " + a.iban,
      a.accountNumber && "N°: " + a.accountNumber, a.paymentIdentifier && "ID: " + a.paymentIdentifier, a.branch && x.branch + ": " + a.branch,
      a.referenceFormat && x.ref + ": " + a.referenceFormat, a.instructions && (a.instructions[lang] || a.instructions.ar),
      m.minAmount != null && x.min + ": " + m.minAmount, m.maxAmount != null && x.max + ": " + m.maxAmount,
      m.statusMessage && (m.statusMessage[lang] || m.statusMessage.ar), x.note].filter(Boolean);
    $("wInfo").textContent = rows.join("\n");
    if (m.qrImage) { $("wQr").src = m.qrImage; $("wQr").classList.remove("hidden"); } else $("wQr").classList.add("hidden");
  }
  function row(l, s, r) { return '<div class="w-row"><div>' + l + (s ? "<small>" + s + "</small>" : "") + "</div><div>" + r + "</div></div>"; }
  function render(w) {
    $("wBal").textContent = Number(w.walletBalance || 0).toFixed(2) + " " + esc(w.currency || "MAD");
    var x = t();
    $("wReqs").innerHTML = (w.topups || []).length ? w.topups.map(function (q) {
      var sub = [fmt(q.createdAt), q.reference ? "Ref: " + q.reference : "", (q.status === "rejected" || q.status === "failed") && q.decisionNote ? q.decisionNote : ""].filter(Boolean).map(esc).join(" · ");
      var v = q.hasReceipt ? ' <button class="w-st" data-r="' + esc(q.id) + '">' + esc(x.view) + "</button>" : "";
      return row("<b>" + esc(Number(q.amount).toFixed(2)) + "</b>", sub, '<span class="w-st ' + esc(q.status) + '">' + esc(x.st[q.status] || q.status) + "</span>" + v);
    }).join("") : '<div class="w-row">' + esc(x.none) + "</div>";
    $("wHist").innerHTML = (w.walletHistory || []).length ? w.walletHistory.map(function (h) {
      var amt = Number(h.amount || 0), cr = amt >= 0;
      var lab = h.type === "topup" ? x.topup : /order/.test(h.type || "") ? x.order : /refund/.test(h.type || "") ? x.refund : x.other;
      return row(esc(lab), esc([h.orderId ? "#" + h.orderId : "", fmt(h.createdAt || h.at)].filter(Boolean).join(" · ")), '<b class="' + (cr ? "in" : "out") + '">' + (cr ? "+" : "−") + Math.abs(amt).toFixed(2) + "</b>");
    }).join("") : '<div class="w-row">' + esc(x.none) + "</div>";
  }
  async function load() {
    if (!token) { showLogin(); return; }
    try {
      var w = await api("/api/customer/wallet"); render(w);
      var m = await api("/api/payment-methods?context=customerTopup");
      methods = (m.methods || []).filter(function (x) { return x.kind === "transfer" && x.available && x.account; });
      renderMethods(); renderInfo();
    } catch (e) {
      if (e.status === 401) { showLogin(); }
      else { $("wMsg").textContent = e.message; }
    }
  }
  function toDataUrl(f) { return new Promise(function (ok, no) { var r = new FileReader(); r.onload = function () { ok(r.result); }; r.onerror = no; r.readAsDataURL(f); }); }
  async function send() {
    if (sending) return;
    var x = t(), msg = $("wMsg"); msg.className = "w-msg"; msg.textContent = "";
    var m = current(), amount = Number($("wAmount").value), ref = $("wRef").value.trim(), f = $("wRcpt").files[0];
    if (!m) { msg.textContent = x.needMethod; return; }
    if (!(amount > 0)) { msg.textContent = x.needAmount; return; }
    if (ref.replace(/[^A-Za-z0-9]/g, "").length < 4) { msg.textContent = x.needRef; return; }
    if (m.requireReceipt && !f) { msg.textContent = x.needRcpt; return; }
    sending = true; $("wSend").disabled = true; $("wSend").textContent = x.sending;
    try {
      var body = { methodId: m.id, amount: amount, reference: ref };
      if (f) body.receipt = await toDataUrl(f);
      await api("/api/customer/wallet/topups", { method: "POST", body: JSON.stringify(body) });
      msg.className = "w-msg ok"; msg.textContent = x.ok;
      $("wAmount").value = ""; $("wRef").value = ""; $("wRcpt").value = "";
      await load();
    } catch (e) { msg.textContent = e.message; }
    finally { sending = false; $("wSend").disabled = false; $("wSend").textContent = x.send; }
  }
  async function viewReceipt(id) {
    var r = await fetch("/api/customer/wallet/topups/" + encodeURIComponent(id) + "/receipt", { headers: { "X-Customer-Token": token } });
    if (!r.ok) return;
    var u = URL.createObjectURL(await r.blob()); window.open(u, "_blank"); setTimeout(function () { URL.revokeObjectURL(u); }, 60000);
  }
  $("wLang").addEventListener("change", function (e) { lang = e.target.value; try { localStorage.setItem(LANG_KEY, lang); } catch (x) {} applyText(); load(); });
  $("wMethod").addEventListener("change", renderInfo);
  $("wSend").addEventListener("click", send);
  $("wReqs").addEventListener("click", function (e) { var b = e.target.closest("button[data-r]"); if (b) viewReceipt(b.getAttribute("data-r")); });
  if (/[?&]embed=1/.test(location.search)) document.body.classList.add("embed");
  applyText(); load();
})();

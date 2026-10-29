/* siymon — customer pharmacy page (/pharmacy/).
   Ask a pharmacy for a medicine (name and/or prescription photo) -> the pharmacist answers with availability + price
   -> you accept or refuse. Only an accepted offer becomes an order (then handled in /orders/ like any other order).
   Everything is read from / written to the server; nothing here decides prices. */
(function () {
  "use strict";
  var SP = window.SP;
  var $ = function (id) { return document.getElementById(id); };

  var T = {
    ar: {
      title: "الصيدلية", sub: "اطلب دواءك واعرف التوفر والسعر قبل الطلب", tabNew: "طلب دواء", tabMine: "طلباتي", back: "رجوع",
      pharmacy: "الصيدلية", medicine: "اسم الدواء (أو أكثر)", medicineHint: "مثال: دوليبران 1000 ملغ", rx: "أو صورة الوصفة الطبية", rxRemove: "إزالة الصورة",
      name: "الاسم", phone: "الهاتف", addr: "عنوان التوصيل", savedAddr: "عنوان محفوظ", myLoc: "استخدم موقعي", locOk: "تم تحديد موقعك", locFail: "تعذّر تحديد الموقع",
      note: "ملاحظة للصيدلي (اختياري)", send: "إرسال الطلب", sending: "جارٍ الإرسال…", sent: "تم إرسال طلبك للصيدلية", noStores: "لا توجد صيدلية متاحة حالياً",
      need: "اكتب اسم الدواء أو أرفق صورة الوصفة", needCustomer: "الاسم والهاتف والعنوان مطلوبة", noRequests: "لا توجد طلبات بعد",
      st_pending: "بانتظار ردّ الصيدلية", st_quoted: "تم الرد — بانتظار قرارك", st_unavailable: "غير متوفر", st_accepted: "تم قبول العرض", st_declined: "رفضتَ العرض", st_canceled: "ملغى", st_expired: "انتهت الصلاحية",
      offer: "عرض الصيدلية", meds: "الأدوية", delivery: "التوصيل", total: "المجموع", expires: "العرض صالح حتى", accept: "قبول وإرسال للتوصيل", decline: "رفض العرض", cancel: "إلغاء الطلب",
      payCod: "الدفع عند الاستلام", unavailMsg: "الدواء غير متوفر لدى الصيدلية", reason: "السبب", chat: "محادثة الصيدلي", rxView: "الوصفة المرفقة", openOrder: "متابعة الطلب",
      accepted: "تم! سيجهّز الصيدلي طلبك ثم يُسلَّم للسائق", priceChanged: "تغيّر السعر، راجع العرض", expired: "انتهت صلاحية العرض", closed: "هذا الطلب مغلق", tooMany: "لديك طلبات مفتوحة كثيرة",
      routeFail: "تعذّر حساب رسوم التوصيل الآن، حاول لاحقاً", confirmDecline: "رفض هذا العرض؟", confirmCancel: "إلغاء هذا الطلب؟", loadErr: "تعذّر التحميل", retry: "إعادة المحاولة", rxOnly: "وصفة طبية", tooBig: "الصورة كبيرة جداً",
      hours: "تقديم الطلب لا يعني الشراء: لن يُرسل شيء للسائق إلا بعد موافقتك على السعر.",
    },
    fr: {
      title: "Pharmacie", sub: "Demandez un médicament et connaissez dispo + prix avant de commander", tabNew: "Nouvelle demande", tabMine: "Mes demandes", back: "Retour",
      pharmacy: "Pharmacie", medicine: "Nom du/des médicament(s)", medicineHint: "ex. Doliprane 1000 mg", rx: "ou photo de l'ordonnance", rxRemove: "Retirer la photo",
      name: "Nom", phone: "Téléphone", addr: "Adresse de livraison", savedAddr: "Adresse enregistrée", myLoc: "Utiliser ma position", locOk: "Position enregistrée", locFail: "Position indisponible",
      note: "Note pour le pharmacien (facultatif)", send: "Envoyer la demande", sending: "Envoi…", sent: "Demande envoyée à la pharmacie", noStores: "Aucune pharmacie disponible",
      need: "Indiquez le médicament ou joignez l'ordonnance", needCustomer: "Nom, téléphone et adresse requis", noRequests: "Aucune demande",
      st_pending: "En attente de la pharmacie", st_quoted: "Réponse reçue — à vous de décider", st_unavailable: "Indisponible", st_accepted: "Offre acceptée", st_declined: "Offre refusée", st_canceled: "Annulée", st_expired: "Expirée",
      offer: "Offre de la pharmacie", meds: "Médicaments", delivery: "Livraison", total: "Total", expires: "Offre valable jusqu'à", accept: "Accepter et envoyer en livraison", decline: "Refuser l'offre", cancel: "Annuler la demande",
      payCod: "Paiement à la livraison", unavailMsg: "Médicament indisponible à la pharmacie", reason: "Motif", chat: "Discuter avec le pharmacien", rxView: "Ordonnance jointe", openOrder: "Suivre la commande",
      accepted: "C'est fait ! La pharmacie prépare, puis un livreur sera assigné", priceChanged: "Le prix a changé, revoyez l'offre", expired: "L'offre a expiré", closed: "Demande clôturée", tooMany: "Trop de demandes ouvertes",
      routeFail: "Frais de livraison indisponibles, réessayez", confirmDecline: "Refuser cette offre ?", confirmCancel: "Annuler cette demande ?", loadErr: "Chargement impossible", retry: "Réessayer", rxOnly: "Ordonnance", tooBig: "Image trop lourde",
      hours: "Une demande n'est pas un achat : rien n'est envoyé au livreur avant votre accord sur le prix.",
    },
    en: {
      title: "Pharmacy", sub: "Ask for a medicine and see availability + price before ordering", tabNew: "New request", tabMine: "My requests", back: "Back",
      pharmacy: "Pharmacy", medicine: "Medicine name(s)", medicineHint: "e.g. Doliprane 1000 mg", rx: "or a photo of the prescription", rxRemove: "Remove photo",
      name: "Name", phone: "Phone", addr: "Delivery address", savedAddr: "Saved address", myLoc: "Use my location", locOk: "Location saved", locFail: "Could not get location",
      note: "Note for the pharmacist (optional)", send: "Send request", sending: "Sending…", sent: "Your request was sent to the pharmacy", noStores: "No pharmacy available right now",
      need: "Enter a medicine name or attach a prescription photo", needCustomer: "Name, phone and address are required", noRequests: "No requests yet",
      st_pending: "Waiting for the pharmacy", st_quoted: "Answered — your decision", st_unavailable: "Unavailable", st_accepted: "Offer accepted", st_declined: "Offer declined", st_canceled: "Canceled", st_expired: "Expired",
      offer: "Pharmacy offer", meds: "Medicines", delivery: "Delivery", total: "Total", expires: "Offer valid until", accept: "Accept and send for delivery", decline: "Decline offer", cancel: "Cancel request",
      payCod: "Cash on delivery", unavailMsg: "The medicine is not available at this pharmacy", reason: "Reason", chat: "Chat with the pharmacist", rxView: "Attached prescription", openOrder: "Track order",
      accepted: "Done! The pharmacy will prepare it, then a driver is assigned", priceChanged: "The price changed, review the offer", expired: "The offer expired", closed: "This request is closed", tooMany: "Too many open requests",
      routeFail: "Delivery fee unavailable right now, try again", confirmDecline: "Decline this offer?", confirmCancel: "Cancel this request?", loadErr: "Could not load", retry: "Retry", rxOnly: "Prescription", tooBig: "Image too large",
      hours: "A request is not a purchase: nothing goes to a driver until you accept the price.",
    },
  };
  var t = function (k) { return SP.pick(T)[k] || T.ar[k] || k; };

  var state = { prefillText: "", prefillStore: "", tab: "new", detail: null, stores: [], profile: null, addresses: [], rx: null, geo: null, cid: null, busy: false };
  var timer = null;
  var money = function (n) { return Number(n || 0).toLocaleString(SP.lang === "ar" ? "ar-MA" : SP.lang === "fr" ? "fr-MA" : "en-US", { maximumFractionDigits: 2 }) + " MAD"; };
  var when = function (iso) { return SP.formatDate(iso); };
  function el(tag, props) {
    var n = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      var v = props[k];
      if (v == null || v === false) return;
      if (k === "class") n.className = v; else if (k === "text") n.textContent = v;
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), v);
      else if (k === "value") n.value = v; else n.setAttribute(k, v === true ? "" : v);
    });
    for (var i = 2; i < arguments.length; i++) { var c = arguments[i]; if (c == null || c === false) continue; (Array.isArray(c) ? c : [c]).forEach(function (x) { if (x != null && x !== false) n.appendChild(x.nodeType ? x : document.createTextNode(String(x))); }); }
    return n;
  }
  var curLang = function () { return SP.lang === "fr" || SP.lang === "en" ? SP.lang : "ar"; };
  var hint = function (m) { $("phHint").textContent = m || ""; };
  var newCid = function () { return "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); };
  function errMsg(e) {
    var code = e && e.data && e.data.code;
    var map = { OFFER_EXPIRED: "expired", PRICE_CHANGED: "priceChanged", REQUEST_CLOSED: "closed", NO_OFFER: "closed", TOO_MANY_OPEN: "tooMany", EMPTY_REQUEST: "need", MISSING_CUSTOMER: "needCustomer", ROUTING_UNAVAILABLE: "routeFail", ADDRESS_LOCATION_REQUIRED: "routeFail", OUT_OF_RANGE: "routeFail" };
    var m = e && e.data && e.data.message; // the server explains zone / distance refusals in ar|fr|en
    if (m && typeof m === "object" && m[curLang()]) return m[curLang()];
    return map[code] ? t(map[code]) : (e && e.message) || t("loadErr");
  }
  // api() of SP drops the response body on errors; read it here so we can map error codes
  async function call(path, opts) {
    opts = opts || {};
    var h = { "Content-Type": "application/json" };
    if (SP.getToken()) h.Authorization = "Bearer " + SP.getToken();
    var r = await fetch(path, { method: opts.method || "GET", headers: h, body: opts.body ? JSON.stringify(opts.body) : undefined });
    var d = await r.json().catch(function () { return {}; });
    if (r.status === 401) { SP.clearSession(); SP.toLogin(); throw Object.assign(new Error("unauth"), { status: 401, data: d }); }
    if (!r.ok) throw Object.assign(new Error(d.error || "HTTP " + r.status), { status: r.status, data: d });
    return d;
  }
  async function blobUrl(path) {
    var r = await fetch(path, { headers: { Authorization: "Bearer " + SP.getToken() } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return URL.createObjectURL(await r.blob());
  }

  /* ---------------- new request ---------------- */
  function resizeImage(file) {
    return new Promise(function (ok, bad) {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return bad(new Error("Unsupported image"));
      var fr = new FileReader();
      fr.onerror = function () { bad(new Error("read")); };
      fr.onload = function () {
        var img = new Image();
        img.onerror = function () { bad(new Error("image")); };
        img.onload = function () {
          var max = 1600, s = Math.min(1, max / Math.max(img.width, img.height));
          var c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          ok(c.toDataURL("image/jpeg", 0.82));
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  function renderNew() {
    var body = $("phBody"); body.replaceChildren();
    if (!state.stores.length) { body.appendChild(el("div", { class: "ph-empty", text: t("noStores") })); return; }
    var store = el("select", { id: "phStore", "aria-label": t("pharmacy") }, state.stores.map(function (s) { return el("option", { value: s.id, text: (s.name && (s.name[SP.lang] || s.name.ar || s.name.en)) || s.id }); }));
    var text = el("textarea", { id: "phText", maxlength: "1000", placeholder: t("medicineHint") });
    text.value = state.prefillText || "";
    if (state.prefillStore && state.stores.some(function (s) { return s.id === state.prefillStore; })) store.value = state.prefillStore;
    var file = el("input", { id: "phFile", type: "file", accept: "image/jpeg,image/png,image/webp" });
    var prev = el("div", {});
    var drawPrev = function () {
      prev.replaceChildren();
      if (!state.rx) return;
      prev.appendChild(el("img", { class: "ph-rx", src: state.rx, alt: t("rxOnly") }));
      prev.appendChild(el("div", {}, el("button", { class: "ph-btn ghost", type: "button", text: t("rxRemove"), onclick: function () { state.rx = null; file.value = ""; drawPrev(); } })));
    };
    file.addEventListener("change", async function () {
      hint("");
      var f = file.files && file.files[0]; if (!f) return;
      if (f.size > 15 * 1024 * 1024) { hint(t("tooBig")); file.value = ""; return; }
      try { state.rx = await resizeImage(f); drawPrev(); } catch (_e) { hint(t("loadErr")); file.value = ""; }
    });
    var p = state.profile || {};
    var name = el("input", { id: "phName", value: ((p.firstName || "") + " " + (p.lastName || "")).trim(), maxlength: "80" });
    var phone = el("input", { id: "phPhone", type: "tel", value: p.phone || "", maxlength: "25" });
    var addr = el("input", { id: "phAddr", maxlength: "300" });
    var saved = state.addresses.length ? el("select", { id: "phSaved", "aria-label": t("savedAddr"), onchange: function (e) {
      var a = state.addresses.filter(function (x) { return x.id === e.target.value; })[0];
      if (!a) return;
      addr.value = [a.city, a.hood, a.street, a.bldg, a.hint].filter(Boolean).join(", ");
      state.geo = a.lat != null && a.lng != null ? { lat: a.lat, lng: a.lng } : null;
    } }, [el("option", { value: "", text: "— " + t("savedAddr") + " —" })].concat(state.addresses.map(function (a) { return el("option", { value: a.id, text: a.label || a.hood || a.street || a.id }); }))) : null;
    var locBtn = el("button", { class: "ph-btn ghost", type: "button", id: "phLoc", text: "📍 " + t("myLoc"), onclick: function () {
      if (!navigator.geolocation) return hint(t("locFail"));
      navigator.geolocation.getCurrentPosition(function (pos) { state.geo = { lat: pos.coords.latitude, lng: pos.coords.longitude }; hint(t("locOk")); }, function () { hint(t("locFail")); }, { enableHighAccuracy: true, timeout: 10000 });
    } });
    var note = el("textarea", { id: "phNote", maxlength: "500" });
    var send = el("button", { class: "ph-btn", type: "button", id: "phSend", text: t("send") });
    send.addEventListener("click", async function () {
      if (state.busy) return;
      hint("");
      if (!text.value.trim() && !state.rx) return hint(t("need"));
      if (!name.value.trim() || !phone.value.trim() || !addr.value.trim()) return hint(t("needCustomer"));
      state.busy = true; send.disabled = true; send.textContent = t("sending");
      state.cid = state.cid || newCid();     // same key for retries: a request whose answer got lost is never created twice
      try {
        var body = { storeId: store.value, text: text.value, note: note.value, clientId: state.cid, customer: Object.assign({ name: name.value, phone: phone.value, addr: addr.value }, state.geo || {}) };
        if (state.rx) body.prescription = state.rx;
        var r = await call("/api/customer/pharmacy/requests", { method: "POST", body: body });
        state.cid = null; state.rx = null; hint(t("sent"));
        openDetail(r.request.id);
      } catch (e) { hint(errMsg(e)); }
      finally { state.busy = false; send.disabled = false; send.textContent = t("send"); }
    });
    body.appendChild(el("p", { class: "ph-muted", text: t("hours") }));
    if (state.stores.length > 1) body.appendChild(el("label", {}, t("pharmacy"), store)); else body.appendChild(store), store.hidden = true;
    body.appendChild(el("label", {}, t("medicine"), text));
    body.appendChild(el("label", {}, t("rx"), file)); body.appendChild(prev);
    body.appendChild(el("label", {}, t("name"), name)); body.appendChild(el("label", {}, t("phone"), phone));
    if (saved) body.appendChild(saved);
    body.appendChild(el("label", {}, t("addr"), addr)); body.appendChild(el("div", { class: "ph-row" }, locBtn));
    body.appendChild(el("label", {}, t("note"), note));
    body.appendChild(send);
    drawPrev();
  }

  /* ---------------- my requests ---------------- */
  var pillCls = function (s) { return s === "accepted" || s === "quoted" ? "ok" : s === "pending" ? "" : "bad"; };

  async function renderList() {
    var body = $("phBody");
    try {
      var r = await call("/api/customer/pharmacy/requests");
      body.replaceChildren();
      if (!r.requests.length) return body.appendChild(el("div", { class: "ph-empty", text: t("noRequests") }));
      r.requests.forEach(function (q) {
        body.appendChild(el("button", { class: "ph-item", type: "button", "data-ph": q.id, onclick: function () { openDetail(q.id); } },
          el("div", { class: "ph-row" }, el("b", { text: q.id }), el("span", { class: "ph-pill " + pillCls(q.status), text: t("st_" + q.status) })),
          el("div", { text: (q.hasPrescription ? "📎 " : "") + (q.text || t("rxOnly")) }),
          el("div", { class: "ph-muted", text: q.storeName + " · " + when(q.createdAt) })));
      });
    } catch (e) { if (!body.children.length) body.appendChild(retryBox(renderList)); }
  }
  function retryBox(fn) { return el("div", { class: "ph-empty" }, t("loadErr"), el("div", {}, el("button", { class: "ph-btn ghost", type: "button", text: t("retry"), onclick: fn }))); }

  /* ---------------- detail + offer ---------------- */
  async function openDetail(id) { state.detail = id; setTab("detail"); }

  async function renderDetail() {
    var body = $("phBody"), id = state.detail;
    try {
      var d = (await call("/api/customer/pharmacy/requests/" + encodeURIComponent(id))).request;
      var keep = body.scrollTop;
      body.replaceChildren();
      body.appendChild(el("button", { class: "ph-btn ghost", type: "button", text: "‹ " + t("tabMine"), onclick: function () { state.detail = null; setTab("mine"); } }));
      body.appendChild(el("div", { class: "ph-row" }, el("b", { text: d.id }), el("span", { class: "ph-pill " + pillCls(d.status), id: "phStatus", text: t("st_" + d.status) })));
      body.appendChild(el("div", { class: "ph-muted", text: d.storeName + " · " + when(d.createdAt) }));
      if (d.text) body.appendChild(el("div", { text: d.text }));
      if (d.hasPrescription) {
        var box = el("div", { class: "ph-muted", text: t("rxView") + "…" }); body.appendChild(box);
        blobUrl("/api/customer/pharmacy/requests/" + encodeURIComponent(id) + "/prescription").then(function (u) { box.replaceChildren(el("img", { class: "ph-rx", src: u, alt: t("rxView") })); }).catch(function () { box.textContent = ""; });
      }
      var q = d.quote;
      if (q && d.status === "unavailable") body.appendChild(el("div", { class: "ph-offer" }, el("b", { text: t("unavailMsg") }), q.reason ? el("div", { text: t("reason") + ": " + q.reason }) : null));
      if (q && q.available && ["quoted", "accepted", "declined", "expired"].indexOf(d.status) >= 0) {
        var offer = el("div", { class: "ph-offer", id: "phOffer" }, el("b", { text: t("offer") }));
        q.lines.forEach(function (l) { offer.appendChild(el("div", { class: "ph-line" }, el("span", { text: l.qty + " × " + l.name }), el("span", { text: money(l.qty * l.price) }))); });
        if (q.note) offer.appendChild(el("div", { class: "ph-muted", text: q.note }));
        offer.appendChild(el("div", { class: "ph-line" }, el("span", { text: t("meds") }), el("span", { text: money(q.medicinesTotal) })));
        if (d.delivery) offer.appendChild(el("div", { class: "ph-line" }, el("span", { text: t("delivery") }), el("span", { text: money(d.delivery.fee) })));
        if (d.total != null) offer.appendChild(el("div", { class: "ph-line ph-total" }, el("span", { text: t("total") }), el("span", { id: "phTotal", text: money(d.total) })));
        if (d.status === "quoted" && q.expiresAt) offer.appendChild(el("div", { class: "ph-muted", text: t("expires") + ": " + when(q.expiresAt) }));
        if (d.deliveryError) offer.appendChild(el("div", { class: "ph-muted", text: (d.deliveryError.message && d.deliveryError.message[curLang()]) || t("routeFail") }));
        body.appendChild(offer);
      }
      var acts = el("div", { class: "ph-row" });
      if (d.status === "quoted" && d.canAccept) {
        var acc = el("button", { class: "ph-btn", type: "button", id: "phAccept", text: t("accept"), disabled: !d.delivery });
        acc.addEventListener("click", function () { decide("accept", d, acc); });
        acts.appendChild(acc);
        acts.appendChild(el("button", { class: "ph-btn ghost", type: "button", id: "phDecline", text: t("decline"), onclick: function () { if (confirm(t("confirmDecline"))) decide("decline", d); } }));
        body.appendChild(el("div", { class: "ph-muted", text: t("payCod") }));
      }
      if (d.status === "pending" || d.status === "quoted") acts.appendChild(el("button", { class: "ph-btn bad", type: "button", id: "phCancel", text: t("cancel"), onclick: function () { if (confirm(t("confirmCancel"))) decide("cancel", d); } }));
      if (acts.children.length) body.appendChild(acts);
      body.appendChild(el("div", { class: "ph-row" }, el("a", { class: "ph-btn ghost", id: "phChat", href: "/chat/?store=" + encodeURIComponent(d.id), text: "💬 " + t("chat") }),
        d.orderId ? el("a", { class: "ph-btn", href: "/orders/", text: t("openOrder") }) : null));
      body.scrollTop = keep;
    } catch (e) {
      if (e.status === 404) { state.detail = null; return setTab("mine"); }
      if (!body.children.length) body.appendChild(retryBox(renderDetail));
    }
  }
  async function decide(kind, d, btn) {
    if (state.busy) return; state.busy = true; hint(""); if (btn) btn.disabled = true;
    try {
      if (kind === "accept") {
        var r = await call("/api/customer/pharmacy/requests/" + encodeURIComponent(d.id) + "/accept", { method: "POST", body: { expectTotal: d.total, paymentMethod: "cod" } });
        hint(t("accepted"));
      } else await call("/api/customer/pharmacy/requests/" + encodeURIComponent(d.id) + "/" + kind, { method: "POST", body: {} });
    } catch (e) { hint(errMsg(e)); }
    finally { state.busy = false; }
    renderDetail();
  }

  /* ---------------- shell ---------------- */
  function setTab(tab) {
    state.tab = tab;
    $("tabNew").classList.toggle("on", tab === "new"); $("tabMine").classList.toggle("on", tab === "mine" || tab === "detail");
    clearInterval(timer); timer = null;
    if (tab === "new") renderNew();
    else if (tab === "mine") { renderList(); timer = setInterval(function () { if (!document.hidden && !state.busy) renderList(); }, 8000); }
    else { renderDetail(); timer = setInterval(function () { if (!document.hidden && !state.busy) renderDetail(); }, 6000); }
  }
  function applyText() {
    $("phTitle").textContent = t("title"); $("phSub").textContent = t("sub"); document.title = "siymon | " + t("title");
    $("tabNew").textContent = t("tabNew"); $("tabMine").textContent = t("tabMine"); $("goHome").setAttribute("aria-label", t("back"));
  }
  async function init() {
    if (!SP.getToken()) return SP.toLogin();
    applyText();
    $("tabNew").addEventListener("click", function () { state.detail = null; setTab("new"); });
    $("tabMine").addEventListener("click", function () { state.detail = null; setTab("mine"); });
    var qs = new URLSearchParams(location.search), want = qs.get("request");
    state.prefillText = String(qs.get("q") || "").slice(0, 1000); state.prefillStore = String(qs.get("store") || "");
    try { state.stores = (await call("/api/pharmacy/stores")).stores || []; } catch (_e) {}
    try { state.profile = (await call("/api/customer/me")).customer; } catch (_e) {}
    try { state.addresses = (await call("/api/customer/addresses")).addresses || []; } catch (_e) {}
    if (want) { state.detail = want; setTab("detail"); } else setTab(qs.get("tab") === "mine" ? "mine" : "new");
  }
  document.addEventListener("visibilitychange", function () { if (!document.hidden && state.tab !== "new" && !state.busy) (state.tab === "mine" ? renderList : renderDetail)(); });
  window.addEventListener("siymon:revive", function () { if (state.tab !== "new") setTab(state.tab); });
  init();
})();

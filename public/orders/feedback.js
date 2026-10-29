/* =========================================================
   Customer feedback (spec 16): complaint form linked to an order + moderation notice on the store rating.
   Loaded after orders.js / orders-extras.js (uses its globals: api, lang, LAST_ORDERS, renderOrders).
   The SERVER decides everything (ownership, eligibility, limits); this file only collects input and shows the server's answer.
   All server text goes through textContent.
   ========================================================= */
(function () {
  "use strict";
  const TX = {
    ar: { complain: "تقديم شكوى", title: "شكوى بخصوص الطلب", about: "الشكوى بخصوص", store: "المتجر", driver: "السائق", platform: "المنصة / التطبيق", category: "نوع المشكلة", text: "اشرح المشكلة (10 أحرف على الأقل)", send: "إرسال الشكوى", cancel: "إغلاق", sent: "تم استلام شكواك. سيصلك الرد داخل التطبيق.", mine: "شكاواي ومركز الدعم",
      cat: { food_quality: "جودة الطعام", missing_items: "أصناف ناقصة", wrong_order: "طلب خاطئ", late_delivery: "تأخر التوصيل", driver_behavior: "سلوك السائق", extra_charge: "مبلغ إضافي", payment: "الدفع", other: "أخرى" },
      pending: "تعليقك قيد المراجعة قبل النشر", rejected: "لم يُنشر تعليقك (نجومك محتسبة)", published: "تعليقك منشور",
      TEXT_TOO_SHORT: "اكتب وصفاً أوضح (10 أحرف على الأقل).", ALREADY_OPEN: "لديك شكوى مفتوحة بخصوص هذا الأمر بالفعل.", NO_DRIVER: "لم يُسنَد سائق لهذا الطلب.", WINDOW_EXPIRED: "انتهت مهلة تقديم الشكوى (30 يوماً).", ORDER_NOT_ACTIVE: "لم يُقبل الطلب بعد؛ يمكنك إلغاؤه بدلاً من الشكوى.", TOO_MANY_OPEN: "لديك شكاوى مفتوحة كثيرة، انتظر الرد أولاً.", TOO_MANY_FOR_ORDER: "عدد الشكاوى لهذا الطلب بلغ الحد.", err: "تعذّر الإرسال، حاول مجدداً" },
    fr: { complain: "Réclamation", title: "Réclamation sur la commande", about: "La réclamation concerne", store: "Le magasin", driver: "Le livreur", platform: "La plateforme / l'application", category: "Type de problème", text: "Décrivez le problème (10 caractères minimum)", send: "Envoyer", cancel: "Fermer", sent: "Réclamation reçue. La réponse arrivera dans l'application.", mine: "Mes réclamations et support",
      cat: { food_quality: "Qualité des plats", missing_items: "Articles manquants", wrong_order: "Mauvaise commande", late_delivery: "Livraison en retard", driver_behavior: "Comportement du livreur", extra_charge: "Montant en plus", payment: "Paiement", other: "Autre" },
      pending: "Votre commentaire est en cours de vérification avant publication", rejected: "Commentaire non publié (vos étoiles comptent)", published: "Commentaire publié",
      TEXT_TOO_SHORT: "Décrivez plus précisément (10 caractères minimum).", ALREADY_OPEN: "Vous avez déjà une réclamation ouverte à ce sujet.", NO_DRIVER: "Aucun livreur n'a été affecté.", WINDOW_EXPIRED: "Délai de réclamation dépassé (30 jours).", ORDER_NOT_ACTIVE: "Commande pas encore acceptée ; vous pouvez l'annuler.", TOO_MANY_OPEN: "Trop de réclamations ouvertes, attendez une réponse.", TOO_MANY_FOR_ORDER: "Limite de réclamations atteinte pour cette commande.", err: "Envoi impossible, réessayez" },
    en: { complain: "Complain", title: "Complaint about the order", about: "The complaint is about", store: "The store", driver: "The driver", platform: "The platform / app", category: "Type of problem", text: "Describe the problem (at least 10 characters)", send: "Send complaint", cancel: "Close", sent: "Complaint received. The answer will arrive in the app.", mine: "My complaints & support",
      cat: { food_quality: "Food quality", missing_items: "Missing items", wrong_order: "Wrong order", late_delivery: "Late delivery", driver_behavior: "Driver behaviour", extra_charge: "Extra charge", payment: "Payment", other: "Other" },
      pending: "Your comment is being reviewed before it is published", rejected: "Comment not published (your stars still count)", published: "Comment published",
      TEXT_TOO_SHORT: "Please describe it in more detail (10 characters).", ALREADY_OPEN: "You already have an open complaint about this.", NO_DRIVER: "No driver was assigned to this order.", WINDOW_EXPIRED: "The 30-day complaint window has ended.", ORDER_NOT_ACTIVE: "The order was not accepted yet; you can cancel it instead.", TOO_MANY_OPEN: "Too many open complaints, wait for an answer first.", TOO_MANY_FOR_ORDER: "Complaint limit reached for this order.", err: "Couldn't send, try again" },
  };
  const T = () => TX[typeof lang !== "undefined" && TX[lang] ? lang : "ar"];
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const newCid = () => "cp-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

  let modal = null, F = { orderId: null, cid: null, busy: false };

  function build() {
    modal = mk("div", "modal"); modal.id = "complaintModal"; modal.setAttribute("aria-hidden", "true");
    const card = mk("div", "modal-card");
    const head = mk("div", "modal-head"); const hw = mk("div"); const title = mk("div", "modal-title"); title.id = "cpTitle"; const meta = mk("div", "muted"); meta.id = "cpMeta"; hw.append(title, meta); head.appendChild(hw);
    const body = mk("div", "modal-body");
    const f1 = mk("div", "field"), l1 = mk("label"); l1.id = "cpAboutL"; l1.htmlFor = "cpAbout"; const sel = mk("select", "input"); sel.id = "cpAbout"; f1.append(l1, sel);
    const f2 = mk("div", "field"), l2 = mk("label"); l2.id = "cpCatL"; l2.htmlFor = "cpCat"; const cat = mk("select", "input"); cat.id = "cpCat"; f2.append(l2, cat);
    const ta = mk("textarea", "textarea"); ta.id = "cpText"; ta.rows = 4; ta.maxLength = 1000;
    const hint = mk("div", "hint"); hint.id = "cpHint"; hint.setAttribute("role", "alert");
    body.append(f1, f2, ta, hint);
    const acts = mk("div", "modal-actions"); const close = mk("button", "btn"); close.type = "button"; close.id = "cpClose"; const send = mk("button", "btn good"); send.type = "button"; send.id = "cpSend"; acts.append(close, send);
    card.append(head, body, acts); modal.appendChild(card); document.body.appendChild(modal);
    close.addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
    send.addEventListener("click", submit);
  }
  function paint(order) {
    const t = T();
    modal.querySelector("#cpTitle").textContent = t.title;
    modal.querySelector("#cpAboutL").textContent = t.about;
    modal.querySelector("#cpCatL").textContent = t.category;
    modal.querySelector("#cpText").placeholder = t.text;
    modal.querySelector("#cpClose").textContent = t.cancel;
    modal.querySelector("#cpSend").textContent = t.send;
    const about = modal.querySelector("#cpAbout"); about.textContent = "";
    const opts = [];
    if (order.restaurantId) opts.push(["store", t.store]);
    if (order.driverName || order.driverPhone) opts.push(["driver", t.driver]);
    opts.push(["platform", t.platform]);
    opts.forEach(([v, l]) => { const o = mk("option", "", l); o.value = v; about.appendChild(o); });
    const cat = modal.querySelector("#cpCat"); cat.textContent = "";
    Object.keys(t.cat).forEach((k) => { const o = mk("option", "", t.cat[k]); o.value = k; cat.appendChild(o); });
  }
  function openModal(id) {
    const order = (typeof LAST_ORDERS !== "undefined" ? LAST_ORDERS : []).find((x) => String(x.id) === String(id));
    if (!order) return;
    if (!modal) build();
    F = { orderId: String(id), cid: newCid(), busy: false }; // one key per opening: a retry after a lost answer never files twice
    paint(order);
    modal.querySelector("#cpMeta").textContent = "#" + id + (order.restaurantName ? " • " + order.restaurantName : "");
    modal.querySelector("#cpText").value = ""; modal.querySelector("#cpHint").textContent = "";
    modal.classList.add("show"); modal.setAttribute("aria-hidden", "false");
  }
  function closeModal() { if (modal) { modal.classList.remove("show"); modal.setAttribute("aria-hidden", "true"); } }

  async function submit() {
    if (F.busy) return;
    const t = T(), hint = modal.querySelector("#cpHint"), btn = modal.querySelector("#cpSend");
    const text = modal.querySelector("#cpText").value.trim();
    if (text.length < 10) { hint.textContent = t.TEXT_TOO_SHORT; return; }
    F.busy = true; btn.disabled = true; hint.textContent = "";
    try {
      await api("/api/customer/complaints", { method: "POST", body: JSON.stringify({ orderId: F.orderId, against: modal.querySelector("#cpAbout").value, category: modal.querySelector("#cpCat").value, text, clientId: F.cid }) });
      closeModal(); alert(t.sent);
      location.href = "/support/#complaints";
    } catch (e) {
      const code = (e && (e.code || (e.data && e.data.code))) || "";
      hint.textContent = t[code] || t.err;
    } finally { F.busy = false; btn.disabled = false; }
  }

  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest('[data-action="complain"]');
    if (b) openModal(b.getAttribute("data-id"));
  });

  /* ---- decorate the order cards after every render ---- */
  function decorate() {
    const t = T(), orders = typeof LAST_ORDERS !== "undefined" ? LAST_ORDERS : [];
    document.querySelectorAll(".order-card-actions").forEach((box) => {
      const idEl = box.querySelector("[data-id]"); if (!idEl) return;
      const id = idEl.getAttribute("data-id");
      const o = orders.find((x) => String(x.id) === String(id)); if (!o) return;
      const st = String(o.status || "new").toLowerCase();
      if (st !== "new" && !box.querySelector('[data-action="complain"]')) {
        const b = mk("button", "btn ghost small", t.complain); b.type = "button"; b.setAttribute("data-action", "complain"); b.setAttribute("data-id", id);
        box.appendChild(b);
      }
      const card = box.closest(".order-card") || box.parentNode;
      if (card && !card.querySelector(".fb-note")) {
        const sr = o.storeRating;
        if (sr && sr.comment && (sr.commentStatus === "pending" || sr.commentStatus === "rejected")) {
          const n = mk("div", "order-info muted fb-note", t[sr.commentStatus]); box.parentNode.insertBefore(n, box);
        }
      }
    });
  }
  const base = renderOrders;
  renderOrders = function (list) { base(list); try { decorate(); } catch (_e) {} };
})();

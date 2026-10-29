/* Customer support centre (spec 16): contact channels, support chat, complaints linked to orders.
   Auth = the customer token the app already keeps. The SERVER enforces ownership/eligibility; this file shows its answers.
   All server text goes through textContent. */
"use strict";
(function () {
  const TOKEN_KEY = "siymon_customer_token_v1", LANG_KEY = "siymon_lang_v1";
  const ls = (k) => { try { return localStorage.getItem(k); } catch (_e) { return null; } };
  const lang = ["ar", "fr", "en"].includes(ls(LANG_KEY)) ? ls(LANG_KEY) : "ar";
  document.documentElement.lang = lang; document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  const TX = {
    ar: { title: "مركز الدعم", lead: "نحن هنا لمساعدتك. تواصل معنا أو قدّم شكوى مرتبطة بطلب.", contact: "تواصل معنا", chat: "دردشة مع الدعم", noChan: "لا توجد قنوات منشورة حالياً.", mail: "البريد", phone: "الهاتف (برشيد)",
      my: "شكاواي", newC: "شكوى جديدة", login: "سجّل الدخول من صفحة الحساب لعرض شكاواك وتقديم شكوى.", loginBtn: "فتح حسابي", none: "لا توجد شكاوى.", retry: "إعادة المحاولة", loadErr: "تعذّر التحميل",
      back: "رجوع", order: "الطلب", about: "الشكوى بخصوص", category: "نوع المشكلة", text: "اشرح المشكلة (10 أحرف على الأقل)", send: "إرسال الشكوى", sent: "تم استلام شكواك.", pickOrder: "اختر الطلب", noOrders: "لا توجد طلبات مؤهلة للشكوى.",
      store: "المتجر", driver: "السائق", platform: "المنصة / التطبيق", timeline: "المتابعة", accept: "تم حل المشكلة", escalate: "لم تُحل، صعّد للمشرف", withdraw: "سحب الشكوى", reason: "لماذا لم تُحل المشكلة؟", confirm: "تأكيد", cancel: "إلغاء", resolution: "النتيجة", waitParty: "بانتظار ردّ الطرف المعني قبل", waitYou: "ردّ عليك الطرف المعني. هل حُلّت المشكلة؟", withSup: "بين يدي المشرف الآن", done: "تم", failed: "تعذّر التنفيذ",
      status: { with_party: "عند الطرف المعني", party_responded: "تم الرد", escalated: "عند المشرف", in_review: "قيد المراجعة", resolved: "مغلقة" },
      cat: { food_quality: "جودة الطعام", missing_items: "أصناف ناقصة", wrong_order: "طلب خاطئ", late_delivery: "تأخر التوصيل", driver_behavior: "سلوك السائق", extra_charge: "مبلغ إضافي", payment: "الدفع", other: "أخرى" },
      who: { customer: "أنت", store: "المتجر", driver: "السائق", supervisor: "الدعم", system: "النظام" },
      kind: { filed: "تم تقديم الشكوى", routed: "أُرسلت للطرف المعني", party_response: "ردّ الطرف المعني", customer_accept: "أكّدت الحل", customer_escalate: "صعّدتَها", auto_escalated: "صُعّدت تلقائياً لانتهاء المهلة", escalated: "صُعّدت للمشرف", taken: "استلمها المشرف", supervisor_message: "رسالة من الدعم", resolved: "أُغلقت", withdrawn: "سحبتَها", auto_resolved: "أُغلقت تلقائياً" },
      outcome: { fixed: "تمت المعالجة", compensated: "تم التعويض", store_at_fault: "الخطأ من المتجر", driver_at_fault: "الخطأ من السائق", customer_at_fault: "لا مخالفة من المتجر/السائق", no_action_needed: "لا إجراء مطلوب", other: "أخرى", resolved_by_party: "حُلّت مع الطرف المعني", withdrawn: "سُحبت", no_customer_reply: "أُغلقت لعدم ردّك" },
      TEXT_TOO_SHORT: "اكتب وصفاً أوضح (10 أحرف على الأقل).", ALREADY_OPEN: "لديك شكوى مفتوحة بخصوص هذا الأمر.", NO_DRIVER: "لم يُسنَد سائق لهذا الطلب.", WINDOW_EXPIRED: "انتهت مهلة الشكوى (30 يوماً).", ORDER_NOT_ACTIVE: "لم يُقبل الطلب بعد.", TOO_MANY_OPEN: "لديك شكاوى مفتوحة كثيرة.", REASON_REQUIRED: "اكتب السبب.", NOT_ANSWERED: "لم يصل ردّ بعد.", COMPLAINT_CLOSED: "الشكوى مغلقة." },
    fr: { title: "Centre d'aide", lead: "Nous sommes là pour vous aider. Contactez-nous ou déposez une réclamation liée à une commande.", contact: "Nous contacter", chat: "Chat avec le support", noChan: "Aucun canal publié pour le moment.", mail: "E-mail", phone: "Téléphone (Berrechid)",
      my: "Mes réclamations", newC: "Nouvelle réclamation", login: "Connectez-vous depuis la page du compte pour voir ou déposer une réclamation.", loginBtn: "Ouvrir mon compte", none: "Aucune réclamation.", retry: "Réessayer", loadErr: "Chargement impossible",
      back: "Retour", order: "Commande", about: "La réclamation concerne", category: "Type de problème", text: "Décrivez le problème (10 caractères minimum)", send: "Envoyer", sent: "Réclamation reçue.", pickOrder: "Choisissez la commande", noOrders: "Aucune commande éligible.",
      store: "Le magasin", driver: "Le livreur", platform: "La plateforme / l'application", timeline: "Suivi", accept: "Problème résolu", escalate: "Non résolu, escalader", withdraw: "Retirer la réclamation", reason: "Pourquoi n'est-ce pas résolu ?", confirm: "Confirmer", cancel: "Annuler", resolution: "Résultat", waitParty: "En attente de la réponse de la partie avant", waitYou: "La partie a répondu. Le problème est-il résolu ?", withSup: "Entre les mains du superviseur", done: "Fait", failed: "Échec",
      status: { with_party: "Chez la partie concernée", party_responded: "Réponse reçue", escalated: "Chez le superviseur", in_review: "En examen", resolved: "Clôturée" },
      cat: { food_quality: "Qualité des plats", missing_items: "Articles manquants", wrong_order: "Mauvaise commande", late_delivery: "Livraison en retard", driver_behavior: "Comportement du livreur", extra_charge: "Montant en plus", payment: "Paiement", other: "Autre" },
      who: { customer: "Vous", store: "Magasin", driver: "Livreur", supervisor: "Support", system: "Système" },
      kind: { filed: "Réclamation déposée", routed: "Transmise à la partie", party_response: "Réponse de la partie", customer_accept: "Vous avez confirmé", customer_escalate: "Vous avez escaladé", auto_escalated: "Escaladée automatiquement (délai dépassé)", escalated: "Escaladée au superviseur", taken: "Prise en charge", supervisor_message: "Message du support", resolved: "Clôturée", withdrawn: "Retirée", auto_resolved: "Clôturée automatiquement" },
      outcome: { fixed: "Corrigé", compensated: "Compensé", store_at_fault: "Faute du magasin", driver_at_fault: "Faute du livreur", customer_at_fault: "Aucun manquement constaté", no_action_needed: "Aucune action", other: "Autre", resolved_by_party: "Résolue avec la partie", withdrawn: "Retirée", no_customer_reply: "Clôturée faute de réponse" },
      TEXT_TOO_SHORT: "Décrivez plus précisément (10 caractères minimum).", ALREADY_OPEN: "Une réclamation est déjà ouverte à ce sujet.", NO_DRIVER: "Aucun livreur affecté.", WINDOW_EXPIRED: "Délai dépassé (30 jours).", ORDER_NOT_ACCEPTED: "", ORDER_NOT_ACTIVE: "Commande pas encore acceptée.", TOO_MANY_OPEN: "Trop de réclamations ouvertes.", REASON_REQUIRED: "Saisissez le motif.", NOT_ANSWERED: "Pas encore de réponse.", COMPLAINT_CLOSED: "Réclamation clôturée." },
    en: { title: "Support centre", lead: "We're here to help. Contact us or file a complaint linked to an order.", contact: "Contact us", chat: "Chat with support", noChan: "No channels published right now.", mail: "Email", phone: "Phone (Berrechid)",
      my: "My complaints", newC: "New complaint", login: "Sign in from the account page to see or file complaints.", loginBtn: "Open my account", none: "No complaints.", retry: "Retry", loadErr: "Couldn't load",
      back: "Back", order: "Order", about: "The complaint is about", category: "Type of problem", text: "Describe the problem (at least 10 characters)", send: "Send complaint", sent: "Complaint received.", pickOrder: "Choose the order", noOrders: "No order is eligible for a complaint.",
      store: "The store", driver: "The driver", platform: "The platform / app", timeline: "Progress", accept: "The problem is solved", escalate: "Not solved, escalate", withdraw: "Withdraw complaint", reason: "Why is it not solved?", confirm: "Confirm", cancel: "Cancel", resolution: "Outcome", waitParty: "Waiting for the party to answer before", waitYou: "The party answered. Is the problem solved?", withSup: "With a supervisor now", done: "Done", failed: "Failed",
      status: { with_party: "With the store/driver", party_responded: "Answered", escalated: "With a supervisor", in_review: "Under review", resolved: "Closed" },
      cat: { food_quality: "Food quality", missing_items: "Missing items", wrong_order: "Wrong order", late_delivery: "Late delivery", driver_behavior: "Driver behaviour", extra_charge: "Extra charge", payment: "Payment", other: "Other" },
      who: { customer: "You", store: "Store", driver: "Driver", supervisor: "Support", system: "System" },
      kind: { filed: "Complaint filed", routed: "Sent to the party", party_response: "Party answered", customer_accept: "You confirmed it was solved", customer_escalate: "You escalated it", auto_escalated: "Escalated automatically (deadline passed)", escalated: "Escalated to a supervisor", taken: "Supervisor took it", supervisor_message: "Message from support", resolved: "Closed", withdrawn: "You withdrew it", auto_resolved: "Closed automatically" },
      outcome: { fixed: "Fixed", compensated: "Compensated", store_at_fault: "Store at fault", driver_at_fault: "Driver at fault", customer_at_fault: "No fault found", no_action_needed: "No action needed", other: "Other", resolved_by_party: "Solved with the party", withdrawn: "Withdrawn", no_customer_reply: "Closed, no reply from you" },
      TEXT_TOO_SHORT: "Please describe it in more detail (10 characters).", ALREADY_OPEN: "You already have an open complaint about this.", NO_DRIVER: "No driver was assigned.", WINDOW_EXPIRED: "The 30-day window has ended.", ORDER_NOT_ACTIVE: "The order was not accepted yet.", TOO_MANY_OPEN: "Too many open complaints.", REASON_REQUIRED: "Enter the reason.", NOT_ANSWERED: "No answer yet.", COMPLAINT_CLOSED: "Complaint closed." },
  };
  const t = TX[lang];
  const $ = (id) => document.getElementById(id);
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const token = () => ls(TOKEN_KEY) || "";
  const fmt = (iso) => { try { return new Date(iso).toLocaleString(lang === "ar" ? "ar-MA" : lang, { dateStyle: "short", timeStyle: "short" }); } catch (_e) { return ""; } };
  async function api(path, opts = {}) {
    const res = await fetch(path, { ...opts, headers: { "Content-Type": "application/json", ...(token() ? { Authorization: "Bearer " + token() } : {}) } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error(data.error || "Request failed"); e.code = data.code || ""; e.status = res.status; throw e; }
    return data;
  }
  const errText = (e) => t[e && e.code] || t.failed;
  const post = (path, body) => api(path, { method: "POST", body: JSON.stringify(body || {}) });

  const root = $("sc");
  const S = { list: [], view: "home", open: null, busy: false };

  function badge(c) { const b = mk("span", "badge" + (c.status === "resolved" ? " done" : c.status === "with_party" || c.status === "party_responded" ? " warn" : ""), t.status[c.status] || c.status); return b; }

  function head() {
    const w = mk("div"); w.append(mk("h1", "", t.title), mk("p", "lead", t.lead)); return w;
  }

  async function renderHome() {
    S.view = "home"; root.textContent = "";
    root.appendChild(head());

    // contact
    const cc = mk("section", "card"); cc.appendChild(mk("h2", "", t.contact));
    const row = mk("div", "row"); cc.appendChild(row);
    const chat = mk("a", "chan", "💬 " + t.chat); chat.href = "/chat/"; row.appendChild(chat);
    const chRow = mk("div", "list"); chRow.style.marginTop = "10px"; cc.appendChild(chRow);
    root.appendChild(cc);
    try {
      const r = await api("/api/support/channels");
      const ch = r.channels || [];
      if (!ch.length) { const f = mk("div", "muted"); f.append(mk("div", "", t.mail + ": support@siymon7.com"), mk("div", "", t.phone + ": +212617139424")); chRow.appendChild(f); }
      ch.forEach((c) => {
        const l = c.label && (c.label[lang] || c.label.ar || c.label.en) || c.kind;
        const a = mk("a", "chan", l + " — " + c.value); a.href = c.href; a.rel = "noopener"; if (/^https?:/.test(c.href)) a.target = "_blank";
        const w = mk("div"); w.appendChild(a); if (c.hours) w.appendChild(mk("div", "hours", c.hours)); chRow.appendChild(w);
      });
    } catch (_e) { const f = mk("div", "muted"); f.append(mk("div", "", t.mail + ": support@siymon7.com"), mk("div", "", t.phone + ": +212617139424")); chRow.appendChild(f); }

    // complaints
    const mc = mk("section", "card"); mc.id = "complaints"; mc.appendChild(mk("h2", "", t.my));
    root.appendChild(mc);
    if (!token()) {
      mc.appendChild(mk("p", "muted", t.login)); const a = mk("a", "chan", t.loginBtn); a.href = "/orders/"; mc.appendChild(a); return;
    }
    const bar = mk("div", "row"); const nb = mk("button", "act primary", "+ " + t.newC); nb.type = "button"; nb.addEventListener("click", renderNew); bar.appendChild(nb); mc.appendChild(bar);
    const box = mk("div", "list"); box.style.marginTop = "10px"; box.append(mk("div", "skeleton"), mk("div", "skeleton")); mc.appendChild(box);
    try {
      const r = await api("/api/customer/complaints");
      S.list = r.complaints || []; box.textContent = "";
      if (!S.list.length) box.appendChild(mk("div", "empty", t.none));
      S.list.forEach((c) => {
        const it = mk("button", "item"); it.type = "button";
        const top = mk("div", "row"); top.append(mk("b", "", c.id), badge(c));
        it.append(top, mk("div", "", (t.cat[c.category] || c.category) + " • " + t.order + " #" + c.orderId), mk("div", "muted", fmt(c.updatedAt)));
        it.addEventListener("click", () => renderDetail(c.id));
        box.appendChild(it);
      });
    } catch (e) {
      box.textContent = "";
      if (e.status === 401) { box.appendChild(mk("p", "muted", t.login)); return; }
      const rb = mk("button", "act", t.retry); rb.type = "button"; rb.addEventListener("click", renderHome); box.append(mk("div", "msg", t.loadErr), rb);
    }
  }

  function back() { const b = mk("button", "act", "← " + t.back); b.type = "button"; b.addEventListener("click", renderHome); return b; }

  async function renderDetail(id) {
    S.view = "detail"; S.open = id; root.textContent = "";
    root.appendChild(back());
    const card = mk("section", "card"); root.appendChild(card);
    card.append(mk("div", "skeleton"));
    let c;
    try { c = (await api("/api/customer/complaints/" + encodeURIComponent(id))).complaint; } catch (e) { card.textContent = ""; card.appendChild(mk("div", "msg", errText(e))); return; }
    card.textContent = "";
    const top = mk("div", "row"); top.append(mk("h2", "", c.id), badge(c)); card.appendChild(top);
    card.append(mk("div", "muted", t.order + " #" + c.orderId + " • " + (t.cat[c.category] || c.category) + " • " + (t[c.against] || c.against)), mk("p", "", c.text));
    if (c.status === "with_party" && c.respondBy) card.appendChild(mk("p", "muted", t.waitParty + " " + fmt(c.respondBy)));
    if (c.status === "party_responded") card.appendChild(mk("p", "", t.waitYou));
    if (c.status === "escalated" || c.status === "in_review") card.appendChild(mk("p", "muted", t.withSup));
    if (c.resolution) card.appendChild(mk("p", "", t.resolution + ": " + (t.outcome[c.resolution.outcome] || c.resolution.outcome) + (c.resolution.note ? " — " + c.resolution.note : "")));
    card.appendChild(mk("h2", "", t.timeline));
    const ul = mk("ul", "tl");
    c.timeline.forEach((e) => {
      const li = mk("li"); li.append(mk("div", "who", (t.who[e.role] || e.role) + " • " + fmt(e.at)), mk("div", "", t.kind[e.kind] || e.kind));
      if (e.text && !["routed", "escalated", "auto_escalated", "customer_accept", "withdrawn", "taken", "auto_resolved"].includes(e.kind)) li.appendChild(mk("div", "", e.text));
      ul.appendChild(li);
    });
    card.appendChild(ul);
    const msg = mk("div", "msg"); msg.setAttribute("role", "alert");
    const run = async (btn, fn) => { if (S.busy) return; S.busy = true; btn.disabled = true; msg.textContent = ""; try { await fn(); await renderDetail(id); } catch (e) { msg.textContent = errText(e); } finally { S.busy = false; btn.disabled = false; } };
    const acts = mk("div", "row");
    if (c.status === "party_responded") {
      const a = mk("button", "act primary", t.accept); a.type = "button"; a.addEventListener("click", () => run(a, () => post("/api/customer/complaints/" + encodeURIComponent(id) + "/accept")));
      const e = mk("button", "act", t.escalate); e.type = "button";
      acts.append(a, e);
      e.addEventListener("click", () => {
        e.disabled = true;
        const f = mk("div", "field"); const l = mk("label", "", t.reason); const ta = mk("textarea"); ta.rows = 3; ta.maxLength = 300; l.htmlFor = ta.id = "scReason"; f.append(l, ta);
        const ok = mk("button", "act primary", t.confirm); ok.type = "button"; ok.addEventListener("click", () => run(ok, () => post("/api/customer/complaints/" + encodeURIComponent(id) + "/escalate", { reason: ta.value })));
        card.insertBefore(f, msg); card.insertBefore(ok, msg); ta.focus();
      });
    }
    if (c.status === "with_party" || c.status === "party_responded") {
      const w = mk("button", "act danger", t.withdraw); w.type = "button";
      w.addEventListener("click", () => { if (confirm(t.withdraw + "?")) run(w, () => post("/api/customer/complaints/" + encodeURIComponent(id) + "/withdraw")); });
      acts.appendChild(w);
    }
    card.append(acts, msg);
  }

  async function renderNew() {
    S.view = "new"; root.textContent = "";
    root.appendChild(back());
    const card = mk("section", "card"); root.appendChild(card); card.appendChild(mk("h2", "", t.newC)); card.appendChild(mk("div", "skeleton"));
    let orders;
    try { orders = ((await api("/api/customer/orders")).orders || []).filter((o) => String(o.status || "new").toLowerCase() !== "new"); } catch (e) { card.textContent = ""; card.appendChild(mk("div", "msg", errText(e))); return; }
    card.textContent = ""; card.appendChild(mk("h2", "", t.newC));
    if (!orders.length) { card.appendChild(mk("div", "empty", t.noOrders)); return; }
    const f1 = mk("div", "field"), l1 = mk("label", "", t.pickOrder), sel = mk("select"); l1.htmlFor = sel.id = "scOrder"; f1.append(l1, sel);
    orders.forEach((o) => { const op = mk("option", "", "#" + o.id + (o.restaurantName ? " • " + o.restaurantName : "") + (o.createdAt ? " • " + fmt(o.createdAt) : "")); op.value = o.id; sel.appendChild(op); });
    const pre = new URLSearchParams(location.search).get("order"); if (pre && orders.some((o) => String(o.id) === pre)) sel.value = pre;
    const f2 = mk("div", "field"), l2 = mk("label", "", t.about), about = mk("select"); l2.htmlFor = about.id = "scAbout"; f2.append(l2, about);
    const fill = () => {
      const o = orders.find((x) => String(x.id) === sel.value) || {}; about.textContent = "";
      const opts = []; if (o.restaurantId) opts.push(["store", t.store]); if (o.driverName || o.driverPhone) opts.push(["driver", t.driver]); opts.push(["platform", t.platform]);
      opts.forEach(([v, l]) => { const op = mk("option", "", l); op.value = v; about.appendChild(op); });
    };
    sel.addEventListener("change", fill); fill();
    const f3 = mk("div", "field"), l3 = mk("label", "", t.category), cat = mk("select"); l3.htmlFor = cat.id = "scCat"; f3.append(l3, cat);
    Object.keys(t.cat).forEach((k) => { const op = mk("option", "", t.cat[k]); op.value = k; cat.appendChild(op); });
    const f4 = mk("div", "field"), l4 = mk("label", "", t.text), ta = mk("textarea"); ta.rows = 5; ta.maxLength = 1000; l4.htmlFor = ta.id = "scText"; f4.append(l4, ta);
    const msg = mk("div", "msg"); msg.setAttribute("role", "alert");
    const send = mk("button", "act primary", t.send); send.type = "button";
    const cid = "cp-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); // stable across retries of THIS form
    send.addEventListener("click", async () => {
      if (S.busy) return;
      if (ta.value.trim().length < 10) { msg.textContent = t.TEXT_TOO_SHORT; return; }
      S.busy = true; send.disabled = true; msg.textContent = "";
      try { await post("/api/customer/complaints", { orderId: sel.value, against: about.value, category: cat.value, text: ta.value, clientId: cid }); alert(t.sent); await renderHome(); }
      catch (e) { msg.textContent = errText(e); } finally { S.busy = false; send.disabled = false; }
    });
    card.append(f1, f2, f3, f4, send, msg);
  }

  renderHome().then(() => { if (new URLSearchParams(location.search).get("order") && token()) renderNew(); });
})();

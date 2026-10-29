/* Ratings moderation + complaints management (admin, spec 16).
   The SERVER authorises and validates every call (lib/admin-roles.js + lib/feedback-routes.js); permOk() only hides what a role cannot use.
   A complaint can only be closed with an outcome + note; a comment can only be rejected with a reason. All server text goes through textContent.
   Loaded after admin.js (uses: api, lang, toast, token, permOk, showAuth). */
"use strict";
(function () {
  const T = {
    ar: { title: "التقييمات والشكاوى", complaints: "الشكاوى", moderation: "مراجعة التعليقات", refresh: "تحديث", close: "إغلاق", settings: "المهل", back: "رجوع",
      open: "المفتوحة", all: "الكل", allAgainst: "كل الأطراف", search: "بحث برقم الشكوى أو الطلب…", none: "لا توجد عناصر", pick: "اختر شكوى من القائمة", order: "الطلب", timeline: "السجل الزمني", resolution: "الحل",
      status: { with_party: "عند الطرف المعني", party_responded: "تم الرد", escalated: "مُصعَّدة", in_review: "قيد المراجعة", resolved: "مغلقة" },
      against: { store: "المتجر", driver: "السائق", platform: "المنصة" },
      cat: { food_quality: "جودة الطعام", missing_items: "أصناف ناقصة", wrong_order: "طلب خاطئ", late_delivery: "تأخر التوصيل", driver_behavior: "سلوك السائق", extra_charge: "مبلغ إضافي", payment: "الدفع", other: "أخرى" },
      outcome: { fixed: "تمت المعالجة", compensated: "تم التعويض (يُنفَّذ عبر المالية)", store_at_fault: "الخطأ من المتجر", driver_at_fault: "الخطأ من السائق", customer_at_fault: "لا مخالفة", no_action_needed: "لا إجراء مطلوب", other: "أخرى", resolved_by_party: "حُلّت مع الطرف", withdrawn: "سُحبت", no_customer_reply: "لا رد من الزبون" },
      who: { customer: "الزبون", store: "المتجر", driver: "السائق", supervisor: "المشرف", system: "النظام", support: "الدعم", order_supervisor: "مشرف الطلبات", system_admin: "مدير النظام", driver_supervisor: "مشرف السائقين" },
      kind: { filed: "تقديم", routed: "توجيه", party_response: "ردّ الطرف", customer_accept: "قبول الزبون", customer_escalate: "تصعيد الزبون", auto_escalated: "تصعيد تلقائي", escalated: "تصعيد", taken: "استلام", note: "ملاحظة داخلية", supervisor_message: "رسالة للزبون", resolved: "إغلاق", withdrawn: "سحب", auto_resolved: "إغلاق تلقائي" },
      aTake: "استلام الشكوى", aEsc: "سحبها من الطرف وتصعيدها", aMsg: "رسالة للزبون والطرف", aNote: "ملاحظة داخلية", aResolve: "إغلاق بحلّ", reason: "السبب", text: "النص", outcome_: "النتيجة النهائية", resolutionNote: "نص الحل", confirm: "تنفيذ", done: "تم", failed: "تعذّر التنفيذ", linked: "حالة مرتبطة في مركز الاستثناءات",
      RESOLUTION_REQUIRED: "لا يمكن الإغلاق دون النتيجة ونص الحل.", COMPLAINT_CLOSED: "الشكوى مغلقة.", REASON_REQUIRED: "اكتب السبب.", TEXT_REQUIRED: "اكتب النص.", NOT_ESCALATED: "الشكوى ما زالت عند الطرف المعني؛ صعّدها أولاً.", ALREADY_ESCALATED: "مُصعَّدة بالفعل.",
      pending: "بانتظار المراجعة", published: "منشورة", rejected: "مرفوضة", allKinds: "المتجر والسائق", store: "المتجر", driver: "السائق", publish: "نشر", reject: "رفض", rejectReason: "سبب الرفض (إلزامي)", noText: "—", by: "بواسطة", polite: "مهذب", extra: "طلب مالاً", yes: "نعم", no: "لا",
      deadlines: "مهل الشكاوى (بالساعات)", partyResponseHours: "مهلة ردّ المتجر/السائق", customerReplyHours: "مهلة ردّ الزبون بعد الجواب", save: "حفظ", bounds: "الحدود الآمنة يفرضها الخادم" },
    fr: { title: "Avis et réclamations", complaints: "Réclamations", moderation: "Modération des commentaires", refresh: "Actualiser", close: "Fermer", settings: "Délais", back: "Retour",
      open: "Ouvertes", all: "Toutes", allAgainst: "Toutes parties", search: "Chercher réclamation ou commande…", none: "Aucun élément", pick: "Choisissez une réclamation", order: "Commande", timeline: "Chronologie", resolution: "Résolution",
      status: { with_party: "Chez la partie", party_responded: "Répondue", escalated: "Escaladée", in_review: "En examen", resolved: "Clôturée" },
      against: { store: "Magasin", driver: "Livreur", platform: "Plateforme" },
      cat: { food_quality: "Qualité des plats", missing_items: "Articles manquants", wrong_order: "Mauvaise commande", late_delivery: "Livraison en retard", driver_behavior: "Comportement du livreur", extra_charge: "Montant en plus", payment: "Paiement", other: "Autre" },
      outcome: { fixed: "Corrigé", compensated: "Compensé (via la finance)", store_at_fault: "Faute du magasin", driver_at_fault: "Faute du livreur", customer_at_fault: "Aucun manquement", no_action_needed: "Aucune action", other: "Autre", resolved_by_party: "Résolue avec la partie", withdrawn: "Retirée", no_customer_reply: "Sans réponse du client" },
      who: { customer: "Client", store: "Magasin", driver: "Livreur", supervisor: "Superviseur", system: "Système", support: "Support", order_supervisor: "Resp. commandes", system_admin: "Admin système", driver_supervisor: "Resp. livreurs" },
      kind: { filed: "Dépôt", routed: "Transmise", party_response: "Réponse de la partie", customer_accept: "Accepté par le client", customer_escalate: "Escalade du client", auto_escalated: "Escalade automatique", escalated: "Escalade", taken: "Prise en charge", note: "Note interne", supervisor_message: "Message au client", resolved: "Clôture", withdrawn: "Retrait", auto_resolved: "Clôture automatique" },
      aTake: "Prendre en charge", aEsc: "Retirer à la partie et escalader", aMsg: "Message au client et à la partie", aNote: "Note interne", aResolve: "Clore avec résolution", reason: "Motif", text: "Texte", outcome_: "Résultat final", resolutionNote: "Texte de la résolution", confirm: "Valider", done: "Fait", failed: "Échec", linked: "Cas lié dans le centre d'exceptions",
      RESOLUTION_REQUIRED: "Impossible de clore sans résultat ni résolution.", COMPLAINT_CLOSED: "Réclamation clôturée.", REASON_REQUIRED: "Saisissez le motif.", TEXT_REQUIRED: "Saisissez le texte.", NOT_ESCALATED: "Encore chez la partie ; escaladez d'abord.", ALREADY_ESCALATED: "Déjà escaladée.",
      pending: "À examiner", published: "Publiés", rejected: "Rejetés", allKinds: "Magasin et livreur", store: "Magasin", driver: "Livreur", publish: "Publier", reject: "Rejeter", rejectReason: "Motif du rejet (obligatoire)", noText: "—", by: "par", polite: "Poli", extra: "A demandé de l'argent", yes: "Oui", no: "Non",
      deadlines: "Délais des réclamations (heures)", partyResponseHours: "Délai de réponse magasin/livreur", customerReplyHours: "Délai de réponse du client", save: "Enregistrer", bounds: "Bornes sûres appliquées par le serveur" },
    en: { title: "Ratings & complaints", complaints: "Complaints", moderation: "Comment moderation", refresh: "Refresh", close: "Close", settings: "Deadlines", back: "Back",
      open: "Open", all: "All", allAgainst: "All parties", search: "Search complaint or order…", none: "Nothing here", pick: "Pick a complaint from the list", order: "Order", timeline: "Timeline", resolution: "Resolution",
      status: { with_party: "With the party", party_responded: "Answered", escalated: "Escalated", in_review: "In review", resolved: "Closed" },
      against: { store: "Store", driver: "Driver", platform: "Platform" },
      cat: { food_quality: "Food quality", missing_items: "Missing items", wrong_order: "Wrong order", late_delivery: "Late delivery", driver_behavior: "Driver behaviour", extra_charge: "Extra charge", payment: "Payment", other: "Other" },
      outcome: { fixed: "Fixed", compensated: "Compensated (executed via finance)", store_at_fault: "Store at fault", driver_at_fault: "Driver at fault", customer_at_fault: "No fault found", no_action_needed: "No action needed", other: "Other", resolved_by_party: "Solved with the party", withdrawn: "Withdrawn", no_customer_reply: "No customer reply" },
      who: { customer: "Customer", store: "Store", driver: "Driver", supervisor: "Supervisor", system: "System", support: "Support", order_supervisor: "Order supervisor", system_admin: "System admin", driver_supervisor: "Driver supervisor" },
      kind: { filed: "Filed", routed: "Routed", party_response: "Party answered", customer_accept: "Customer accepted", customer_escalate: "Customer escalated", auto_escalated: "Auto-escalated", escalated: "Escalated", taken: "Taken", note: "Internal note", supervisor_message: "Message to customer", resolved: "Closed", withdrawn: "Withdrawn", auto_resolved: "Auto-closed" },
      aTake: "Take the complaint", aEsc: "Pull from the party and escalate", aMsg: "Message to customer & party", aNote: "Internal note", aResolve: "Close with resolution", reason: "Reason", text: "Text", outcome_: "Final outcome", resolutionNote: "Resolution text", confirm: "Confirm", done: "Done", failed: "Failed", linked: "Linked case in the exception centre",
      RESOLUTION_REQUIRED: "A complaint cannot be closed without an outcome and a resolution text.", COMPLAINT_CLOSED: "Complaint closed.", REASON_REQUIRED: "Enter the reason.", TEXT_REQUIRED: "Enter the text.", NOT_ESCALATED: "Still with the party; escalate it first.", ALREADY_ESCALATED: "Already escalated.",
      pending: "To review", published: "Published", rejected: "Rejected", allKinds: "Store & driver", store: "Store", driver: "Driver", publish: "Publish", reject: "Reject", rejectReason: "Reason for rejecting (required)", noText: "—", by: "by", polite: "Polite", extra: "Asked for extra money", yes: "Yes", no: "No",
      deadlines: "Complaint deadlines (hours)", partyResponseHours: "Store/driver answer deadline", customerReplyHours: "Customer reply deadline", save: "Save", bounds: "Safe bounds are enforced by the server" },
  };
  const L = () => (typeof lang !== "undefined" && T[lang] ? lang : "ar");
  const t = () => T[L()];
  const $ = (id) => document.getElementById(id);
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const can = (p) => (typeof permOk === "function" ? permOk(p) : true);
  const fmt = (iso) => { try { return new Date(iso).toLocaleString(L() === "ar" ? "ar-MA" : L(), { dateStyle: "short", timeStyle: "short" }); } catch (_e) { return ""; } };
  const errText = (e) => { const c = e && e.body && e.body.code; return (c && t()[c]) || (e && e.message) || t().failed; };
  const post = (path, body) => api(path, { method: "POST", body: JSON.stringify(body || {}) });
  const S = { tab: "complaints", list: [], counts: null, active: null, detail: null, outcomes: [], settings: null, showSettings: false, busy: false, timer: null, badgeTimer: null, mod: [] };
  const hint = (msg, ok) => { const h = $("fbHint"); if (h) { h.textContent = msg || ""; h.classList.toggle("ok", !!ok); } };

  function build() {
    const m = $("feedbackModal"); if (!m || m.dataset.built) return; m.dataset.built = "1";
    const card = mk("div", "modal-card ex-card"); card.setAttribute("role", "dialog"); card.setAttribute("aria-labelledby", "fbTitle");
    const head = mk("div", "ex-head");
    const title = mk("h3"); title.id = "fbTitle";
    const set = mk("button", "ex-b"); set.id = "fbSet"; set.type = "button";
    const rf = mk("button", "ex-ib", "↻"); rf.id = "fbRefresh"; rf.type = "button";
    const cl = mk("button", "ex-ib", "✕"); cl.id = "fbClose"; cl.type = "button";
    head.append(title, set, rf, cl);
    const tabs = mk("div", "fb-tabs"); tabs.setAttribute("role", "tablist");
    ["complaints", "moderation"].forEach((k) => { const b = mk("button", "fb-tab"); b.type = "button"; b.id = "fbTab_" + k; b.setAttribute("role", "tab"); b.addEventListener("click", () => { S.tab = k; S.active = null; S.detail = null; S.showSettings = false; draw(); load().catch((e) => hint(errText(e))); }); tabs.appendChild(b); });
    const stats = mk("div", "ex-stats"); stats.id = "fbStats";
    const body = mk("div", "ex-body"); body.id = "fbBody";
    const list = mk("div", "ex-list"), fl = mk("div", "ex-filters");
    const s1 = mk("select"); s1.id = "fbStatus"; const s2 = mk("select"); s2.id = "fbAgainst"; const q = mk("input"); q.id = "fbSearch"; q.type = "search"; q.autocomplete = "off";
    fl.append(s1, s2, q);
    const items = mk("div", "ex-items"); items.id = "fbItems"; list.append(fl, items);
    const det = mk("div", "ex-detail"); det.id = "fbDetail";
    body.append(list, det);
    const mod = mk("div", "fb-mod"); mod.id = "fbMod"; mod.hidden = true;
    const h = mk("div", "ex-hint"); h.id = "fbHint"; h.setAttribute("role", "alert");
    card.append(head, tabs, stats, body, mod, h); m.appendChild(card);
    cl.addEventListener("click", () => showFeedback(false));
    rf.addEventListener("click", () => load().catch((e) => hint(errText(e))));
    set.addEventListener("click", () => { S.showSettings = !S.showSettings; S.active = null; draw(); });
    [s1, s2].forEach((s) => s.addEventListener("change", () => load().catch((e) => hint(errText(e)))));
    let qt = null; q.addEventListener("input", () => { clearTimeout(qt); qt = setTimeout(() => load().catch(() => {}), 300); });
  }

  function fill(id, opts) { const s = $(id), cur = s.value; s.replaceChildren(); opts.forEach(([v, l]) => { const o = mk("option", "", l); o.value = v; s.appendChild(o); }); if ([...s.options].some((o) => o.value === cur)) s.value = cur; }

  const detailHasDraft = () => !!(S.active && document.querySelector("#fbDetail .ex-form:not([hidden])"));

  function draw(preserveDraft = false) {
    const x = t(); build();
    $("fbTitle").textContent = x.title; if ($("feedbackText")) $("feedbackText").textContent = x.title;
    $("fbSet").textContent = x.settings; $("fbSet").hidden = S.tab !== "complaints" || !can("complaints.read");
    $("fbRefresh").title = x.refresh; $("fbClose").title = x.close; $("fbSearch").placeholder = x.search;
    ["complaints", "moderation"].forEach((k) => {
      const b = $("fbTab_" + k); b.textContent = x[k]; b.setAttribute("aria-selected", String(S.tab === k)); b.hidden = k === "moderation" ? !can("feedback.moderate") : !can("complaints.read");
    });
    const isC = S.tab === "complaints";
    $("fbBody").hidden = !isC; $("fbStats").hidden = !isC; $("fbMod").hidden = isC;
    if (isC) {
      fill("fbStatus", [["open", x.open], ["", x.all]].concat(Object.keys(x.status).map((k) => [k, x.status[k]])));
      fill("fbAgainst", [["", x.allAgainst]].concat(Object.keys(x.against).map((k) => [k, x.against[k]])));
      renderStats(); renderList();
      if (!preserveDraft || (!detailHasDraft() && !S.showSettings)) renderDetail();
    } else if (!preserveDraft || !moderationHasDraft()) renderMod();
  }

  function renderStats() {
    const c = S.counts, box = $("fbStats"); if (!box) return; box.replaceChildren(); if (!c) return; const x = t();
    [["open", c.open, c.escalated > 0], ["with_party", c.with_party], ["escalated", (c.escalated || 0) + (c.in_review || 0), (c.escalated || 0) > 0], ["resolved", c.resolved]].forEach(([k, n, bad]) => {
      const d = mk("div", "ex-stat" + (bad ? " bad" : "")); d.append(mk("b", "", String(n || 0)), mk("small", "", k === "open" ? x.open : x.status[k])); box.appendChild(d);
    });
  }
  function renderList() {
    const box = $("fbItems"); if (!box) return; box.replaceChildren(); const x = t();
    if (!S.list.length) { box.appendChild(mk("div", "ex-empty", x.none)); return; }
    S.list.forEach((c) => {
      const b = mk("button", "ex-item" + (S.active === c.id ? " on" : "")); b.type = "button"; b.dataset.id = c.id;
      const top = mk("b"); top.append(mk("span", "", c.id), mk("span", "ex-pill s-" + c.status, x.status[c.status] || c.status));
      b.append(top, mk("small", "", (x.cat[c.category] || c.category) + " • " + (x.against[c.against] || c.against) + " • " + x.order + " #" + c.orderId), mk("small", "", c.text));
      b.addEventListener("click", () => openCase(c.id)); box.appendChild(b);
    });
  }
  async function load() {
    if (S.tab === "moderation") return loadMod();
    const qs = new URLSearchParams();
    [["status", "fbStatus"], ["against", "fbAgainst"], ["q", "fbSearch"]].forEach(([k, id]) => { const v = $(id).value.trim(); if (v) qs.set(k, v); });
    const r = await api("/api/admin/complaints?" + qs.toString());
    S.list = r.complaints || []; S.counts = r.counts; S.outcomes = r.outcomes || S.outcomes; S.settings = r.settings;
    renderStats(); renderList();
    const active = S.active;
    if (active) { try { await loadDetail(active, true); } catch (e) { if (e.status === 404 && S.active === active) { S.active = null; S.detail = null; renderDetail(); } } }
    hint("");
  }
  async function loadDetail(id, preserveDraft = false) {
    const detail = (await api("/api/admin/complaints/" + encodeURIComponent(id))).complaint;
    if (S.active !== id) return; // a different complaint was selected while this request was in flight
    S.detail = detail;
    if (!preserveDraft || !detailHasDraft()) renderDetail();
  }
  async function openCase(id) { S.active = id; S.showSettings = false; try { await loadDetail(id); } catch (e) { hint(errText(e)); } renderList(); $("fbBody").classList.add("open"); }

  function renderDetail() {
    const box = $("fbDetail"); if (!box) return; box.replaceChildren(); const x = t();
    if (S.showSettings) return renderSettings(box);
    const c = S.detail;
    if (!c || S.active !== c.id) { box.appendChild(mk("div", "ex-empty", x.pick)); return; }
    const back = mk("button", "ex-b ex-back", "← " + x.back); back.type = "button"; back.addEventListener("click", () => { $("fbBody").classList.remove("open"); S.active = null; renderList(); }); box.appendChild(back);
    const dh = mk("div", "ex-dhead"); const l = mk("div"); l.append(mk("b", "", c.id), mk("small", "", (x.cat[c.category] || c.category) + " • " + (x.against[c.against] || c.against) + " • " + x.order + " #" + c.orderId));
    const pills = mk("div", "ex-pills"); pills.appendChild(mk("span", "ex-pill s-" + c.status, x.status[c.status] || c.status)); dh.append(l, pills); box.appendChild(dh);
    box.appendChild(mk("p", "", c.text));
    if (c.exceptionCaseId) box.appendChild(mk("div", "ex-muted", x.linked + ": " + c.exceptionCaseId));
    if (c.resolution) { const r = mk("div", "ex-res"); r.append(mk("b", "", x.resolution + ": " + (x.outcome[c.resolution.outcome] || c.resolution.outcome)), mk("div", "", c.resolution.note || ""), mk("small", "ex-muted", fmt(c.resolution.at))); box.appendChild(r); }
    const sec = mk("div", "ex-sec"); sec.appendChild(mk("h4", "", x.timeline)); const ul = mk("ul", "ex-tl");
    c.timeline.forEach((e) => { const li = mk("li"); li.append(mk("small", "", (x.who[e.actor.role] || e.actor.role) + " • " + (x.kind[e.kind] || e.kind) + " • " + fmt(e.at) + (e.visibility === "internal" ? " 🔒" : "")), mk("span", "", e.text && !["routed", "auto_escalated"].includes(e.kind) ? e.text : "")); ul.appendChild(li); });
    sec.appendChild(ul); box.appendChild(sec);
    if (c.status === "resolved" || !can("complaints.manage")) return;
    const acts = mk("div", "ex-acts"); box.appendChild(acts);
    const form = mk("div", "ex-form"); form.hidden = true; box.appendChild(form);
    const btn = (label, fn) => { const b = mk("button", "ex-b", label); b.type = "button"; b.addEventListener("click", fn); acts.appendChild(b); return b; };
    const field = (label, el) => { const f = mk("label", "ex-f"); f.append(mk("span", "", label), el); return f; };
    const run = async (b, path, body, after) => { if (S.busy) return; S.busy = true; b.disabled = true; hint(""); try { const r = await post(path, body); S.detail = r.complaint; await load(); renderDetail(); hint(x.done, true); if (after) after(); } catch (e) { hint(errText(e)); } finally { S.busy = false; b.disabled = false; } };
    const simple = (label, path, withReason, fieldLabel) => btn(label, () => {
      form.replaceChildren(); form.hidden = false; form.appendChild(mk("h5", "", label));
      const ta = mk("textarea"); ta.rows = 3; ta.maxLength = 1000; form.appendChild(field(fieldLabel, ta));
      const ok = mk("button", "ex-b pri", x.confirm); ok.type = "button"; ok.addEventListener("click", () => run(ok, "/api/admin/complaints/" + encodeURIComponent(c.id) + "/" + path, withReason ? { reason: ta.value } : { text: ta.value })); form.appendChild(ok); ta.focus();
    });
    if (c.status === "escalated") { const tk = btn(x.aTake, () => run(tk, "/api/admin/complaints/" + encodeURIComponent(c.id) + "/take", {})); }
    if (c.status === "with_party" || c.status === "party_responded") simple(x.aEsc, "escalate", true, x.reason);
    simple(x.aMsg, "message", false, x.text); simple(x.aNote, "note", false, x.text);
    btn(x.aResolve, () => {
      form.replaceChildren(); form.hidden = false; form.appendChild(mk("h5", "", x.aResolve));
      const sel = mk("select"); const o0 = mk("option", "", "—"); o0.value = ""; sel.appendChild(o0); S.outcomes.forEach((k) => { const o = mk("option", "", x.outcome[k] || k); o.value = k; sel.appendChild(o); });
      const ta = mk("textarea"); ta.rows = 3; ta.maxLength = 1000;
      form.append(field(x.outcome_, sel), field(x.resolutionNote, ta));
      const ok = mk("button", "ex-b pri", x.confirm); ok.type = "button"; ok.addEventListener("click", () => run(ok, "/api/admin/complaints/" + encodeURIComponent(c.id) + "/resolve", { outcome: sel.value, note: ta.value })); form.appendChild(ok);
    });
  }

  function renderSettings(box) {
    const x = t(); box.appendChild(mk("h4", "", x.deadlines)); box.appendChild(mk("p", "ex-muted", x.bounds));
    const s = S.settings || {}, inputs = {};
    ["partyResponseHours", "customerReplyHours"].forEach((k) => { const i = mk("input"); i.type = "number"; i.value = s[k]; i.disabled = !can("complaints.settings"); inputs[k] = i; const f = mk("label", "ex-f"); f.append(mk("span", "", x[k]), i); box.appendChild(f); });
    if (!can("complaints.settings")) return;
    const ok = mk("button", "ex-b pri", x.save); ok.type = "button";
    ok.addEventListener("click", async () => { if (S.busy) return; S.busy = true; ok.disabled = true; try { const body = {}; Object.keys(inputs).forEach((k) => { body[k] = Number(inputs[k].value); }); const r = await api("/api/admin/complaints/settings", { method: "PUT", body: JSON.stringify(body) }); S.settings = r.settings; hint(x.done, true); } catch (e) { hint(errText(e)); } finally { S.busy = false; ok.disabled = false; } });
    box.appendChild(ok);
  }

  /* ---------------- comment moderation ---------------- */
  const moderationHasDraft = () => !!document.querySelector("#fbMod .fb-card .ex-form");
  async function loadMod() {
    const st = (document.querySelector("#fbMod .fb-filter-status") || {}).value || "pending", kind = (document.querySelector("#fbMod .fb-filter-kind") || {}).value || "";
    const r = await api("/api/admin/feedback/moderation?status=" + encodeURIComponent(st) + (kind ? "&kind=" + kind : ""));
    S.mod = r.items || []; S.modCounts = r.counts; S.modStatus = st; S.modKind = kind;
    if (!moderationHasDraft()) renderMod();
    setBadge((r.counts && r.counts.pending) || 0); hint("");
  }
  function renderMod() {
    const box = $("fbMod"); if (!box) return; const x = t(); box.replaceChildren();
    const bar = mk("div", "ex-filters"); const s1 = mk("select", "fb-filter-status"), s2 = mk("select", "fb-filter-kind");
    ["pending", "published", "rejected"].forEach((k) => { const o = mk("option", "", x[k] + (S.modCounts ? " (" + (S.modCounts[k] || 0) + ")" : "")); o.value = k; s1.appendChild(o); });
    [["", x.allKinds], ["store", x.store], ["driver", x.driver]].forEach(([v, l]) => { const o = mk("option", "", l); o.value = v; s2.appendChild(o); });
    s1.value = S.modStatus || "pending"; s2.value = S.modKind || "";
    [s1, s2].forEach((s) => s.addEventListener("change", () => loadMod().catch((e) => hint(errText(e))))); bar.append(s1, s2); box.appendChild(bar);
    if (!S.mod.length) { box.appendChild(mk("div", "ex-empty", x.none)); return; }
    S.mod.forEach((it) => {
      const c = mk("div", "fb-card"); c.dataset.order = it.orderId; c.dataset.kind = it.kind;
      c.appendChild(mk("div", "st", "★".repeat(it.stars) + "☆".repeat(5 - it.stars)));
      c.appendChild(mk("small", "ex-muted", (it.kind === "store" ? x.store + ": " + (it.storeName || it.storeId) : x.driver + ": " + (it.driverName || it.driverId)) + " • " + x.order + " #" + it.orderId + (it.customerName ? " • " + it.customerName : "") + " • " + fmt(it.createdAt)));
      c.appendChild(mk("p", "", it.comment || x.noText));
      if (it.flags) c.appendChild(mk("small", "ex-muted", x.polite + ": " + (it.flags.polite ? x.yes : x.no) + " • " + x.extra + ": " + (it.flags.askedExtraMoney ? x.yes : x.no)));
      if (it.moderation) c.appendChild(mk("small", "ex-muted", (x[it.commentStatus] || it.commentStatus) + " " + x.by + " " + it.moderation.by + " • " + fmt(it.moderation.at) + (it.moderation.reason ? " • " + it.moderation.reason : "")));
      const acts = mk("div", "ex-acts"); c.appendChild(acts);
      const decide = async (b, decision, reason) => { if (S.busy) return; S.busy = true; b.disabled = true; try { await post("/api/admin/feedback/moderation", { orderId: it.orderId, kind: it.kind, decision, reason }); const completed = c.querySelector(".ex-form"); if (completed) completed.remove(); await loadMod(); hint(x.done, true); } catch (e) { hint(errText(e)); } finally { S.busy = false; b.disabled = false; } };
      if (it.commentStatus !== "published") { const p = mk("button", "ex-b pri", x.publish); p.type = "button"; p.addEventListener("click", () => decide(p, "publish")); acts.appendChild(p); }
      if (it.commentStatus !== "rejected") {
        const r = mk("button", "ex-b bad", x.reject); r.type = "button";
        r.addEventListener("click", () => {
          if (c.querySelector(".ex-form")) return;
          const f = mk("div", "ex-form"); const ta = mk("textarea"); ta.rows = 2; ta.maxLength = 300; const lab = mk("label", "ex-f"); lab.append(mk("span", "", x.rejectReason), ta);
          const ok = mk("button", "ex-b bad", x.confirm); ok.type = "button"; ok.addEventListener("click", () => decide(ok, "reject", ta.value)); f.append(lab, ok); c.appendChild(f); ta.focus();
        });
        acts.appendChild(r);
      }
      box.appendChild(c);
    });
  }

  /* ---------------- open/close + badge ---------------- */
  function setBadge(n) { document.querySelectorAll('.sb-item[data-key="feedback"] .sb-badge').forEach((b) => { b.textContent = n > 99 ? "99+" : String(n); b.hidden = !n; }); }
  async function refreshBadge() {
    if (typeof token === "undefined" || !token || document.hidden) return;
    const m = $("feedbackModal"); if (m && m.classList.contains("show")) return;
    let n = 0;
    try {
      if (can("complaints.read")) { const r = await api("/api/admin/complaints?status=escalated&per=1"); n += (r.counts && r.counts.escalated) || 0; }
      if (can("feedback.moderate")) { const r = await api("/api/admin/feedback/moderation?status=pending"); n += (r.counts && r.counts.pending) || 0; }
      setBadge(n);
    } catch (_e) {}
  }
  function showFeedback(show) {
    const m = $("feedbackModal"); m.classList.toggle("show", !!show);
    clearInterval(S.timer); S.timer = null;
    if (!show) return;
    S.timer = setInterval(() => { if (!document.hidden && !S.busy && !document.querySelector("#feedbackModal .ex-form")) load().catch(() => {}); }, 20000);
  }
  window.showFeedback = showFeedback;

  function init() {
    if (!$("feedbackModal")) return;
    draw();
    const btn = $("feedbackBtn");
    if (btn) btn.addEventListener("click", async () => {
      if (typeof token === "undefined" || !token) return showAuth(true);
      try {
        S.tab = can("complaints.read") ? "complaints" : "moderation"; S.active = null; S.detail = null; S.showSettings = false; draw();
        if (S.tab === "complaints") { const r = await api("/api/admin/complaints?status=open"); S.outcomes = r.outcomes || []; S.list = r.complaints || []; S.counts = r.counts; S.settings = r.settings; draw(); }
        else await loadMod();
        showFeedback(true);
      } catch (e) { if (typeof toast === "function") toast(errText(e)); }
    });
    new MutationObserver(() => { draw(true); }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    S.badgeTimer = setInterval(refreshBadge, 30000); setTimeout(refreshBadge, 3500);
  }
  init();
})();

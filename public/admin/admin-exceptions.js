/* Exception-management center (admin): delayed preparation, rejected / unassigned orders, driver failures, failed deliveries,
   refund requests, disputes and payment errors — one list, one case view with timeline, controlled actions.
   The SERVER authorises and validates every call (lib/admin-roles.js + lib/exception-routes.js); permOk() only hides what a role cannot use.
   A case can only be closed with an outcome + note; the UI asks for both and shows the server's refusal if it still fails.
   Loaded after admin.js (uses: api, lang, toast, token, permOk, showAuth). All server text goes through textContent. */
"use strict";
(function () {
  const T = {
    ar: { title: "مركز الاستثناءات", refresh: "تحديث", close: "إغلاق", back: "رجوع", scan: "فحص الطلبات الآن", newCase: "حالة جديدة", settings: "الإعدادات",
      active: "نشطة", urgent: "عاجلة", escalated: "مُصعَّدة", resolved: "محلولة", all: "الكل", allTypes: "كل الأنواع", allPrio: "كل الأولويات", search: "بحث برقم الحالة أو الطلب أو السبب…",
      none: "لا توجد حالات", pick: "اختر حالة من القائمة", order: "الطلب", responsible: "المسؤول", reasons: "الأسباب", timeline: "السجل الزمني", actions: "الإجراءات",
      status: { open: "مفتوحة", in_progress: "قيد المعالجة", escalated: "مُصعَّدة", resolved: "محلولة" }, prio: { low: "منخفضة", normal: "عادية", high: "مرتفعة", urgent: "عاجلة" },
      type: { delayed_preparation: "تأخر التحضير", rejected_order: "طلب مرفوض", unassigned_order: "طلب بلا سائق", driver_failure: "تعثّر السائق", failed_delivery: "فشل التسليم", cancel_refund_request: "طلب إلغاء/استرجاع", complaint_dispute: "شكوى/نزاع", payment_error: "خطأ دفع/مطابقة" },
      resp: { supervisor: "المشرف", accounting: "المحاسبة", support: "الدعم" },
      outcome: { fixed: "تمت المعالجة", reassigned: "أُعيد الإسناد", redelivered: "أُعيد التسليم", refunded: "تم الاسترجاع", cancelled_confirmed: "أُكِّد الإلغاء", compensated: "تم التعويض", customer_at_fault: "الخطأ من الزبون", store_at_fault: "الخطأ من المتجر", driver_at_fault: "الخطأ من السائق", no_action_needed: "لا إجراء مطلوب", other: "أخرى" },
      party: { customer: "الزبون", store: "المتجر", driver: "السائق" }, kinds: { opened: "فُتحت", assigned: "إسناد", contact: "تواصل", escalated: "تصعيد", priority: "أولوية", reason: "سبب", reassign: "إعادة إسناد السائق", failed_attempt: "محاولة تسليم فاشلة", redelivery_scheduled: "إعادة تسليم", resolved: "حُلّت" },
      aTake: "استلام الحالة", aContact: "تسجيل تواصل", aEsc: "تصعيد", aRedeliver: "تسجيل فشل التسليم", aReassign: "إعادة إسناد السائق", aPrio: "تغيير الأولوية", aResolve: "إغلاق الحالة بحلّ",
      note: "ملاحظة", reason: "السبب", to: "إلى", party_: "الطرف", outcome_: "النتيجة النهائية", resolution: "الحل", confirm: "تنفيذ", cancel: "إلغاء",
      sure: "إعادة إسناد السائق ستُلغي إسناده الحالي وتعيد الطلب إلى التوزيع. متابعة؟", done: "تم", failed: "تعذّر التنفيذ", redo: "سيُعاد التسليم (المحاولة {n} من {m})", esc2: "استُنفدت المحاولات وصُعّدت الحالة للمشرف", scanned: "فُحص {s} — حالات جديدة: {c}",
      RESOLUTION_REQUIRED: "لا يمكن إغلاق الحالة دون اختيار النتيجة وكتابة الحل.", CASE_CLOSED: "الحالة مغلقة ولا تقبل تغييراً.", NOT_REASSIGNABLE: "لا يمكن إعادة الإسناد بعد استلام الطلب من المتجر.", FINANCE_PERMISSION: "إغلاق الحالات المالية يحتاج صلاحية مالية.", REASON_REQUIRED: "اكتب السبب.",
      resolvedBy: "أُغلقت", orderRef: "طلب", sMsg: "حدود الإعدادات آمنة ويرفض الخادم القيم خارجها", prepDelayMin: "دقائق قبل اعتبار التحضير متأخراً", unassignedMin: "دقائق قبل اعتبار الطلب بلا سائق", maxRedeliveryAttempts: "محاولات إعادة التسليم", urgentAfterMin: "دقائق حتى تصبح الحالة عاجلة", save: "حفظ", create: "فتح الحالة", orderId: "رقم الطلب", noOrder: "(اختياري للمدفوعات)", kind: "النوع" },
    fr: { title: "Centre d'exceptions", refresh: "Actualiser", close: "Fermer", back: "Retour", scan: "Analyser les commandes", newCase: "Nouveau cas", settings: "Réglages",
      active: "Actifs", urgent: "Urgents", escalated: "Escaladés", resolved: "Résolus", all: "Tous", allTypes: "Tous les types", allPrio: "Toutes priorités", search: "Chercher cas, commande ou motif…",
      none: "Aucun cas", pick: "Choisissez un cas", order: "Commande", responsible: "Responsable", reasons: "Motifs", timeline: "Chronologie", actions: "Actions",
      status: { open: "Ouvert", in_progress: "En cours", escalated: "Escaladé", resolved: "Résolu" }, prio: { low: "Basse", normal: "Normale", high: "Haute", urgent: "Urgente" },
      type: { delayed_preparation: "Préparation en retard", rejected_order: "Commande refusée", unassigned_order: "Sans livreur", driver_failure: "Défaillance livreur", failed_delivery: "Livraison échouée", cancel_refund_request: "Annulation/remboursement", complaint_dispute: "Réclamation/litige", payment_error: "Erreur de paiement" },
      resp: { supervisor: "Superviseur", accounting: "Comptabilité", support: "Support" },
      outcome: { fixed: "Corrigé", reassigned: "Réassigné", redelivered: "Relivré", refunded: "Remboursé", cancelled_confirmed: "Annulation confirmée", compensated: "Compensé", customer_at_fault: "Faute client", store_at_fault: "Faute boutique", driver_at_fault: "Faute livreur", no_action_needed: "Aucune action", other: "Autre" },
      party: { customer: "Client", store: "Boutique", driver: "Livreur" }, kinds: { opened: "Ouvert", assigned: "Attribué", contact: "Contact", escalated: "Escalade", priority: "Priorité", reason: "Motif", reassign: "Réassignation livreur", failed_attempt: "Tentative échouée", redelivery_scheduled: "Nouvelle livraison", resolved: "Résolu" },
      aTake: "Prendre le cas", aContact: "Noter un contact", aEsc: "Escalader", aRedeliver: "Enregistrer l'échec de livraison", aReassign: "Réassigner le livreur", aPrio: "Changer la priorité", aResolve: "Clore avec résolution",
      note: "Note", reason: "Motif", to: "Vers", party_: "Partie", outcome_: "Résultat final", resolution: "Résolution", confirm: "Valider", cancel: "Annuler",
      sure: "Le livreur actuel sera retiré et la commande renvoyée au dispatch. Continuer ?", done: "Fait", failed: "Échec", redo: "Nouvelle tentative ({n} sur {m})", esc2: "Tentatives épuisées : escaladé au superviseur", scanned: "Analysé {s} — nouveaux cas : {c}",
      RESOLUTION_REQUIRED: "Impossible de clore sans résultat ni résolution.", CASE_CLOSED: "Cas clos, aucune modification.", NOT_REASSIGNABLE: "Réassignation impossible après la récupération.", FINANCE_PERMISSION: "Clore un cas financier exige un droit financier.", REASON_REQUIRED: "Saisissez le motif.",
      resolvedBy: "Clos", orderRef: "Commande", sMsg: "Les bornes sont sûres ; le serveur refuse les valeurs hors limites", prepDelayMin: "Minutes avant « préparation en retard »", unassignedMin: "Minutes avant « sans livreur »", maxRedeliveryAttempts: "Tentatives de relivraison", urgentAfterMin: "Minutes avant « urgent »", save: "Enregistrer", create: "Ouvrir le cas", orderId: "N° de commande", noOrder: "(facultatif pour paiements)", kind: "Type" },
    en: { title: "Exception center", refresh: "Refresh", close: "Close", back: "Back", scan: "Scan orders now", newCase: "New case", settings: "Settings",
      active: "Active", urgent: "Urgent", escalated: "Escalated", resolved: "Resolved", all: "All", allTypes: "All types", allPrio: "All priorities", search: "Search case, order or reason…",
      none: "No cases", pick: "Pick a case from the list", order: "Order", responsible: "Responsible", reasons: "Reasons", timeline: "Timeline", actions: "Actions",
      status: { open: "Open", in_progress: "In progress", escalated: "Escalated", resolved: "Resolved" }, prio: { low: "Low", normal: "Normal", high: "High", urgent: "Urgent" },
      type: { delayed_preparation: "Delayed preparation", rejected_order: "Rejected order", unassigned_order: "Unassigned order", driver_failure: "Driver failure", failed_delivery: "Failed delivery", cancel_refund_request: "Cancel / refund request", complaint_dispute: "Complaint / dispute", payment_error: "Payment / reconciliation error" },
      resp: { supervisor: "Supervisor", accounting: "Accounting", support: "Support" },
      outcome: { fixed: "Fixed", reassigned: "Reassigned", redelivered: "Redelivered", refunded: "Refunded", cancelled_confirmed: "Cancellation confirmed", compensated: "Compensated", customer_at_fault: "Customer at fault", store_at_fault: "Store at fault", driver_at_fault: "Driver at fault", no_action_needed: "No action needed", other: "Other" },
      party: { customer: "Customer", store: "Store", driver: "Driver" }, kinds: { opened: "Opened", assigned: "Assigned", contact: "Contact", escalated: "Escalated", priority: "Priority", reason: "Reason", reassign: "Driver reassignment", failed_attempt: "Failed attempt", redelivery_scheduled: "Redelivery", resolved: "Resolved" },
      aTake: "Take the case", aContact: "Log a contact", aEsc: "Escalate", aRedeliver: "Record failed delivery", aReassign: "Reassign driver", aPrio: "Change priority", aResolve: "Close with resolution",
      note: "Note", reason: "Reason", to: "To", party_: "Party", outcome_: "Final outcome", resolution: "Resolution", confirm: "Confirm", cancel: "Cancel",
      sure: "The current driver will be released and the order returned to dispatch. Continue?", done: "Done", failed: "Failed", redo: "Redelivery allowed (attempt {n} of {m})", esc2: "Attempts exhausted: escalated to the supervisor", scanned: "Scanned {s} — new cases: {c}",
      RESOLUTION_REQUIRED: "A case cannot be closed without an outcome and a resolution note.", CASE_CLOSED: "This case is closed and cannot change.", NOT_REASSIGNABLE: "Cannot reassign once the order has been picked up.", FINANCE_PERMISSION: "Closing a financial case needs finance permission.", REASON_REQUIRED: "Enter the reason.",
      resolvedBy: "Closed", orderRef: "Order", sMsg: "Settings are bounded; the server rejects values outside the limits", prepDelayMin: "Minutes before preparation counts as delayed", unassignedMin: "Minutes before an order counts as unassigned", maxRedeliveryAttempts: "Redelivery attempts", urgentAfterMin: "Minutes until a case becomes urgent", save: "Save", create: "Open case", orderId: "Order id", noOrder: "(optional for payments)", kind: "Type" },
  };
  const L = () => (typeof lang !== "undefined" && T[lang] ? lang : "ar");
  const t = () => T[L()];
  const $ = (id) => document.getElementById(id);
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const can = (p) => (typeof permOk === "function" ? permOk(p) : true);
  const fmt = (iso) => { try { return new Date(iso).toLocaleString(L() === "ar" ? "ar-MA" : L(), { dateStyle: "short", timeStyle: "short" }); } catch (_e) { return ""; } };
  const errText = (e) => { const c = e && e.body && e.body.code; return (c && t()[c]) || (e && e.message) || t().failed; };
  const S = { list: [], counts: null, types: [], outcomes: [], settings: null, active: null, detail: null, busy: false, timer: null, badgeTimer: null, showSettings: false };
  const post = (path, body) => api(path, { method: "POST", body: JSON.stringify(body || {}) });

  function hint(msg, ok) { const h = $("exHint"); if (h) { h.textContent = msg || ""; h.classList.toggle("ok", !!ok); } }

  /* ---------------- skeleton (built once) ---------------- */
  function build() {
    const m = $("exceptionsModal"); if (!m || m.dataset.built) return; m.dataset.built = "1";
    const card = mk("div", "modal-card ex-card"); card.setAttribute("role", "dialog"); card.setAttribute("aria-labelledby", "exTitle");
    const head = mk("div", "ex-head");
    head.append(mk("h3", "", ""), mk("button", "ex-b", ""), mk("button", "ex-b", ""), mk("button", "ex-b", ""), mk("button", "ex-ib", "↻"), mk("button", "ex-ib", "✕"));
    head.children[0].id = "exTitle";
    [["exScan", 1], ["exNew", 2], ["exSet", 3], ["exRefresh", 4], ["exClose", 5]].forEach(([id, i]) => { head.children[i].id = id; head.children[i].type = "button"; });
    const stats = mk("div", "ex-stats"); stats.id = "exStats";
    const body = mk("div", "ex-body"); body.id = "exBody";
    const list = mk("div", "ex-list"), fl = mk("div", "ex-filters");
    const selS = mk("select"); selS.id = "exStatus"; const selT = mk("select"); selT.id = "exType"; const selP = mk("select"); selP.id = "exPrio";
    const q = mk("input"); q.id = "exSearch"; q.type = "search"; q.autocomplete = "off";
    fl.append(selS, selT, selP, q);
    const items = mk("div", "ex-items"); items.id = "exItems"; list.append(fl, items);
    const det = mk("div", "ex-detail"); det.id = "exDetail";
    body.append(list, det);
    const h = mk("div", "ex-hint"); h.id = "exHint"; h.setAttribute("role", "alert");
    card.append(head, stats, body, h); m.appendChild(card);
    $("exClose").addEventListener("click", () => showExceptions(false));
    $("exRefresh").addEventListener("click", () => refresh(true));
    $("exScan").addEventListener("click", scan);
    $("exNew").addEventListener("click", newCaseForm);
    $("exSet").addEventListener("click", () => { S.showSettings = !S.showSettings; S.active = null; renderDetail(); });
    [selS, selT, selP].forEach((s) => s.addEventListener("change", () => load().catch((e) => hint(errText(e)))));
    let qt = null; q.addEventListener("input", () => { clearTimeout(qt); qt = setTimeout(() => load().catch(() => {}), 300); });
  }

  function applyText() {
    const x = t(); build();
    $("exTitle").textContent = x.title; if ($("exceptionsText")) $("exceptionsText").textContent = x.title;
    $("exScan").textContent = x.scan; $("exNew").textContent = x.newCase; $("exSet").textContent = x.settings;
    $("exRefresh").title = x.refresh; $("exClose").title = x.close; $("exSearch").placeholder = x.search;
    $("exScan").hidden = $("exNew").hidden = !can("exceptions.manage"); $("exSet").hidden = !can("exceptions.settings");
    const fill = (id, opts) => { const s = $(id), cur = s.value; s.replaceChildren(); opts.forEach(([v, l]) => { const o = mk("option", "", l); o.value = v; s.appendChild(o); }); s.value = cur; };
    fill("exStatus", [["active", x.active], ["", x.all], ["open", x.status.open], ["in_progress", x.status.in_progress], ["escalated", x.status.escalated], ["resolved", x.status.resolved]]);
    fill("exType", [["", x.allTypes]].concat(Object.keys(x.type).map((k) => [k, x.type[k]])));
    fill("exPrio", [["", x.allPrio]].concat(["urgent", "high", "normal", "low"].map((k) => [k, x.prio[k]])));
  }

  /* ---------------- data ---------------- */
  async function load() {
    const qs = new URLSearchParams();
    [["status", "exStatus"], ["type", "exType"], ["priority", "exPrio"], ["q", "exSearch"]].forEach(([k, id]) => { const v = $(id).value.trim(); if (v) qs.set(k, v); });
    const r = await api("/api/admin/exceptions?" + qs.toString());
    S.list = r.cases || []; S.counts = r.counts; S.settings = r.settings; S.outcomes = r.outcomes || S.outcomes;
    renderStats(); renderList();
    const active = S.active;
    if (active) { try { await loadDetail(active, true); } catch (e) { if (e.status === 404 && S.active === active) { S.active = null; S.detail = null; renderDetail(); } } }
    hint("");
  }
  const detailHasDraft = () => !!document.querySelector("#exDetail .ex-form:not([hidden])");
  async function loadDetail(id, quiet) {
    const r = await api("/api/admin/exceptions/" + encodeURIComponent(id));
    if (S.active !== id) return; // selection changed while the request was in flight
    S.detail = r.case;
    if (!quiet || !detailHasDraft()) renderDetail();
    renderList();
  }
  const refresh = (manual) => load().catch((e) => hint(manual ? errText(e) : ""));

  /* ---------------- render ---------------- */
  function renderStats() {
    const x = t(), c = S.counts || { active: 0, urgent: 0, escalated: 0, resolved: 0 }, box = $("exStats"); box.replaceChildren();
    [["active", c.active], ["urgent", c.urgent], ["escalated", c.escalated], ["resolved", c.resolved]].forEach(([k, n]) => {
      const d = mk("div", "ex-stat" + (k === "urgent" && n ? " bad" : "")); d.append(mk("b", "", String(n)), mk("small", "", x[k])); box.appendChild(d);
    });
    setBadge(c.active);
  }
  function renderList() {
    const x = t(), box = $("exItems"); box.replaceChildren();
    if (!S.list.length) { box.appendChild(mk("div", "ex-empty", x.none)); return; }
    S.list.forEach((c) => {
      const b = mk("button", "ex-item" + (c.id === S.active ? " on" : "")); b.type = "button";
      const top = mk("b", "", x.type[c.type] || c.type); top.appendChild(mk("span", "ex-pill p-" + c.priority, x.prio[c.priority] || c.priority));
      b.append(top, mk("small", "", (c.orderId ? x.orderRef + " " + c.orderId.slice(0, 12) + " · " : "") + (c.reason || "")), mk("small", "", (x.status[c.status] || c.status) + " · " + (x.resp[c.responsible && c.responsible.role] || (c.responsible && c.responsible.role) || "") + " · " + fmt(c.updatedAt)));
      b.addEventListener("click", () => { S.active = c.id; S.showSettings = false; $("exBody").classList.add("open"); loadDetail(c.id).catch((e) => hint(errText(e))); });
      box.appendChild(b);
    });
  }

  function field(label, node) { const w = mk("label", "ex-f"); w.append(mk("span", "", label), node); return w; }
  function select(opts, cur) { const s = mk("select"); opts.forEach(([v, l]) => { const o = mk("option", "", l); o.value = v; s.appendChild(o); }); if (cur != null) s.value = cur; return s; }
  function textarea(ph) { const a = mk("textarea"); a.rows = 2; a.maxLength = 1000; if (ph) a.placeholder = ph; return a; }

  function renderDetail() {
    const x = t(), box = $("exDetail"); box.replaceChildren();
    $("exBody").classList.toggle("open", !!(S.detail && S.active) || S.showSettings);
    if (S.showSettings) return renderSettings(box);
    const c = S.detail;
    if (!c || !S.active) { box.appendChild(mk("div", "ex-empty", x.pick)); return; }
    const back = mk("button", "ex-ib ex-back", "‹"); back.type = "button"; back.addEventListener("click", () => { S.active = null; S.detail = null; $("exBody").classList.remove("open"); renderDetail(); renderList(); });
    const h = mk("div", "ex-dhead"); const ti = mk("div"); ti.append(mk("b", "", x.type[c.type] || c.type), mk("small", "", c.id + (c.orderId ? " · " + x.orderRef + " " + c.orderId : "")));
    const pills = mk("div", "ex-pills"); pills.append(mk("span", "ex-pill s-" + c.status, x.status[c.status] || c.status), mk("span", "ex-pill p-" + c.priority, x.prio[c.priority] || c.priority));
    h.append(back, ti, pills); box.appendChild(h);
    const info = mk("div", "ex-info"); info.append(mk("div", "", x.responsible + ": " + (x.resp[c.responsible.role] || c.responsible.role) + (c.responsible.name ? " (" + c.responsible.name + ")" : "")));
    if (c.type === "failed_delivery") info.appendChild(mk("div", "", "↻ " + c.redelivery.attempts + " / " + c.redelivery.max));
    box.appendChild(info);
    const rs = mk("div", "ex-sec"); rs.appendChild(mk("h4", "", x.reasons)); const ul = mk("ul"); c.reasons.forEach((r) => ul.appendChild(mk("li", "", r))); rs.appendChild(ul); box.appendChild(rs);
    if (c.resolution) {
      const r = mk("div", "ex-sec ex-res"); r.appendChild(mk("h4", "", x.resolution + " — " + (x.outcome[c.resolution.outcome] || c.resolution.outcome)));
      r.append(mk("p", "", c.resolution.note), mk("small", "", x.resolvedBy + " · " + fmt(c.resolution.at))); box.appendChild(r);
    }
    const tl = mk("div", "ex-sec"); tl.appendChild(mk("h4", "", x.timeline)); const ol = mk("ol", "ex-tl");
    c.timeline.forEach((e) => { const li = mk("li"); li.append(mk("b", "", x.kinds[e.kind] || e.kind), mk("span", "", " " + (e.text || "")), mk("small", "", (e.by ? e.by + " · " : "") + fmt(e.at))); ol.appendChild(li); });
    tl.appendChild(ol); box.appendChild(tl);
    if (c.status !== "resolved" && can("exceptions.manage")) box.appendChild(actionsBar(c));
  }

  function actionsBar(c) {
    const x = t(), sec = mk("div", "ex-sec"); sec.appendChild(mk("h4", "", x.actions));
    const bar = mk("div", "ex-acts"), form = mk("div", "ex-form"); form.hidden = true;
    const act = (label, cls, fn) => { const b = mk("button", "ex-b " + (cls || ""), label); b.type = "button"; b.addEventListener("click", fn); bar.appendChild(b); return b; };
    const open = (title, fields, submit, danger) => {
      form.replaceChildren(); form.hidden = false; form.appendChild(mk("h5", "", title));
      fields.forEach((f) => form.appendChild(f));
      const row = mk("div", "ex-row"), ok = mk("button", "ex-b pri" + (danger ? " bad" : ""), x.confirm), no = mk("button", "ex-b", x.cancel); ok.type = no.type = "button";
      no.addEventListener("click", () => { form.hidden = true; });
      ok.addEventListener("click", async () => { if (S.busy) return; S.busy = true; ok.disabled = true; try { await submit(); form.hidden = true; renderDetail(); } catch (e) { hint(errText(e)); } finally { S.busy = false; ok.disabled = false; } });
      row.append(ok, no); form.appendChild(row);
    };
    const run = async (path, body, okMsg) => { const r = await post("/api/admin/exceptions/" + encodeURIComponent(c.id) + "/" + path, body); S.detail = r.case; hint(okMsg || x.done, true); await load(); return r; };
    act(x.aTake, "", async () => { try { await run("assign", { to: "me" }); } catch (e) { hint(errText(e)); } });
    act(x.aContact, "", () => { const p = select(Object.keys(x.party).map((k) => [k, x.party[k]])), n = textarea(); open(x.aContact, [field(x.party_, p), field(x.note, n)], () => run("contact", { party: p.value, note: n.value })); });
    act(x.aEsc, "", () => { const to = select([["accounting", x.resp.accounting], ["support", x.resp.support], ["supervisor", x.resp.supervisor]]), r = textarea(); open(x.aEsc, [field(x.to, to), field(x.reason, r)], () => run("escalate", { to: to.value, reason: r.value })); });
    if (c.type === "failed_delivery") act(x.aRedeliver, "", () => { const r = textarea(); open(x.aRedeliver, [field(x.reason, r)], async () => { const o = await run("redeliver", { reason: r.value }, ""); hint(o.decision === "redeliver" ? x.redo.replace("{n}", o.case.redelivery.attempts).replace("{m}", o.case.redelivery.max) : x.esc2, true); }); });
    if (c.orderId && can("dispatch.manage") && ["driver_failure", "unassigned_order", "failed_delivery", "delayed_preparation", "complaint_dispute"].includes(c.type))
      act(x.aReassign, "", () => open(x.aReassign, [mk("p", "", x.sure)], () => run("reassign", {}), true));
    act(x.aPrio, "", () => { const p = select(["urgent", "high", "normal", "low"].map((k) => [k, x.prio[k]]), c.priority); open(x.aPrio, [field(x.aPrio, p)], () => run("priority", { priority: p.value })); });
    act(x.aResolve, "pri", () => { const o = select([["", "—"]].concat(S.outcomes.map((k) => [k, x.outcome[k] || k]))), n = textarea(); open(x.aResolve, [field(x.outcome_, o), field(x.resolution, n)], () => run("resolve", { outcome: o.value, note: n.value })); });
    sec.append(bar, form); return sec;
  }

  function newCaseForm() {
    const x = t(), box = $("exDetail"); S.active = null; S.detail = null; S.showSettings = false; box.replaceChildren(); $("exBody").classList.add("open");
    const f = mk("div", "ex-form"); f.appendChild(mk("h5", "", x.newCase));
    const ty = select(Object.keys(x.type).map((k) => [k, x.type[k]])), oid = mk("input"); oid.placeholder = x.noOrder; oid.maxLength = 80; const rs = textarea();
    const pr = select(["", "urgent", "high", "normal", "low"].map((k) => [k, k ? x.prio[k] : "—"]));
    const ok = mk("button", "ex-b pri", x.create); ok.type = "button";
    ok.addEventListener("click", async () => { if (S.busy) return; S.busy = true; ok.disabled = true; try { const r = await post("/api/admin/exceptions", { type: ty.value, orderId: oid.value.trim(), reason: rs.value, priority: pr.value || undefined }); S.active = r.case.id; S.detail = r.case; await load(); renderDetail(); hint(x.done, true); } catch (e) { hint(errText(e)); } finally { S.busy = false; ok.disabled = false; } });
    f.append(field(x.kind, ty), field(x.order, oid), field(x.reason, rs), field(x.aPrio, pr), ok); box.appendChild(f);
  }

  function renderSettings(box) {
    const x = t(), s = S.settings || {}; box.appendChild(mk("h4", "", x.settings)); box.appendChild(mk("p", "ex-muted", x.sMsg));
    const inputs = {};
    ["prepDelayMin", "unassignedMin", "maxRedeliveryAttempts", "urgentAfterMin"].forEach((k) => { const i = mk("input"); i.type = "number"; i.value = s[k]; i.inputMode = "numeric"; inputs[k] = i; box.appendChild(field(x[k], i)); });
    const ok = mk("button", "ex-b pri", x.save); ok.type = "button";
    ok.addEventListener("click", async () => { if (S.busy) return; S.busy = true; ok.disabled = true; try { const body = {}; Object.keys(inputs).forEach((k) => { body[k] = Number(inputs[k].value); }); const r = await api("/api/admin/exceptions/settings", { method: "PUT", body: JSON.stringify(body) }); S.settings = r.settings; hint(x.done, true); } catch (e) { hint(errText(e)); } finally { S.busy = false; ok.disabled = false; } });
    box.appendChild(ok);
  }

  async function scan() {
    if (S.busy) return; S.busy = true; $("exScan").disabled = true;
    try { const r = await post("/api/admin/exceptions/scan"); await load(); hint(t().scanned.replace("{s}", r.scanned).replace("{c}", r.created), true); } catch (e) { hint(errText(e)); } finally { S.busy = false; $("exScan").disabled = false; }
  }

  /* ---------------- open/close + badge ---------------- */
  function setBadge(n) { document.querySelectorAll('.sb-item[data-key="exceptions"] .sb-badge').forEach((b) => { b.textContent = n > 99 ? "99+" : String(n); b.hidden = !n; }); }
  async function refreshBadge() {
    if (typeof token === "undefined" || !token || document.hidden || !can("exceptions.read")) return;
    const m = $("exceptionsModal"); if (m && m.classList.contains("show")) return;
    try { const r = await api("/api/admin/exceptions?status=active&per=1"); setBadge((r.counts && r.counts.active) || 0); } catch (_e) {}
  }
  function showExceptions(show) {
    const m = $("exceptionsModal"); m.classList.toggle("show", !!show);
    clearInterval(S.timer); S.timer = null;
    if (!show) return;
    S.timer = setInterval(() => { if (!document.hidden) refresh(false); }, 15000);
  }
  window.showExceptions = showExceptions;

  function init() {
    if (!$("exceptionsModal")) return;
    applyText();
    const btn = $("exceptionsBtn");
    if (btn) btn.addEventListener("click", async () => {
      if (typeof token === "undefined" || !token) return showAuth(true);
      try { S.active = null; S.detail = null; S.showSettings = false; applyText(); renderDetail(); const r = await api("/api/admin/exceptions?status=active"); S.outcomes = r.outcomes || []; $("exStatus").value = "active"; S.list = r.cases || []; S.counts = r.counts; S.settings = r.settings; renderStats(); renderList(); showExceptions(true); }
      catch (e) { if (typeof toast === "function") toast(errText(e)); }
    });
    new MutationObserver(() => { applyText(); renderStats(); renderList(); if (!detailHasDraft() && !S.showSettings) renderDetail(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    S.badgeTimer = setInterval(refreshBadge, 30000); setTimeout(refreshBadge, 3000);
  }
  init();
})();

"use strict";
/**
 * Ratings, complaints and the customer support centre (spec 16).
 *
 * customer: POST /api/customer/orders/:id/rate             rate the STORE (stars + optional comment; comment is moderated)
 *           GET  /api/customer/complaints | /:id            own complaints (public timeline only)
 *           POST /api/customer/complaints                   file a complaint linked to an order (idempotent by clientId)
 *           POST /api/customer/complaints/:id/accept | escalate | withdraw
 *           GET  /api/support/channels                      contact channels the admin published for customers
 * store:    GET  /api/store/feedback                        own average + PUBLISHED reviews
 *           GET  /api/store/complaints | /:id               complaints routed to THIS store
 *           POST /api/store/complaints/:id/respond
 * driver:   GET  /api/driver/complaints | /:id              complaints routed to THIS driver
 *           POST /api/driver/complaints/:id/respond
 * admin:    GET  /api/admin/feedback/moderation             comment queue          (feedback.moderate)
 *           POST /api/admin/feedback/moderation             publish / reject       (feedback.moderate)
 *           GET  /api/admin/complaints[/:id|/settings]      complaints             (complaints.read)
 *           POST /api/admin/complaints/:id/take|escalate|note|message|resolve   (complaints.manage)
 *           PUT  /api/admin/complaints/settings             deadlines              (complaints.settings: system_admin)
 *
 * Authorisation lives here and in lib/admin-roles.js, never in the UI: a customer only reaches complaints of their own
 * orders, a store/driver only complaints routed to it, a supervisor only what its role allows. Every state change is
 * validated by lib/complaints.js and the supervisor's decisions are written to the audit log.
 */
const R = require("./ratings");
const C = require("./complaints");

function registerFeedbackRoutes(app, d) {
  const {
    requireCustomer, requireDriver, requireStore = null, requireAdmin, loadOrders, saveOrders, loadRestaurants, loadDrivers = () => ({ drivers: [] }),
    readJson, writeJson, file, ownsOrder, appendAuditLog = () => {}, adminRoles, notifyCustomer = () => {}, exceptions = null,
    channels = () => [], publicChannels = () => [], limiter = () => (_req, _res, next) => next(), logger = null, now = Date.now,
  } = d;

  const load = () => { const j = readJson(file, { complaints: [], settings: {} }) || {}; return { complaints: Array.isArray(j.complaints) ? j.complaints : [], settings: j.settings && typeof j.settings === "object" ? j.settings : {} }; };
  const save = (j) => writeJson(file, j);
  const settingsOf = (j) => C.clampSettings(j.settings);
  const role = (req) => adminRoles.normalizeRole(req.adminRole);
  const adm = (req) => ({ role: role(req) || "supervisor", id: String(req.adminId || ""), name: "" });
  const audit = (req, action, extra) => appendAuditLog({ actorType: "admin", actorId: String(req.adminId || ""), role: role(req), action: "feedback." + action, ...extra });
  const orderById = (id) => (loadOrders().orders || []).find((o) => String(o.id) === String(id)) || null;
  const send = (res, r, extra) => (r.ok ? res.json({ ok: true, ...(extra || {}) }) : res.status(r.status || 400).json({ ok: false, error: r.error, code: r.code }));
  const unique = (j) => { const ids = new Set(j.complaints.map((c) => c.id)); for (let i = 0; i < 8; i++) { const id = C.newId(); if (!ids.has(id)) return id; } return C.newId(Math.random, () => now() + Math.floor(Math.random() * 1e6)); };

  /** Deadline rules, applied lazily on every read and by the background timer. Persists only when something changed. */
  function ageAll(j) {
    let changed = 0;
    for (const c of j.complaints) {
      const r = C.age(c, { now: now() });
      if (!r) continue;
      changed++;
      if (r === "escalated") onEscalated(c, "party_timeout");
      else if (r === "auto_resolved") notifyOf(c, "resolved");
    }
    if (changed) save(j);
    return changed;
  }

  /** Opens (once) the linked case in the supervisor's exception centre; failure is logged, never fatal to the complaint. */
  function onEscalated(c, reason) {
    notifyOf(c, "escalated");
    if (!exceptions || c.exceptionCaseId) return;
    try {
      const r = exceptions.openCase({ type: "complaint_dispute", orderId: c.orderId, storeId: c.storeId, driverId: c.driverId, customerId: c.customerId, reason: `${c.id}: ${reason || c.category}`, source: "complaint", dedupeKey: "complaint:" + c.id });
      if (r && r.ok && r.case) c.exceptionCaseId = r.case.id;
    } catch (e) { if (logger) logger.warn("complaint exception case failed", { message: String(e && e.message ? e.message : e) }); }
  }
  function closeLinkedCase(c, outcome, note, actor) {
    if (!exceptions || !c.exceptionCaseId) return;
    try { exceptions.resolveCase(c.exceptionCaseId, { outcome, note: `${c.id}: ${note || outcome}`, actor }); } catch (e) { if (logger) logger.warn("complaint case close failed", { message: String(e && e.message ? e.message : e) }); }
  }

  // customer notifications are Arabic, like every other notification the server creates today
  const NOTE = { responded: "ردّ الطرف المعني على شكواك", escalated: "تم تصعيد شكواك إلى المشرف", resolved: "تم إغلاق شكواك", filed: "تم استلام شكواك", message: "رسالة جديدة من فريق الدعم بخصوص شكواك", title: "شكواك" };
  /** One notification per real transition (every caller is guarded by the state machine, so a retry cannot repeat it). */
  function notifyOf(c, event) {
    try {
      notifyCustomer({ customerId: c.customerId, orderId: c.orderId, type: "complaint_" + event, title: NOTE.title + " " + c.id, message: NOTE[event] || NOTE.message });
    } catch (_e) {}
  }

  /* ================= customer: rate the store ================= */

  app.post("/api/customer/orders/:id/rate", requireCustomer, limiter(60_000, 10, "rs:"), (req, res) => {
    const v = R.validateStoreRating(req.body);
    if (!v.ok) return res.status(400).json({ error: "Invalid rating", code: v.error });
    const data = loadOrders();
    const order = (data.orders || []).find((o) => String(o.id) === String(req.params.id));
    if (!order) return res.status(404).json({ error: "Not found" });
    if (!ownsOrder(req, order)) return res.status(403).json({ error: "Not your order" });
    const can = R.canRateStore(order, now());
    if (!can.ok) return res.status(can.error === "window_expired" ? 410 : 409).json({ error: can.error === "not_delivered" ? "Order not delivered" : can.error, code: can.error });
    const rating = R.applyStoreRating(order, v.value, new Date(now()));
    order.updatedAt = new Date(now()).toISOString();
    saveOrders(data);
    res.json({ ok: true, rating: { stars: rating.stars, comment: rating.comment, commentStatus: R.commentStatusOf(rating) } });
  });

  /* ================= customer: complaints ================= */

  app.get("/api/customer/complaints", requireCustomer, limiter(60_000, 60, "cl:"), (req, res) => {
    const j = load(); ageAll(j);
    const mine = j.complaints.filter((c) => c.customerId === String(req.customerId)).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, complaints: mine.map(C.customerView), categories: C.CATEGORIES });
  });

  app.get("/api/customer/complaints/:id", requireCustomer, (req, res) => {
    const j = load(); ageAll(j);
    const c = j.complaints.find((x) => x.id === String(req.params.id) && x.customerId === String(req.customerId));
    if (!c) return res.status(404).json({ error: "Not found" });
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, complaint: C.customerView(c) });
  });

  app.post("/api/customer/complaints", requireCustomer, limiter(60_000, 6, "cf:"), (req, res) => {
    const v = C.validateComplaint(req.body);
    if (!v.ok) return res.status(400).json({ error: v.error, code: v.code });
    const order = orderById(v.value.orderId);
    // an order that is not yours looks exactly like one that does not exist
    if (!order || !ownsOrder(req, order)) return res.status(404).json({ error: "Order not found", code: "ORDER_NOT_FOUND" });
    const can = C.canFile(order, v.value.against, now());
    if (!can.ok) return res.status(can.status).json({ error: can.error, code: can.code });
    const j = load(); ageAll(j);
    const lim = C.checkLimits(j.complaints, { customerId: req.customerId, orderId: order.id, against: v.value.against, clientId: v.value.clientId });
    if (lim.duplicate) return res.json({ ok: true, duplicate: true, complaint: C.customerView(lim.duplicate) });
    if (!lim.ok) return res.status(lim.status).json({ error: lim.error, code: lim.code, existing: lim.existing });
    const c = C.create({ id: unique(j), order, customerId: req.customerId, value: v.value, settings: settingsOf(j), now: now() });
    if (c.status === "escalated") onEscalated(c, "platform");
    j.complaints.unshift(c);
    save(j);
    appendAuditLog({ actorType: "customer", actorId: String(req.customerId), action: "complaint.create", complaintId: c.id, orderId: c.orderId, against: c.against });
    notifyOf(c, "filed");
    res.status(201).json({ ok: true, complaint: C.customerView(c) });
  });

  function customerAct(name, fn) {
    app.post("/api/customer/complaints/:id/" + name, requireCustomer, limiter(60_000, 20, "ca:"), (req, res) => {
      const j = load(); ageAll(j);
      const c = j.complaints.find((x) => x.id === String(req.params.id) && x.customerId === String(req.customerId));
      if (!c) return res.status(404).json({ error: "Not found" });
      const before = c.status;
      const r = fn(c, req);
      if (r.ok) {
        if (name === "escalate") onEscalated(c, "customer");
        if (name === "accept" || name === "withdraw") closeLinkedCase(c, name === "accept" ? "fixed" : "no_action_needed", name, { role: "customer", id: req.customerId });
        save(j);
        appendAuditLog({ actorType: "customer", actorId: String(req.customerId), action: "complaint." + name, complaintId: c.id, previous: before, next: c.status });
      }
      send(res, r, { complaint: C.customerView(c) });
    });
  }
  customerAct("accept", (c, req) => C.customerAccept(c, { actor: { id: req.customerId }, now: now() }));
  customerAct("escalate", (c, req) => C.customerEscalate(c, { reason: req.body && req.body.reason, actor: { id: req.customerId }, now: now() }));
  customerAct("withdraw", (c, req) => C.customerWithdraw(c, { actor: { id: req.customerId }, now: now() }));

  /* ================= customer: support centre ================= */

  app.get("/api/support/channels", limiter(60_000, 60, "sc:"), (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, channels: publicChannels(channels(), "customers") });
  });

  /* ================= store ================= */

  if (requireStore) {
    // a store sees only complaints ABOUT the store (never ones about the driver or the platform on its orders)
    const storeComplaints = (j, req) => j.complaints.filter((c) => c.against === "store" && c.storeId === String(req.storeId));

    app.get("/api/store/feedback", requireStore("support.use"), (req, res) => {
      const orders = loadOrders().orders || [];
      res.setHeader("Cache-Control", "no-store");
      res.json({ ok: true, rating: R.storeAverage(orders, req.storeId), reviews: R.publishedStoreReviews(orders, req.storeId, 30) });
    });

    app.get("/api/store/complaints", requireStore("support.use"), (req, res) => {
      const j = load(); ageAll(j);
      const mine = storeComplaints(j, req).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
      res.setHeader("Cache-Control", "no-store");
      res.json({ ok: true, complaints: mine.map(C.partyView), awaiting: mine.filter((c) => c.status === "with_party").length });
    });

    app.get("/api/store/complaints/:id", requireStore("support.use"), (req, res) => {
      const j = load(); ageAll(j);
      const c = storeComplaints(j, req).find((x) => x.id === String(req.params.id));
      if (!c) return res.status(404).json({ error: "Not found" });
      res.setHeader("Cache-Control", "no-store");
      res.json({ ok: true, complaint: C.partyView(c) });
    });

    app.post("/api/store/complaints/:id/respond", requireStore("support.use"), limiter(60_000, 20, "scr:"), (req, res) => {
      const j = load(); ageAll(j);
      const c = storeComplaints(j, req).find((x) => x.id === String(req.params.id));
      if (!c) return res.status(404).json({ error: "Not found" });
      const r = C.partyRespond(c, { party: { role: "store", id: req.storeId }, text: req.body && req.body.text, actor: { name: req.store && req.store.name && (req.store.name.ar || req.store.name.en) }, settings: settingsOf(j), now: now() });
      if (r.ok) {
        save(j);
        appendAuditLog({ actorType: "store", actorId: String(req.storeUserId || ""), action: "complaint.respond", complaintId: c.id, storeId: String(req.storeId) });
        notifyOf(c, "responded");
      }
      send(res, r, { complaint: C.partyView(c) });
    });
  }

  /* ================= driver ================= */

  const driverComplaints = (j, req) => j.complaints.filter((c) => c.against === "driver" && c.driverId === String(req.driverId));

  app.get("/api/driver/complaints", requireDriver, limiter(60_000, 30, "dc:"), (req, res) => {
    const j = load(); ageAll(j);
    const mine = driverComplaints(j, req).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, complaints: mine.map(C.partyView), awaiting: mine.filter((c) => c.status === "with_party").length });
  });

  app.get("/api/driver/complaints/:id", requireDriver, (req, res) => {
    const j = load(); ageAll(j);
    const c = driverComplaints(j, req).find((x) => x.id === String(req.params.id));
    if (!c) return res.status(404).json({ error: "Not found" });
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, complaint: C.partyView(c) });
  });

  app.post("/api/driver/complaints/:id/respond", requireDriver, limiter(60_000, 20, "dcr:"), (req, res) => {
    const j = load(); ageAll(j);
    const c = driverComplaints(j, req).find((x) => x.id === String(req.params.id));
    if (!c) return res.status(404).json({ error: "Not found" });
    const r = C.partyRespond(c, { party: { role: "driver", id: req.driverId }, text: req.body && req.body.text, actor: {}, settings: settingsOf(j), now: now() });
    if (r.ok) {
      save(j);
      appendAuditLog({ actorType: "driver", actorId: String(req.driverId), action: "complaint.respond", complaintId: c.id });
      notifyOf(c, "responded");
    }
    send(res, r, { complaint: C.partyView(c) });
  });

  /* ================= admin: comment moderation ================= */

  app.get("/api/admin/feedback/moderation", requireAdmin, (req, res) => {
    const orders = loadOrders().orders || [];
    const status = R.COMMENT_STATUSES.includes(req.query.status) ? req.query.status : "pending";
    const kind = R.KINDS.includes(req.query.kind) ? req.query.kind : "";
    const stores = new Map((loadRestaurants().restaurants || []).map((r) => [String(r.id), r]));
    const drivers = new Map((loadDrivers().drivers || []).map((x) => [String(x.id), x]));
    const nm = (n) => (n && typeof n === "object" ? n.ar || n.en || n.fr || "" : String(n || ""));
    const queue = R.moderationQueue(orders, { kind, status }).slice(0, 200)
      .map((q) => ({ ...q, storeName: nm((stores.get(q.storeId) || {}).name), driverName: String((drivers.get(q.driverId) || {}).name || "") }));
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, items: queue, counts: R.queueCounts(orders) });
  });

  app.post("/api/admin/feedback/moderation", requireAdmin, (req, res) => {
    const b = req.body || {};
    if (!R.KINDS.includes(b.kind)) return res.status(400).json({ ok: false, error: "Invalid kind", code: "INVALID_KIND" });
    const data = loadOrders();
    const order = (data.orders || []).find((o) => String(o.id) === String(b.orderId));
    const rating = order && order[R.FIELD[b.kind]];
    if (!rating) return res.status(404).json({ ok: false, error: "Not found" });
    const r = R.moderate(rating, { decision: b.decision, by: String(req.adminId || ""), reason: b.reason, now: new Date(now()) });
    if (r.ok) {
      saveOrders(data);
      audit(req, "moderate", { orderId: String(order.id), kind: b.kind, previous: r.from, next: r.to, reason: String(rating.moderation && rating.moderation.reason || "").slice(0, 200), result: "ok" });
    }
    send(res, r, { item: { orderId: String(order.id), kind: b.kind, commentStatus: R.commentStatusOf(rating), moderation: rating.moderation || null } });
  });

  /* ================= admin: complaints ================= */

  /** Least privilege per complaint: system_admin / order supervisor / support see all; driver supervisor only driver ones. */
  const visible = (r, c) => r === adminRoles.FULL || r === "order_supervisor" || r === "support" || (r === "driver_supervisor" && c.against === "driver");

  app.get("/api/admin/complaints/settings", requireAdmin, (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, settings: settingsOf(load()), bounds: C.BOUNDS });
  });

  app.put("/api/admin/complaints/settings", requireAdmin, (req, res) => {
    if (role(req) !== adminRoles.FULL) return res.status(403).json({ error: "Forbidden" });
    const v = C.validateSettingsPatch(req.body);
    if (!v.ok) return res.status(400).json({ ok: false, error: v.error, code: v.code });
    const j = load(); const before = settingsOf(j);
    j.settings = { ...before, ...v.value }; save(j);
    audit(req, "complaint.settings", { previous: before, next: j.settings, result: "ok" });
    res.json({ ok: true, settings: settingsOf(j) });
  });

  app.get("/api/admin/complaints", requireAdmin, (req, res) => {
    const j = load(); ageAll(j); const r = role(req);
    const mine = j.complaints.filter((c) => visible(r, c));
    const page = Math.max(1, parseInt(req.query.page, 10) || 1), per = Math.min(100, Math.max(1, parseInt(req.query.per, 10) || 50));
    const list = C.filter(mine, req.query || {});
    const stores = new Map((loadRestaurants().restaurants || []).map((x) => [String(x.id), x]));
    const nm = (n) => (n && typeof n === "object" ? n.ar || n.en || n.fr || "" : String(n || ""));
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, counts: C.counts(mine), total: list.length, page, per,
      complaints: list.slice((page - 1) * per, page * per).map((c) => ({ ...C.adminSummary(c), storeName: nm((stores.get(c.storeId) || {}).name) })),
      categories: C.CATEGORIES, outcomes: C.OUTCOMES, settings: settingsOf(j) });
  });

  app.get("/api/admin/complaints/:id", requireAdmin, (req, res) => {
    const j = load(); ageAll(j);
    const c = j.complaints.find((x) => x.id === String(req.params.id));
    if (!c || !visible(role(req), c)) return res.status(404).json({ error: "Not found" });
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, complaint: C.adminDetail(c) });
  });

  function adminAct(name, fn) {
    app.post("/api/admin/complaints/:id/" + name, requireAdmin, (req, res) => {
      const j = load(); ageAll(j);
      const c = j.complaints.find((x) => x.id === String(req.params.id));
      if (!c || !visible(role(req), c)) return res.status(404).json({ error: "Not found" });
      const before = { status: c.status, responsible: c.responsible && c.responsible.role };
      const r = fn(c, req);
      if (r.ok) {
        if (name === "escalate") onEscalated(c, String((req.body && req.body.reason) || "supervisor"));
        if (name === "resolve") closeLinkedCase(c, c.resolution.outcome, c.resolution.note, { id: String(req.adminId || ""), role: role(req), name: "" });
        if (name === "message") notifyOf(c, "message");
        save(j);
        audit(req, "complaint." + name, { complaintId: c.id, orderId: c.orderId, previous: before, next: { status: c.status, responsible: c.responsible && c.responsible.role }, result: "ok" });
        if (name === "resolve") notifyOf(c, "resolved");
      }
      send(res, r, { complaint: C.adminDetail(c) });
    });
  }
  adminAct("take", (c, req) => C.supervisorTake(c, { actor: adm(req), now: now() }));
  adminAct("escalate", (c, req) => C.supervisorEscalate(c, { reason: req.body && req.body.reason, actor: adm(req), now: now() }));
  adminAct("note", (c, req) => C.addInternalNote(c, { text: req.body && req.body.text, actor: adm(req), now: now() }));
  adminAct("message", (c, req) => C.addPublicNote(c, { text: req.body && req.body.text, actor: adm(req), now: now() }));
  adminAct("resolve", (c, req) => C.supervisorResolve(c, { outcome: req.body && req.body.outcome, note: req.body && req.body.note, actor: adm(req), now: now() }));

  return { age: () => { const j = load(); return ageAll(j); }, summary: () => C.counts(load().complaints) };
}

module.exports = { registerFeedbackRoutes };

"use strict";
/**
 * Supervisor exception-management center.
 *   GET  /api/admin/exceptions?status=&type=&priority=&q=&orderId=&storeId=&responsible=   list + counts   (exceptions.read)
 *   GET  /api/admin/exceptions/settings                                                    thresholds       (exceptions.read)
 *   PUT  /api/admin/exceptions/settings                                                    thresholds       (exceptions.settings: system_admin)
 *   GET  /api/admin/exceptions/:id                                                         full case + timeline
 *   POST /api/admin/exceptions                      open a case by hand
 *   POST /api/admin/exceptions/scan                 detect cases from real order records (idempotent)
 *   POST /api/admin/exceptions/:id/assign | contact | escalate | priority | redeliver | reassign | resolve   (exceptions.manage)
 * Authorisation: the role->permission table in lib/admin-roles.js gates the route; here we add the per-case rules
 * (a role only sees/acts on cases of its own domain; reassign needs dispatch.manage; closing money cases needs finance.write).
 */
const X = require("./exceptions");

const FINANCIAL = new Set(["payment_error", "cancel_refund_request"]);
const SENSITIVE_CLOSE = new Set(["payment_error", "cancel_refund_request"]);

function registerExceptionRoutes(app, d) {
  const { requireAdmin, readJson, writeJson, file, loadOrders, saveOrders, dispatchService = null, appendAuditLog = () => {}, adminRoles, logger = null, now = Date.now } = d;

  const load = () => { const j = readJson(file, { cases: [], settings: {} }) || {}; return { cases: Array.isArray(j.cases) ? j.cases.filter((c) => c && typeof c === "object" && c.id) : [], settings: j.settings && typeof j.settings === "object" ? j.settings : {} }; };
  const save = (j) => writeJson(file, j);
  const settingsOf = (j) => X.clampSettings(j.settings);
  const role = (req) => adminRoles.normalizeRole(req.adminRole);
  const actor = (req) => ({ id: String(req.adminId || ""), role: role(req) || "", name: String(req.adminName || "").slice(0, 60) });
  const audit = (req, action, extra) => appendAuditLog({ actorType: "admin", actorId: String(req.adminId || ""), role: role(req), action: "exception." + action, ...extra });

  /** Least privilege per case: system_admin sees all; others only their domain or what was escalated to them. */
  function visible(r, c) {
    if (r === adminRoles.FULL) return true;
    const resp = c.responsible && c.responsible.role;
    if (r === "accountant") return FINANCIAL.has(c.type) || resp === "accounting";
    if (r === "support") return c.type === "complaint_dispute" || resp === "support";
    if (r === "order_supervisor") return c.type !== "payment_error"; // money reconciliation stays with accounting
    return false;
  }

  const send = (res, r, extra) => (r.ok ? res.json({ ok: true, ...(extra || {}) }) : res.status(r.status || 400).json({ ok: false, error: r.error, code: r.code }));
  const find = (j, id) => j.cases.find((c) => c.id === String(id));
  const unique = (j) => { const ids = new Set(j.cases.map((c) => c.id)); for (let i = 0; i < 8; i++) { const id = X.newCaseId(); if (!ids.has(id)) return id; } return X.newCaseId(Math.random, () => now() + Math.floor(Math.random() * 1e6)); };

  /** Shared by manual create and scan: never two unresolved cases for the same (type, order). */
  function open(j, input, req) {
    const key = input.dedupeKey || (input.orderId ? input.type + ":" + input.orderId : "");
    const dup = X.findOpen(j.cases, key);
    if (dup) return { ok: true, duplicate: true, case: dup };
    if (input.orderId && j.cases.filter((c) => c.orderId === String(input.orderId) && c.status !== "resolved").length >= X.LIMITS.perOrder)
      return { ok: false, status: 429, error: "Too many open cases for this order", code: "TOO_MANY" };
    const r = X.createCase({ ...input, maxRedelivery: settingsOf(j).maxRedeliveryAttempts }, { id: unique(j), now: now(), actor: req ? actor(req) : null });
    if (!r.ok) return { ...r, status: 400 };
    j.cases.unshift(r.case);
    return { ok: true, case: r.case };
  }

  app.get("/api/admin/exceptions", requireAdmin, (req, res) => {
   try {
    const j = load(); const r = role(req);
    const mine = j.cases.filter((c) => visible(r, c));
    const page = Math.max(1, parseInt(req.query.page, 10) || 1), per = Math.min(100, Math.max(1, parseInt(req.query.per, 10) || 50));
    const list = X.filterCases(mine, req.query || {});
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, counts: X.counts(mine), total: list.length, page, per, cases: list.slice((page - 1) * per, page * per).map(X.summary), types: X.TYPES, outcomes: X.OUTCOMES, settings: settingsOf(j) });
   } catch (e) {
    if (logger) (logger.error || logger.warn).call(logger, "exceptions list failed", { message: String(e && e.stack ? e.stack : e) });
    res.status(500).json({ ok: false, error: "Could not load exception cases" });
   }
  });

  app.get("/api/admin/exceptions/settings", requireAdmin, (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, settings: settingsOf(load()), bounds: X.BOUNDS });
  });

  app.put("/api/admin/exceptions/settings", requireAdmin, (req, res) => {
    if (role(req) !== adminRoles.FULL) return res.status(403).json({ error: "Forbidden" });
    const v = X.validateSettingsPatch(req.body);
    if (!v.ok) return res.status(400).json({ ok: false, error: v.error, code: v.code });
    const j = load(); const before = settingsOf(j);
    j.settings = { ...before, ...v.value }; save(j);
    audit(req, "settings", { previous: before, next: j.settings, result: "ok" });
    res.json({ ok: true, settings: settingsOf(j) });
  });

  /** Detect from real order records, never duplicating; also ages stale cases. Used by the route and the background timer. */
  function scanNow(req) {
    const j = load(); const s = settingsOf(j);
    const found = X.detect(loadOrders().orders, { now: now(), settings: s });
    let created = 0;
    for (const f of found) { const r = open(j, f, null); if (r.ok && !r.duplicate) created++; }
    let aged = 0;
    for (const c of j.cases) if (X.ageCase(c, { now: now(), urgentAfterMin: s.urgentAfterMin })) aged++;
    if (created || aged) save(j);
    if (created && req) audit(req, "scan", { created, aged });
    else if (created) appendAuditLog({ actorType: "system", action: "exception.scan", created, aged });
    return { ok: true, scanned: found.length, created, aged };
  }

  app.post("/api/admin/exceptions/scan", requireAdmin, (req, res) => res.json(scanNow(req)));

  app.post("/api/admin/exceptions", requireAdmin, (req, res) => {
    const b = req.body || {};
    if (!X.TYPES.includes(b.type)) return res.status(400).json({ ok: false, error: "Invalid case type", code: "INVALID_TYPE" });
    const r = role(req);
    if (r !== adminRoles.FULL && !visible(r, { type: b.type, responsible: { role: "supervisor" } })) return res.status(403).json({ error: "Forbidden" });
    const order = b.orderId ? loadOrders().orders.find((o) => String(o.id) === String(b.orderId)) : null;
    if (b.orderId && !order) return res.status(404).json({ ok: false, error: "Order not found", code: "ORDER_NOT_FOUND" });
    const j = load();
    const o = open(j, { type: b.type, reason: b.reason, priority: b.priority, orderId: order ? String(order.id) : "", storeId: order ? order.storeId || order.restaurantId : "", driverId: order ? order.driverId : "", customerId: order ? order.customerId : "", source: "manual" }, req);
    if (!o.ok) return res.status(o.status || 400).json({ ok: false, error: o.error, code: o.code });
    if (!o.duplicate) { save(j); audit(req, "open", { caseId: o.case.id, orderId: o.case.orderId, type: o.case.type }); }
    res.status(o.duplicate ? 200 : 201).json({ ok: true, duplicate: !!o.duplicate, case: X.detail(o.case) });
  });

  app.get("/api/admin/exceptions/:id", requireAdmin, (req, res) => {
    const c = find(load(), req.params.id);
    if (!c || !visible(role(req), c)) return res.status(404).json({ error: "Not found" });
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, case: X.detail(c) });
  });

  /** Common wrapper: load -> authorise this case -> mutate -> persist only if it succeeded -> audit. */
  function act(name, fn, { perm = null } = {}) {
    app.post("/api/admin/exceptions/:id/" + name, requireAdmin, async (req, res) => {
      const j = load(); const c = find(j, req.params.id); const r = role(req);
      if (!c || !visible(r, c)) return res.status(404).json({ error: "Not found" });
      if (perm && !adminRoles.can(r, perm)) return res.status(403).json({ error: "Forbidden" });
      const before = { status: c.status, priority: c.priority, responsible: c.responsible && c.responsible.role };
      let out;
      try { out = await fn({ c, j, req, res, r }); } catch (e) {
        if (logger) logger.error("exception action failed", { action: name, message: String(e && e.message ? e.message : e) });
        return res.status(500).json({ ok: false, error: "Action failed" });
      }
      if (!out || res.headersSent) return;
      if (out.ok) { save(j); audit(req, name, { caseId: c.id, orderId: c.orderId, previous: before, next: { status: c.status, priority: c.priority, responsible: c.responsible && c.responsible.role }, result: "ok" }); }
      send(res, out, { case: X.detail(c), ...(out.extra || {}) });
    });
  }

  act("assign", ({ c, req }) => {
    const b = req.body || {};
    const to = b.to === "me" || !b.to ? { role: role(req), id: String(req.adminId || ""), name: String(req.adminName || "") } : { role: String(b.to), id: "", name: "" };
    if (b.to && b.to !== "me" && !["supervisor", "accounting", "support"].includes(to.role)) return { ok: false, status: 400, error: "Invalid assignee", code: "INVALID_ASSIGNEE" };
    return X.assign(c, to, { actor: actor(req), now: now() });
  });
  act("contact", ({ c, req }) => X.recordContact(c, req.body && req.body.party, req.body && req.body.note, { actor: actor(req), now: now() }));
  act("escalate", ({ c, req }) => X.escalate(c, req.body && req.body.to, req.body && req.body.reason, { actor: actor(req), now: now() }));
  act("priority", ({ c, req }) => X.setPriority(c, req.body && req.body.priority, { actor: actor(req), now: now() }));

  act("resolve", ({ c, req, r }) => {
    // money cases are closed only by someone who may touch finances
    if (SENSITIVE_CLOSE.has(c.type) && !adminRoles.can(r, "finance.write") && r !== adminRoles.FULL) return { ok: false, status: 403, error: "Closing a financial case needs finance permission", code: "FINANCE_PERMISSION" };
    return X.resolve(c, { outcome: req.body && req.body.outcome, note: req.body && req.body.note }, { actor: actor(req), now: now() });
  });

  /** Failed delivery: log the reason, apply the configured redelivery rule, escalate when attempts run out. */
  act("redeliver", ({ c, j, req }) => {
    if (c.type !== "failed_delivery") return { ok: false, status: 400, error: "Only failed-delivery cases support redelivery", code: "WRONG_TYPE" };
    const r = X.recordFailedAttempt(c, req.body && req.body.reason, { actor: actor(req), now: now(), maxAttempts: settingsOf(j).maxRedeliveryAttempts });
    if (!r.ok) return r;
    // keep the order record in step: the failure flag is cleared while a new attempt is allowed, so a re-scan does not reopen it
    const orders = loadOrders(); const o = orders.orders.find((x) => String(x.id) === c.orderId);
    if (o) {
      o.redeliveryAttempts = c.redelivery.attempts;
      o.lastDeliveryFailure = { at: new Date(now()).toISOString(), reason: c.reasons[c.reasons.length - 1] };
      if (r.decision === "redeliver") { delete o.deliveryFailedAt; delete o.failedDelivery; }
      saveOrders(orders);
    }
    return { ok: true, extra: { decision: r.decision } };
  });

  /** Release the current driver and restart dispatch. Only before pickup: after pickup the goods are with the driver. */
  act("reassign", async ({ c, j, req }) => {
    if (!dispatchService) return { ok: false, status: 501, error: "Dispatch service unavailable", code: "NO_DISPATCH" };
    if (!c.orderId) return { ok: false, status: 400, error: "Case has no order", code: "NO_ORDER" };
    const orders = loadOrders(); const o = orders.orders.find((x) => String(x.id) === c.orderId);
    if (!o) return { ok: false, status: 404, error: "Order not found", code: "ORDER_NOT_FOUND" };
    const st = String(o.status || "");
    if (!["accepted", "restaurant_ready"].includes(st)) {
      X.recordReassign(c, { fromDriverId: o.driverId, ok: false, error: "order_state_" + st, actor: actor(req), now: now() });
      save(j);
      return { ok: false, status: 409, error: "Only orders not yet picked up can be reassigned automatically (state: " + st + ")", code: "NOT_REASSIGNABLE" };
    }
    const from = o.driverId || "";
    if (from) { o.driverId = null; delete o.driverName; delete o.driverPhone; }
    o.status = "restaurant_ready";
    saveOrders(orders);
    dispatchService.resetOrder(c.orderId, "exception:" + c.id);
    const d = dispatchService.dispatchOrder(c.orderId, { actor: "exception" });
    // Honest result: the order is back in the pool even if no driver could be offered right now (pull mode / nobody eligible).
    const pooled = !!d.ok || ["no_candidates", "mode_pull"].includes(d.error);
    const rr = X.recordReassign(c, { fromDriverId: from, ok: pooled, error: pooled ? "" : d.error, actor: actor(req), now: now() });
    if (!rr.ok) return rr;
    return { ok: true, extra: { dispatch: { offered: !!d.ok, note: d.ok ? undefined : d.error } } };
  }, { perm: "dispatch.manage" });

  /**
   * Used by the complaints module: open (idempotent by dedupeKey) / close the linked case without an HTTP actor.
   * The caller is another server module, never a client, so no role check applies; every change is still audited.
   */
  function openCase(input) {
    const j = load();
    const o = open(j, { ...input, source: input.source || "system" }, null);
    if (o.ok && !o.duplicate) { save(j); appendAuditLog({ actorType: "system", action: "exception.open", caseId: o.case.id, orderId: o.case.orderId, type: o.case.type, source: o.case.source }); }
    return o;
  }
  function resolveCase(id, { outcome, note, actor } = {}) {
    const j = load(); const c = find(j, id);
    if (!c) return { ok: false, status: 404, error: "Not found" };
    if (c.status === "resolved") return { ok: true, duplicate: true };
    const r = X.resolve(c, { outcome: X.OUTCOMES.includes(outcome) ? outcome : "other", note: note || "complaint closed" }, { actor: { id: String((actor && actor.id) || ""), role: String((actor && actor.role) || "system"), name: String((actor && actor.name) || "") }, now: now() });
    if (r.ok) { save(j); appendAuditLog({ actorType: "system", action: "exception.resolve", caseId: c.id, orderId: c.orderId, via: "complaint" }); }
    return r;
  }

  return { scan: () => scanNow(null), openCase, resolveCase };
}

module.exports = { registerExceptionRoutes };

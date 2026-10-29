"use strict";
const rateLimit = require("express-rate-limit");

/** Registers dispatch routes. `deps.service` is a dispatch-service instance. */
function registerDispatchRoutes(app, { service, requireDriver, requireApprovedDriver, requireAdmin, appendAuditLog, updateConfig, settings = null, actorOf = null, canOf = null }) {
  const perDriver = (windowMs, max) => rateLimit({
    windowMs, max, standardHeaders: true, legacyHeaders: false,
    keyGenerator: (req) => "d:" + String(req.driverId || req.ip),
    message: { error: "Too many requests" },
  });
  const send = (res, r) => (r.ok ? res.json(r) : res.status(r.status || 400).json({ ok: false, ...r, status: undefined }));
  const sid = (v) => String(v == null ? "" : v).slice(0, 80);

  // Fixes the pre-existing missing route the driver app already calls.
  app.patch("/api/driver/status", requireDriver, requireApprovedDriver, perDriver(60_000, 30), (req, res) => {
    const b = req.body || {};
    const flag = b.isOnline !== undefined ? b.isOnline : b.online;
    const raw = String(b.status || (flag === true ? "online" : flag === false ? "offline" : ""));
    send(res, service.setStatus(req.driverId, raw));
  });

  app.post("/api/driver/location", requireDriver, requireApprovedDriver, perDriver(60_000, 40), (req, res) => {
    send(res, service.updateLocation(req.driverId, req.body || {}));
  });

  app.get("/api/driver/offers", requireDriver, requireApprovedDriver, perDriver(60_000, 90), (req, res) => {
    res.json({ ok: true, mode: service.settings().mode, offers: service.driverOffers(req.driverId) });
  });
  app.post("/api/driver/offers/:id/accept", requireDriver, requireApprovedDriver, perDriver(60_000, 30), (req, res) => {
    send(res, service.acceptOffer(req.driverId, sid(req.params.id)));
  });
  app.post("/api/driver/offers/:id/reject", requireDriver, requireApprovedDriver, perDriver(60_000, 30), (req, res) => {
    send(res, service.rejectOffer(req.driverId, sid(req.params.id)));
  });

  app.get("/api/admin/dispatch/state", requireAdmin, (_req, res) => res.json(service.adminState()));
  const who = (req) => (actorOf ? { actorType: "admin", actorId: actorOf(req).id, role: actorOf(req).role } : {});
  app.post("/api/admin/dispatch/settings", requireAdmin, (req, res) => {
    if (settings && actorOf && canOf) {
      // Single audited path (actor, previous/new value, result; fail-closed). Needs permission settings.dispatch.
      const out = settings.update("dispatch", req.body, actorOf(req), canOf(req));
      if (!out.ok) return res.status(out.status || 400).json({ ok: false, error: out.error, code: out.code });
      return res.json(service.adminState());
    }
    const r = service.settingsPatch(req.body);
    if (!r.ok) return send(res, r);
    updateConfig(r.patch);
    appendAuditLog && appendAuditLog({ action: "dispatch_settings", patch: r.patch });
    res.json(service.adminState());
  });
  app.post("/api/admin/dispatch/orders/:id/offer", requireAdmin, (req, res) => {
    const driverId = req.body && req.body.driverId ? sid(req.body.driverId) : undefined;
    const r = service.dispatchOrder(sid(req.params.id), { driverId, actor: "admin" });
    appendAuditLog && appendAuditLog({ ...who(req), action: "dispatch_offer", orderId: sid(req.params.id), driverId: driverId || null, ok: !!r.ok });
    send(res, r);
  });
  app.post("/api/admin/dispatch/orders/:id/reset", requireAdmin, (req, res) => {
    appendAuditLog && appendAuditLog({ ...who(req), action: "dispatch_reset", orderId: sid(req.params.id) });
    send(res, service.resetOrder(sid(req.params.id), "admin"));
  });

  const timer = setInterval(() => { try { service.tick(); } catch (_e) {} }, 5000);
  if (timer.unref) timer.unref();
}

module.exports = { registerDispatchRoutes };

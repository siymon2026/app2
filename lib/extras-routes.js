"use strict";
const rateLimit = require("express-rate-limit");
const fb = require("./driver-feedback");
const ratings = require("./ratings");

/** Customer live tracking, driver rating, driver "customer reviews" card. */
function registerExtrasRoutes(app, d) {
  const { requireCustomer, requireDriver, requireApprovedDriver, loadOrders, saveOrders, dispatchService, routeService } = d;
  const limit = (windowMs, max, prefix) => rateLimit({
    windowMs, max, standardHeaders: true, legacyHeaders: false, message: { error: "Too many requests" },
    keyGenerator: (req) => prefix + String(req.customerId || req.driverId || req.ip),
  });
  const mineOf = (req, order) => order && String(order.customerId || "") === String(req.customerId || "");

  app.get("/api/customer/orders/:id/track", requireCustomer, limit(60_000, 30, "trk:"), (req, res) => {
    const order = (loadOrders().orders || []).find((o) => String(o.id) === String(req.params.id));
    if (!order) return res.status(404).json({ error: "Not found" });
    if (!mineOf(req, order)) return res.status(403).json({ error: "Forbidden" });
    const fix = order.driverId && fb.TRACK_STATUSES.includes(String(order.status || "").toLowerCase())
      ? dispatchService.driverFix(order.driverId) : null;
    res.set("Cache-Control", "no-store");
    res.json(fb.trackPayload(order, fix, Date.now()));
  });

  app.post("/api/customer/orders/:id/rate-driver", requireCustomer, limit(60_000, 10, "rd:"), (req, res) => {
    const v = fb.validateDriverRating(req.body);
    if (!v.ok) return res.status(400).json({ error: v.error });
    const data = loadOrders();
    const order = (data.orders || []).find((o) => String(o.id) === String(req.params.id));
    if (!order) return res.status(404).json({ error: "Not found" });
    if (!mineOf(req, order)) return res.status(403).json({ error: "Forbidden" });
    const can = fb.canRateDriver(order, Date.now());
    if (!can.ok) return res.status(can.error === "already_rated" ? 409 : can.error === "window_expired" ? 410 : 409).json({ error: can.error });
    const now = new Date().toISOString();
    // the written comment stays private until a supervisor publishes it (spec 16); stars count at once
    order.driverRating = { ...v.value, driverId: String(order.driverId), createdAt: now, commentStatus: ratings.initialCommentStatus(v.value.comment), moderation: null };
    order.updatedAt = now;
    saveOrders(data);
    res.json({ ok: true, rating: { stars: v.value.stars } });
  });

  // The rating card was shown to the customer: remember it on the ORDER so it never pops up again on another
  // device/session (the "Rate driver" button stays available). Idempotent: the first call wins.
  app.post("/api/customer/orders/:id/rating-prompted", requireCustomer, limit(60_000, 30, "rp:"), (req, res) => {
    const data = loadOrders();
    const order = (data.orders || []).find((o) => String(o.id) === String(req.params.id));
    if (!order) return res.status(404).json({ error: "Not found" });
    if (!mineOf(req, order)) return res.status(403).json({ error: "Forbidden" });
    if (!order.ratingPromptedAt) { order.ratingPromptedAt = new Date().toISOString(); saveOrders(data); }
    res.json({ ok: true });
  });

  // Road route between two points (OSRM/ORS proxy). Public but validated, cached and rate-limited per IP.
  app.get("/api/route", rateLimit({ windowMs: 60_000, max: 40, standardHeaders: true, legacyHeaders: false, message: { error: "Too many requests" } }), async (req, res) => {
    const q = req.query || {};
    const a = { lat: Number(q.fromLat), lng: Number(q.fromLng) }, b = { lat: Number(q.toLat), lng: Number(q.toLng) };
    try {
      const r = await routeService.route(a, b);
      res.set("Cache-Control", "private, max-age=20");
      res.json({ ok: true, ...r });
    } catch (e) {
      res.status(e.status || 502).json({ ok: false, error: e.message === "route_unavailable" ? "route_unavailable" : e.message });
    }
  });

  app.get("/api/driver/ratings", requireDriver, requireApprovedDriver, limit(60_000, 30, "dr:"), (req, res) => {
    const orders = loadOrders().orders || [];
    const sum = fb.summarize(orders, req.driverId);
    res.json({ ok: true, count: sum.count, avg: sum.avg, dist: sum.dist, reviews: fb.reviewsFor(orders, req.driverId, 30) });
  });
}

module.exports = { registerExtrasRoutes };

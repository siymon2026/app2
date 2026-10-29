"use strict";
/**
 * Service-zone HTTP routes (spec section 18).
 *
 * Public (no sign-in; they only describe where we deliver):
 *   GET  /api/service-area                 active zones (geometry only) for the customer map / early feedback
 *   POST /api/service-area/check           {lat,lng,restaurantId?} -> {inside, reason, message{ar,fr,en}}
 * Supervisor:
 *   GET    /api/admin/service-zones        all zones + revision                 (zones.read)
 *   POST   /api/admin/service-zones/test   dry-run a point (+ optional store)   (zones.read)
 *   POST   /api/admin/service-zones        create                               (zones.manage)
 *   PUT    /api/admin/service-zones/:id    update (send `revision`)             (zones.manage)
 *   DELETE /api/admin/service-zones/:id    delete (send `revision`)             (zones.manage)
 *
 * The orders are protected by serviceZones.guard() in server.js; these routes only manage and describe the data.
 * Writes are synchronous read-modify-write (single process) plus an optimistic `revision`, so two supervisors
 * cannot silently overwrite each other. Removing or deactivating the LAST active zone would stop every order,
 * so it needs an explicit `confirmBlockAll:true`. Every change is audited with the previous and new values.
 */
const Z = require("./service-zones");

function registerServiceZoneRoutes(app, d) {
  const { requireAdmin, readJson, writeJson, file, appendAuditLog = () => {}, adminRoles, getStore = () => null, limiter = (req, res, next) => next(), now = () => new Date() } = d;

  const load = () => Z.normalizeDoc(readJson(file, null), now());
  const save = (doc) => writeJson(file, { version: Z.SCHEMA_VERSION || 1, revision: doc.revision, updatedAt: now().toISOString(), zones: doc.zones });
  const actorId = (req) => String(req.adminId || "");
  const brief = (z) => z && { id: z.id, name: z.name, city: z.city, active: z.active, maxRoadKm: z.maxRoadKm, vertices: z.polygon.length, areaKm2: z.areaKm2 };
  const audit = (req, action, z, before, after, extra) =>
    appendAuditLog({ actorType: "admin", actorId: actorId(req), role: adminRoles.normalizeRole(req.adminRole) || "", action: "service_zone." + action, targetType: "service_zone", targetId: z && z.id, before, after, ...(extra || {}) });
  const id = () => "zone_" + now().getTime().toString(36) + Math.random().toString(36).slice(2, 7);

  // ---------------- public
  app.get("/api/service-area", limiter, (_req, res) => {
    res.set("Cache-Control", "public, max-age=30");
    res.json({ ok: true, ...Z.publicView(load().zones) });
  });

  function checkBody(zones, b) {
    const store = b.restaurantId ? getStore(String(b.restaurantId)) : null;
    const ev = Z.evaluate({ zones, dropoff: { lat: Number(b.lat), lng: Number(b.lng) }, pickup: store ? { lat: Number(store.lat), lng: Number(store.lng) } : null });
    if (ev.ok) return { ok: true, inside: true, zone: { id: ev.zone.id, city: ev.zone.city, maxRoadKm: ev.zone.maxRoadKm } };
    if (ev.reason === "LOCATION_REQUIRED") return { ok: false, status: 400, ...Z.failureBody(ev) };
    return { ok: true, inside: false, reason: ev.reason, message: Z.explain(ev.reason, { cities: ev.cities }) };
  }

  app.post("/api/service-area/check", limiter, (req, res) => {
    const r = checkBody(load().zones, req.body || {});
    if (r.status) { const { status, ...body } = r; return res.status(status).json(body); }
    res.json(r);
  });

  // ---------------- supervisor
  app.get("/api/admin/service-zones", requireAdmin, (req, res) => {
    const doc = load();
    res.json({ ok: true, revision: doc.revision, persisted: doc.persisted, bounds: Z.BOUNDS, zones: doc.zones, center: Z.BERRECHID_CENTER });
  });

  app.post("/api/admin/service-zones/test", requireAdmin, (req, res) => {
    const b = req.body || {};
    const r = checkBody(load().zones, b);
    if (r.status) { const { status, ...body } = r; return res.status(status).json(body); }
    res.json(r);
  });

  /** Shared guard for write routes. Returns the doc or sends the error. */
  function writable(req, res) {
    const doc = load();
    const rev = req.body && req.body.revision !== undefined ? req.body.revision : req.query && req.query.revision;
    if (rev !== undefined && Number(rev) !== doc.revision) {
      res.status(409).json({ ok: false, error: "The zones were changed by someone else. Reload and try again.", code: "STALE_REVISION", revision: doc.revision });
      return null;
    }
    return doc;
  }
  const wouldBlockAll = (zones) => !zones.some((z) => z.active !== false);

  app.post("/api/admin/service-zones", requireAdmin, (req, res) => {
    const doc = writable(req, res); if (!doc) return;
    if (doc.zones.length >= Z.BOUNDS.maxZones) return res.status(409).json({ ok: false, error: `At most ${Z.BOUNDS.maxZones} zones`, code: "TOO_MANY_ZONES" });
    const r = Z.sanitizeZone(req.body, null, { id: id(), now: now(), actor: actorId(req) });
    if (!r.ok) return res.status(r.status).json({ ok: false, error: r.error, code: r.code });
    doc.zones.push(r.zone);
    doc.revision += 1;
    save(doc);
    audit(req, "create", r.zone, null, { ...brief(r.zone), polygon: r.zone.polygon });
    res.status(201).json({ ok: true, revision: doc.revision, zone: r.zone });
  });

  app.put("/api/admin/service-zones/:id", requireAdmin, (req, res) => {
    const doc = writable(req, res); if (!doc) return;
    const i = doc.zones.findIndex((z) => z.id === String(req.params.id));
    if (i < 0) return res.status(404).json({ ok: false, error: "Zone not found", code: "NOT_FOUND" });
    const prev = doc.zones[i];
    const r = Z.sanitizeZone(req.body, prev, { now: now(), actor: actorId(req) });
    if (!r.ok) return res.status(r.status).json({ ok: false, error: r.error, code: r.code });
    const next = doc.zones.map((z, k) => (k === i ? r.zone : z));
    if (wouldBlockAll(next) && req.body.confirmBlockAll !== true)
      return res.status(409).json({ ok: false, error: "This would leave no active zone and block every order. Confirm to proceed.", code: "LAST_ACTIVE_ZONE" });
    doc.zones = next;
    doc.revision += 1;
    save(doc);
    const polyChanged = JSON.stringify(prev.polygon) !== JSON.stringify(r.zone.polygon);
    audit(req, "update", r.zone, { ...brief(prev), ...(polyChanged ? { polygon: prev.polygon } : {}) }, { ...brief(r.zone), ...(polyChanged ? { polygon: r.zone.polygon } : {}) });
    res.json({ ok: true, revision: doc.revision, zone: r.zone });
  });

  app.delete("/api/admin/service-zones/:id", requireAdmin, (req, res) => {
    const doc = writable(req, res); if (!doc) return;
    const z = doc.zones.find((x) => x.id === String(req.params.id));
    if (!z) return res.status(404).json({ ok: false, error: "Zone not found", code: "NOT_FOUND" });
    const rest = doc.zones.filter((x) => x.id !== z.id);
    const confirm = (req.body && req.body.confirmBlockAll === true) || String(req.query.confirmBlockAll || "") === "1";
    if (wouldBlockAll(rest) && !confirm)
      return res.status(409).json({ ok: false, error: "This would leave no active zone and block every order. Confirm to proceed.", code: "LAST_ACTIVE_ZONE" });
    doc.zones = rest;
    doc.revision += 1;
    save(doc);
    audit(req, "delete", z, { ...brief(z), polygon: z.polygon }, null);
    res.json({ ok: true, revision: doc.revision });
  });
}

module.exports = { registerServiceZoneRoutes };

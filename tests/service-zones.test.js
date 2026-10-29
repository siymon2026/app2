"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const Z = require("../lib/service-zones");
const roles = require("../lib/admin-roles");
const { registerServiceZoneRoutes } = require("../lib/service-zone-routes");

const SQUARE = [[33.20, -7.65], [33.20, -7.55], [33.30, -7.55], [33.30, -7.65]]; // ~9 x 9 km
const INSIDE = { lat: 33.25, lng: -7.60 };
const OUTSIDE = { lat: 33.55, lng: -7.60 }; // ~33 km north
const zone = (over = {}) => ({ id: "z1", name: { ar: "برشيد", fr: "Berrechid", en: "Berrechid" }, city: "Berrechid", active: true, maxRoadKm: null, polygon: SQUARE, ...over });

/* ------------------------------------------------------------------ geometry */
test("pointInPolygon: inside, outside, boundary and bad input", () => {
  assert.equal(Z.pointInPolygon(INSIDE.lat, INSIDE.lng, SQUARE), true);
  assert.equal(Z.pointInPolygon(OUTSIDE.lat, OUTSIDE.lng, SQUARE), false);
  assert.equal(Z.pointInPolygon(33.20, -7.60, SQUARE), true, "a point on an edge counts as inside");
  assert.equal(Z.pointInPolygon(33.30, -7.65, SQUARE), true, "a vertex counts as inside");
  assert.equal(Z.pointInPolygon(NaN, -7.6, SQUARE), false);
  assert.equal(Z.pointInPolygon(0, 0, SQUARE), false);
  assert.equal(Z.pointInPolygon(33.25, -7.6, [[1, 1], [2, 2]]), false);
});

test("pointInPolygon handles a concave (L-shaped) polygon", () => {
  const L = [[0.1, 0.1], [0.1, 0.3], [0.2, 0.3], [0.2, 0.2], [0.3, 0.2], [0.3, 0.1]];
  assert.equal(Z.pointInPolygon(0.15, 0.25, L), true);
  assert.equal(Z.pointInPolygon(0.25, 0.15, L), true);
  assert.equal(Z.pointInPolygon(0.25, 0.25, L), false, "the notch is outside");
});

test("validatePolygon: accepts {lat,lng} points, closes the ring and drops duplicates", () => {
  const r = Z.validatePolygon([...SQUARE.map(([lat, lng]) => ({ lat, lng })), { lat: SQUARE[0][0], lng: SQUARE[0][1] }, { lat: SQUARE[0][0], lng: SQUARE[0][1] }]);
  assert.equal(r.ok, true);
  assert.equal(r.polygon.length, 4);
  assert.ok(r.areaKm2 > 50 && r.areaKm2 < 120, "about 9x11 km");
});

test("validatePolygon rejects bad shapes with a specific code", () => {
  const code = (p) => Z.validatePolygon(p).code;
  assert.equal(code("x"), "POLYGON_REQUIRED");
  assert.equal(code([[33, -7], [33.1, -7]]), "POLYGON_TOO_SMALL");
  assert.equal(code([[33, -7], [33.1, -7], [999, 1]]), "POLYGON_INVALID_POINT");
  assert.equal(code([[33, -7], [33.1, -7], ["a", 1]]), "POLYGON_INVALID_POINT");
  assert.equal(code([[33.20, -7.65], [33.30, -7.55], [33.30, -7.65], [33.20, -7.55]]), "POLYGON_SELF_INTERSECTS", "bow-tie");
  assert.equal(code([[33.2, -7.6], [33.2001, -7.6], [33.2, -7.6001]]), "POLYGON_AREA_TOO_SMALL");
  assert.equal(code([[10, 10], [10, 40], [40, 40], [40, 10]]), "POLYGON_AREA_TOO_LARGE");
  const many = Array.from({ length: 250 }, (_, i) => [33 + Math.sin(i) * 0.1, -7 + Math.cos(i) * 0.1]);
  assert.equal(code(many), "POLYGON_TOO_LARGE");
});

test("seeded Berrechid zone is valid, active, flagged as a placeholder and contains the centre", () => {
  const [z] = Z.defaultZones(new Date("2026-01-01T00:00:00Z"));
  assert.equal(z.city, "Berrechid");
  assert.equal(z.active, true);
  assert.equal(z.seeded, true);
  assert.equal(Z.validatePolygon(z.polygon).ok, true);
  assert.equal(Z.pointInPolygon(Z.BERRECHID_CENTER.lat, Z.BERRECHID_CENTER.lng, z.polygon), true);
  assert.equal(Z.pointInPolygon(33.55, -7.59, z.polygon), false, "Settat-direction point ~30 km away is outside");
});

test("normalizeDoc: missing/corrupt data falls back to the seeded zone; invalid stored zones are ignored", () => {
  assert.equal(Z.normalizeDoc(null).persisted, false);
  assert.equal(Z.normalizeDoc({ zones: "x" }).zones[0].id, "zone_berrechid");
  const d = Z.normalizeDoc({ revision: 3, zones: [zone(), { id: "bad", polygon: [[1, 1]] }, null] });
  assert.equal(d.persisted, true);
  assert.deepEqual(d.zones.map((z) => z.id), ["z1"]);
  assert.equal(d.revision, 3);
  assert.equal(Z.normalizeDoc({ zones: [] }).zones.length, 0, "an explicit empty list stays empty (fail-closed), it is not re-seeded");
});

/* ------------------------------------------------------------------ sanitize */
test("sanitizeZone: create requires name, city and polygon; strips markup; validates the road limit", () => {
  const base = { name: "برشيد <b>x</b>", city: " Berrechid ", polygon: SQUARE };
  const r = Z.sanitizeZone(base, null, { id: "zx", actor: "a1", now: new Date("2026-02-02T10:00:00Z") });
  assert.equal(r.ok, true);
  assert.equal(r.zone.id, "zx");
  assert.equal(r.zone.name.fr, "برشيد b x /b", "angle brackets are replaced, so no markup survives");
  assert.ok(!/[<>]/.test(JSON.stringify(r.zone.name)));
  assert.equal(r.zone.city, "Berrechid");
  assert.equal(r.zone.active, true);
  assert.equal(r.zone.maxRoadKm, null);
  assert.equal(r.zone.updatedBy, "a1");
  assert.equal(Z.sanitizeZone({ ...base, name: "" }, null, { id: "z" }).code, "NAME_REQUIRED");
  assert.equal(Z.sanitizeZone({ ...base, city: "" }, null, { id: "z" }).code, "CITY_REQUIRED");
  assert.equal(Z.sanitizeZone({ ...base, polygon: undefined }, null, { id: "z" }).code, "POLYGON_REQUIRED");
  for (const bad of [0, 0.5, 61, 1000, -3, "abc"])
    assert.equal(Z.sanitizeZone({ ...base, maxRoadKm: bad }, null, { id: "z" }).code, "MAX_ROAD_KM_OUT_OF_RANGE", String(bad));
  assert.equal(Z.sanitizeZone({ ...base, maxRoadKm: "7.5" }, null, { id: "z" }).zone.maxRoadKm, 7.5);
});

test("sanitizeZone: update keeps omitted fields, clears the limit with null, and takes ownership of a seeded zone", () => {
  const [seed] = Z.defaultZones();
  const r = Z.sanitizeZone({ maxRoadKm: 8 }, seed, { now: new Date("2026-03-03T00:00:00Z"), actor: "boss" });
  assert.equal(r.ok, true);
  assert.equal(r.zone.id, seed.id);
  assert.equal(r.zone.createdAt, seed.createdAt);
  assert.equal(r.zone.seeded, false);
  assert.deepEqual(r.zone.polygon, seed.polygon);
  assert.equal(r.zone.maxRoadKm, 8);
  assert.equal(Z.sanitizeZone({ maxRoadKm: null }, r.zone).zone.maxRoadKm, null);
  assert.equal(Z.sanitizeZone({ active: false }, r.zone).zone.active, false);
});

/* ------------------------------------------------------------------ evaluate */
test("evaluate: inside, outside, no zones, inactive zone, missing pin", () => {
  assert.equal(Z.evaluate({ zones: [zone()], dropoff: INSIDE }).ok, true);
  const out = Z.evaluate({ zones: [zone()], dropoff: OUTSIDE });
  assert.equal(out.ok, false);
  assert.equal(out.code, "OUT_OF_SERVICE_AREA");
  assert.equal(out.reason, "OUTSIDE_SERVICE_AREA");
  assert.deepEqual(out.cities, ["Berrechid"]);
  assert.equal(Z.evaluate({ zones: [], dropoff: INSIDE }).reason, "NO_ACTIVE_ZONES");
  assert.equal(Z.evaluate({ zones: [zone({ active: false })], dropoff: INSIDE }).reason, "NO_ACTIVE_ZONES");
  for (const bad of [{}, null, { lat: NaN, lng: 1 }, { lat: 0, lng: 0 }, { lat: 91, lng: 0 }, { lat: "x", lng: "y" }])
    assert.equal(Z.evaluate({ zones: [zone()], dropoff: bad }).code, "LOCATION_REQUIRED");
});

test("evaluate: the store must be in the same zone as the address (multi-city ready)", () => {
  const casa = zone({ id: "z2", city: "Casablanca", polygon: [[33.50, -7.70], [33.50, -7.50], [33.65, -7.50], [33.65, -7.70]] });
  const zones = [zone(), casa];
  const storeInBerrechid = { lat: 33.27, lng: -7.59 }, storeInCasa = { lat: 33.58, lng: -7.60 };
  const a = Z.evaluate({ zones, dropoff: INSIDE, pickup: storeInBerrechid });
  assert.equal(a.ok, true); assert.equal(a.zone.id, "z1");
  const b = Z.evaluate({ zones, dropoff: INSIDE, pickup: storeInCasa });
  assert.equal(b.ok, false); assert.equal(b.reason, "STORE_OUTSIDE_ZONE");
  const c = Z.evaluate({ zones, dropoff: { lat: 33.58, lng: -7.61 }, pickup: storeInCasa });
  assert.equal(c.ok, true); assert.equal(c.zone.id, "z2");
  const d = Z.evaluate({ zones, dropoff: INSIDE, pickup: { lat: 0, lng: 0 } });
  assert.equal(d.ok, true); assert.equal(d.storeUnlocated, true, "legacy store without coordinates: address check only");
});

test("evaluate: overlapping zones pick the one that also contains the store", () => {
  const big = zone({ id: "big", polygon: [[33.0, -7.9], [33.0, -7.3], [33.5, -7.3], [33.5, -7.9]] });
  const small = zone({ id: "small", city: "Annex", polygon: [[33.24, -7.62], [33.24, -7.58], [33.26, -7.58], [33.26, -7.62]] });
  const r = Z.evaluate({ zones: [small, big], dropoff: INSIDE, pickup: { lat: 33.1, lng: -7.7 } });
  assert.equal(r.ok, true); assert.equal(r.zone.id, "big");
});

/* ------------------------------------------------------------------ guard (road distance) */
const routeOf = (m) => ({ calls: 0, async route() { this.calls++; return { distance: m, duration: 600, provider: "test" }; } });
const STORE = { id: "s1", lat: 33.27, lng: -7.59 };
const FLAT = { mode: "flat", maxKm: 15 }, DIST = { mode: "distance", maxKm: 15, pricePerKm: 2, baseFee: 0 };

test("guard: outside the zone is refused WITHOUT calling the routing service", async () => {
  const rs = routeOf(1000);
  const g = await Z.guard({ zones: [zone()], settings: DIST, store: STORE, dropoff: OUTSIDE, routeService: rs });
  assert.equal(g.ok, false); assert.equal(g.status, 422); assert.equal(g.reason, "OUTSIDE_SERVICE_AREA");
  assert.equal(rs.calls, 0);
});

test("guard: flat mode without a zone limit needs no routing at all", async () => {
  const rs = routeOf(99999);
  const g = await Z.guard({ zones: [zone()], settings: FLAT, store: STORE, dropoff: INSIDE, routeService: rs });
  assert.equal(g.ok, true); assert.equal(rs.calls, 0);
  assert.equal(g.snapshot.zoneId, "z1"); assert.equal(g.snapshot.maxRoadKm, null);
});

test("guard: flat mode with a zone road limit measures the road and refuses when exceeded", async () => {
  const z = zone({ maxRoadKm: 5 });
  const ok = await Z.guard({ zones: [z], settings: FLAT, store: STORE, dropoff: INSIDE, routeService: routeOf(4200) });
  assert.equal(ok.ok, true); assert.equal(ok.snapshot.roadKm, 4.2); assert.equal(ok.snapshot.maxRoadKm, 5);
  const far = await Z.guard({ zones: [z], settings: FLAT, store: STORE, dropoff: INSIDE, routeService: routeOf(5600) });
  assert.equal(far.ok, false); assert.equal(far.code, "OUT_OF_RANGE"); assert.equal(far.reason, "ROAD_DISTANCE_EXCEEDED");
  assert.equal(far.km, 5.6); assert.equal(far.maxKm, 5);
  const edge = await Z.guard({ zones: [z], settings: FLAT, store: STORE, dropoff: INSIDE, routeService: routeOf(5000) });
  assert.equal(edge.ok, true, "exactly the limit is allowed");
});

test("guard: routing failure is explicit (503), never a made-up distance", async () => {
  const z = zone({ maxRoadKm: 5 });
  const boom = { async route() { throw new Error("route_unavailable"); } };
  const a = await Z.guard({ zones: [z], settings: FLAT, store: STORE, dropoff: INSIDE, routeService: boom });
  assert.equal(a.ok, false); assert.equal(a.status, 503); assert.equal(a.code, "ROUTING_UNAVAILABLE");
  const b = await Z.guard({ zones: [z], settings: FLAT, store: STORE, dropoff: INSIDE, routeService: null });
  assert.equal(b.status, 503);
  const c = await Z.guard({ zones: [z], settings: FLAT, store: STORE, dropoff: INSIDE, routeService: { async route() { return { distance: 0 }; } } });
  assert.equal(c.status, 503, "zero/NaN distance is a failure, not free delivery");
  const d = await Z.guard({ zones: [z], settings: FLAT, store: STORE, dropoff: INSIDE, routeService: { async route() { return {}; } } });
  assert.equal(d.status, 503);
  const e = await Z.guard({ zones: [z], settings: FLAT, store: { id: "s", lat: 0, lng: 0 }, dropoff: INSIDE, routeService: routeOf(1000) });
  assert.equal(e.code, "STORE_LOCATION_MISSING");
  const f = await Z.guard({ zones: [z], settings: FLAT, store: STORE, dropoff: INSIDE, routeService: { async route() { const x = new Error("too_far"); throw x; } } });
  assert.equal(f.code, "OUT_OF_RANGE");
});

test("guard: distance mode hands the zone's own limit to the pricing step instead of the global one", async () => {
  const rs = routeOf(1000);
  const withLimit = await Z.guard({ zones: [zone({ maxRoadKm: 6 })], settings: DIST, store: STORE, dropoff: INSIDE, routeService: rs });
  assert.equal(withLimit.settings.maxKm, 6);
  assert.equal(withLimit.settings.pricePerKm, 2);
  assert.equal(rs.calls, 0, "pricing measures the road itself; the guard does not duplicate the routing call");
  const noLimit = await Z.guard({ zones: [zone()], settings: DIST, store: STORE, dropoff: INSIDE, routeService: rs });
  assert.equal(noLimit.settings.maxKm, 15, "no zone limit -> the global limit stays");
});

test("zone road limit is enforced end to end with the real pricing quote in distance mode", async () => {
  const pricing = require("../lib/delivery-pricing");
  const g = await Z.guard({ zones: [zone({ maxRoadKm: 4 })], settings: DIST, store: STORE, dropoff: INSIDE, routeService: routeOf(4500) });
  assert.equal(g.ok, true);
  const q = await pricing.quote({ settings: g.settings, store: STORE, dropoff: INSIDE, routeService: routeOf(4500) });
  assert.equal(q.ok, false); assert.equal(q.code, "OUT_OF_RANGE");
  const q2 = await pricing.quote({ settings: g.settings, store: STORE, dropoff: INSIDE, routeService: routeOf(3500) });
  assert.equal(q2.ok, true); assert.equal(q2.fee, 7, "3.5 km x 2 MAD");
});

/* ------------------------------------------------------------------ messages */
test("every refusal reason has an explanation in Arabic, French and English; distance numbers are included", () => {
  for (const r of ["LOCATION_REQUIRED", "NO_ACTIVE_ZONES", "OUTSIDE_SERVICE_AREA", "STORE_OUTSIDE_ZONE", "ROAD_DISTANCE_EXCEEDED", "ROUTING_UNAVAILABLE", "STORE_LOCATION_MISSING"]) {
    const m = Z.explain(r, { cities: ["Berrechid"], km: 7.25, maxKm: 5 });
    for (const l of ["ar", "fr", "en"]) assert.ok(typeof m[l] === "string" && m[l].length > 10, r + "/" + l);
  }
  const m = Z.explain("ROAD_DISTANCE_EXCEEDED", { km: 7.25, maxKm: 5 });
  assert.ok(m.en.includes("7.25") && m.en.includes("5"));
  assert.ok(Z.explain("OUTSIDE_SERVICE_AREA", { cities: ["Berrechid"] }).fr.includes("Berrechid"));
  assert.equal(Z.explain("NOPE"), null);
});

test("failureBody keeps the codes the customer app already understands", () => {
  const b = Z.failureBody({ status: 422, code: "OUT_OF_SERVICE_AREA", reason: "OUTSIDE_SERVICE_AREA", cities: ["Berrechid"] });
  assert.equal(b.error, "OUT_OF_SERVICE_AREA"); assert.equal(b.code, "OUT_OF_SERVICE_AREA"); assert.equal(b.reason, "OUTSIDE_SERVICE_AREA");
  assert.ok(b.message.ar && b.message.fr && b.message.en);
  const r = Z.failureBody({ status: 422, code: "OUT_OF_RANGE", reason: "ROAD_DISTANCE_EXCEEDED", error: "Delivery address is too far", km: 8, maxKm: 5 });
  assert.equal(r.code, "OUT_OF_RANGE"); assert.equal(r.error, "Delivery address is too far"); assert.equal(r.km, 8);
  assert.equal(Z.failureBody({ code: "LOCATION_REQUIRED" }).error, "LOCATION_REQUIRED");
});

test("publicView exposes geometry only (no audit fields) and only active zones", () => {
  const v = Z.publicView([zone({ updatedBy: "secret-admin", note: "internal" }), zone({ id: "off", active: false })]);
  assert.equal(v.zones.length, 1);
  assert.ok(!JSON.stringify(v).includes("secret-admin") && !JSON.stringify(v).includes("internal"));
  assert.equal(v.enforce, true);
  assert.ok(v.center.lat > 33.2 && v.center.lat < 33.3);
  assert.equal(Z.publicView([]).zones.length, 0);
});

/* ------------------------------------------------------------------ separation from H3 */
test("service zones and H3 dispatch are independent: neither imports the other", () => {
  const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
  const zoneSrc = read("lib/service-zones.js") + read("lib/service-zone-routes.js");
  assert.ok(!/require\(["'](\.\/)?(hexgrid|h3-js|dispatch[-\w]*)["']\)/.test(zoneSrc), "zone code must not use H3 / dispatch");
  for (const f of ["lib/hexgrid.js", "lib/dispatch-core.js", "lib/dispatch-service.js", "lib/dispatch-routes.js"])
    assert.ok(!/service-zone/.test(read(f)), f + " must not depend on service zones");
});

/* ------------------------------------------------------------------ permissions */
test("permissions: supervisors may read zones, only system_admin may change them", () => {
  const ok = (role, m, p) => roles.authorize(role, m, p).ok;
  for (const r of ["system_admin", "order_supervisor", "driver_supervisor"]) {
    assert.equal(ok(r, "GET", "/api/admin/service-zones"), true, r);
    assert.equal(ok(r, "POST", "/api/admin/service-zones/test"), true, r);
  }
  for (const r of ["accountant", "support"]) assert.equal(ok(r, "GET", "/api/admin/service-zones"), false, r);
  for (const r of ["order_supervisor", "driver_supervisor", "accountant", "support"]) {
    assert.equal(ok(r, "POST", "/api/admin/service-zones"), false, r);
    assert.equal(ok(r, "PUT", "/api/admin/service-zones/z1"), false, r);
    assert.equal(ok(r, "DELETE", "/api/admin/service-zones/z1"), false, r);
  }
  assert.equal(ok("system_admin", "DELETE", "/api/admin/service-zones/z1"), true);
  assert.equal(ok("admin", "PUT", "/api/admin/service-zones/z1"), true, "legacy admin accounts keep full access");
  assert.ok(roles.EXPLICIT_ONLY.includes("zones.manage"));
});

/* ------------------------------------------------------------------ routes */
function makeApp() {
  const routes = [];
  const reg = (method) => (p, ...h) => routes.push({ method, path: p, h: h.flat() });
  const app = { get: reg("GET"), post: reg("POST"), put: reg("PUT"), delete: reg("DELETE") };
  async function call(method, url, { role = null, body = {}, query = {} } = {}) {
    for (const r of routes) {
      if (r.method !== method) continue;
      const rp = r.path.split("/"), up = url.split("/");
      if (rp.length !== up.length) continue;
      const params = {};
      if (!rp.every((seg, i) => (seg.startsWith(":") ? ((params[seg.slice(1)] = up[i]), true) : seg === up[i]))) continue;
      const req = { method, originalUrl: url, params, body, query, adminRole: role, adminId: role ? "adm-" + role : "", _role: role };
      return await new Promise((resolve) => {
        const res = { code: 200, headers: {}, set(k, v) { this.headers[k] = v; return this; }, status(c) { this.code = c; return this; }, json(o) { resolve({ status: this.code, body: o, headers: this.headers }); } };
        let i = 0;
        const next = () => { const fn = r.h[i++]; if (fn) fn(req, res, next); };
        next();
      });
    }
    throw new Error(`no route ${method} ${url}`);
  }
  return { app, call };
}

function setup({ stored = null } = {}) {
  const files = { zones: stored };
  const audit = [];
  const { app, call } = makeApp();
  // same contract as server.js requireAdmin: the role table decides
  const requireAdmin = (req, res, next) => {
    if (!req._role) return res.status(401).json({ error: "Unauthorized" });
    const az = roles.authorize(req._role, req.method, req.originalUrl);
    if (!az.ok) return res.status(az.status).json({ error: az.error });
    next();
  };
  let tick = 1_800_000_000_000;
  registerServiceZoneRoutes(app, {
    requireAdmin, adminRoles: roles, file: "zones",
    readJson: (f, fb) => (files[f] == null ? fb : JSON.parse(JSON.stringify(files[f]))),
    writeJson: (f, d) => { files[f] = JSON.parse(JSON.stringify(d)); },
    appendAuditLog: (e) => audit.push(e),
    getStore: (id) => (id === "s1" ? { id: "s1", lat: 33.27, lng: -7.59 } : id === "far" ? { id: "far", lat: 33.58, lng: -7.60 } : null),
    now: () => new Date(tick++),
  });
  return { call, files, audit };
}
const body = (over = {}) => ({ name: "Test", city: "Berrechid", polygon: SQUARE, ...over });

test("routes: public area + check work without sign-in and with the seeded zone", async () => {
  const { call } = setup();
  const a = await call("GET", "/api/service-area");
  assert.equal(a.status, 200); assert.equal(a.body.zones.length, 1); assert.equal(a.body.zones[0].city, "Berrechid");
  assert.ok(Array.isArray(a.body.polygon) && a.body.polygon.length >= 3);
  assert.ok(!("updatedBy" in a.body.zones[0]));
  const inside = await call("POST", "/api/service-area/check", { body: { lat: 33.2655, lng: -7.5875 } });
  assert.equal(inside.body.inside, true);
  const out = await call("POST", "/api/service-area/check", { body: { lat: 33.58, lng: -7.60 } });
  assert.equal(out.status, 200); assert.equal(out.body.inside, false); assert.equal(out.body.reason, "OUTSIDE_SERVICE_AREA");
  assert.ok(out.body.message.ar && out.body.message.fr && out.body.message.en);
  const bad = await call("POST", "/api/service-area/check", { body: { lat: "x", lng: null } });
  assert.equal(bad.status, 400); assert.equal(bad.body.error, "LOCATION_REQUIRED");
});

test("routes: check with a store id reports STORE_OUTSIDE_ZONE", async () => {
  const { call } = setup({ stored: { revision: 1, zones: [zone()] } });
  const r = await call("POST", "/api/service-area/check", { body: { ...INSIDE, restaurantId: "far" } });
  assert.equal(r.body.inside, false); assert.equal(r.body.reason, "STORE_OUTSIDE_ZONE");
  const ok = await call("POST", "/api/service-area/check", { body: { ...INSIDE, restaurantId: "s1" } });
  assert.equal(ok.body.inside, true);
  const unknownStore = await call("POST", "/api/service-area/check", { body: { ...INSIDE, restaurantId: "nope" } });
  assert.equal(unknownStore.body.inside, true, "unknown store id: address-only check");
});

test("routes: admin endpoints require sign-in and the right permission", async () => {
  const { call } = setup();
  assert.equal((await call("GET", "/api/admin/service-zones")).status, 401);
  assert.equal((await call("GET", "/api/admin/service-zones", { role: "accountant" })).status, 403);
  assert.equal((await call("GET", "/api/admin/service-zones", { role: "order_supervisor" })).status, 200);
  assert.equal((await call("POST", "/api/admin/service-zones", { role: "order_supervisor", body: body() })).status, 403);
  assert.equal((await call("PUT", "/api/admin/service-zones/zone_berrechid", { role: "driver_supervisor", body: { active: false } })).status, 403);
  assert.equal((await call("DELETE", "/api/admin/service-zones/zone_berrechid", { role: "support" })).status, 403);
});

test("routes: create / update / delete with audit trail, revision and persistence", async () => {
  const { call, files, audit } = setup();
  const list = await call("GET", "/api/admin/service-zones", { role: "system_admin" });
  assert.equal(list.body.persisted, false); assert.equal(list.body.revision, 0);

  const c = await call("POST", "/api/admin/service-zones", { role: "system_admin", body: body({ name: "Annex", city: "Berrechid East", maxRoadKm: 6, revision: 0 }) });
  assert.equal(c.status, 201); assert.equal(c.body.revision, 1);
  assert.equal(files.zones.zones.length, 2, "first write persists the seeded zone too");
  const id = c.body.zone.id;
  assert.equal(audit.at(-1).action, "service_zone.create"); assert.equal(audit.at(-1).targetId, id);
  assert.equal(audit.at(-1).actorId, "adm-system_admin");

  const u = await call("PUT", `/api/admin/service-zones/${id}`, { role: "system_admin", body: { maxRoadKm: 9, revision: 1 } });
  assert.equal(u.status, 200); assert.equal(u.body.revision, 2); assert.equal(u.body.zone.maxRoadKm, 9);
  assert.equal(audit.at(-1).before.maxRoadKm, 6); assert.equal(audit.at(-1).after.maxRoadKm, 9);
  assert.ok(!("polygon" in audit.at(-1).before), "polygon is logged only when it changed");

  const geo = await call("PUT", `/api/admin/service-zones/${id}`, { role: "system_admin", body: { polygon: [[33.1, -7.7], [33.1, -7.6], [33.15, -7.6], [33.15, -7.7]], revision: 2 } });
  assert.equal(geo.status, 200);
  assert.ok(audit.at(-1).before.polygon && audit.at(-1).after.polygon);

  const del = await call("DELETE", `/api/admin/service-zones/${id}`, { role: "system_admin", body: { revision: 3 } });
  assert.equal(del.status, 200); assert.equal(files.zones.zones.length, 1);
  assert.equal(audit.at(-1).action, "service_zone.delete");
  assert.equal(audit.at(-1).after, null);
});

test("routes: stale revision is refused (two supervisors cannot overwrite each other)", async () => {
  const { call } = setup({ stored: { revision: 5, zones: [zone(), zone({ id: "z2", city: "Other" })] } });
  const r = await call("PUT", "/api/admin/service-zones/z2", { role: "system_admin", body: { active: false, revision: 4 } });
  assert.equal(r.status, 409); assert.equal(r.body.code, "STALE_REVISION"); assert.equal(r.body.revision, 5);
  const d = await call("DELETE", "/api/admin/service-zones/z2", { role: "system_admin", query: { revision: "4" } });
  assert.equal(d.status, 409);
  const ok = await call("DELETE", "/api/admin/service-zones/z2", { role: "system_admin", query: { revision: "5" } });
  assert.equal(ok.status, 200);
});

test("routes: removing or deactivating the LAST active zone needs explicit confirmation", async () => {
  const { call, files } = setup({ stored: { revision: 1, zones: [zone()] } });
  const off = await call("PUT", "/api/admin/service-zones/z1", { role: "system_admin", body: { active: false, revision: 1 } });
  assert.equal(off.status, 409); assert.equal(off.body.code, "LAST_ACTIVE_ZONE");
  assert.equal(files.zones.zones[0].active, true, "nothing was written");
  const del = await call("DELETE", "/api/admin/service-zones/z1", { role: "system_admin", body: { revision: 1 } });
  assert.equal(del.status, 409);
  const forced = await call("PUT", "/api/admin/service-zones/z1", { role: "system_admin", body: { active: false, revision: 1, confirmBlockAll: true } });
  assert.equal(forced.status, 200);
  // and with it off, an address is refused with NO_ACTIVE_ZONES
  const chk = await call("POST", "/api/service-area/check", { body: INSIDE });
  assert.equal(chk.body.reason, "NO_ACTIVE_ZONES");
});

test("routes: invalid input is rejected with 400 and a code; unknown zone is 404; the zone count is capped", async () => {
  const { call } = setup({ stored: { revision: 1, zones: [zone()] } });
  const bad = await call("POST", "/api/admin/service-zones", { role: "system_admin", body: body({ polygon: [[1, 1], [2, 2]] }) });
  assert.equal(bad.status, 400); assert.equal(bad.body.code, "POLYGON_TOO_SMALL");
  assert.equal((await call("POST", "/api/admin/service-zones", { role: "system_admin", body: body({ maxRoadKm: 500 }) })).body.code, "MAX_ROAD_KM_OUT_OF_RANGE");
  assert.equal((await call("PUT", "/api/admin/service-zones/nope", { role: "system_admin", body: { active: true } })).status, 404);
  assert.equal((await call("DELETE", "/api/admin/service-zones/nope", { role: "system_admin" })).status, 404);
  const many = { revision: 1, zones: Array.from({ length: 50 }, (_, i) => zone({ id: "z" + i })) };
  const full = setup({ stored: many });
  const r = await full.call("POST", "/api/admin/service-zones", { role: "system_admin", body: body() });
  assert.equal(r.status, 409); assert.equal(r.body.code, "TOO_MANY_ZONES");
});

test("routes: dry-run test endpoint answers for a supervisor without changing anything", async () => {
  const { call, files } = setup({ stored: { revision: 2, zones: [zone()] } });
  const r = await call("POST", "/api/admin/service-zones/test", { role: "order_supervisor", body: { ...OUTSIDE } });
  assert.equal(r.body.inside, false);
  assert.equal(files.zones.revision, 2);
});

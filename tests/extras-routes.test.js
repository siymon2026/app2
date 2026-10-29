"use strict";
const test = require("node:test");
const assert = require("node:assert");
const Module = require("node:module");
// express-rate-limit isn't needed to test route logic: stub it as a pass-through.
const origLoad = Module._load;
Module._load = function (req, ...r) { return req === "express-rate-limit" ? () => (_q, _s, n) => n() : origLoad.call(this, req, ...r); };
const { registerExtrasRoutes } = require("../lib/extras-routes");
Module._load = origLoad;

function setup(orders, fix) {
  const routes = {};
  const app = { get: (p, ...h) => (routes["GET " + p] = h), post: (p, ...h) => (routes["POST " + p] = h) };
  const data = { orders };
  let saved = 0;
  registerExtrasRoutes(app, {
    requireCustomer: "c", requireDriver: "d", requireApprovedDriver: "a",
    loadOrders: () => data, saveOrders: () => { saved++; },
    dispatchService: { driverFix: (id) => (id === "D1" ? fix : null) },
  });
  const call = (key, req) => {
    const h = routes[key]; const fn = h[h.length - 1];
    const res = { code: 200, body: null, headers: {}, set(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
    fn({ params: {}, body: {}, ...req }, res); return res;
  };
  return { call, data, saved: () => saved };
}
const NOW = Date.now();
const mk = (o = {}) => ({ id: "O1", customerId: "C1", driverId: "D1", status: "on_the_way", customer: { lat: 33.27, lng: -7.58 }, ...o });

test("track: owner only, only while on_the_way, no driver id leaked", () => {
  const t = setup([mk()], { lat: 33.26, lng: -7.58, at: NOW - 4000 });
  assert.equal(t.call("GET /api/customer/orders/:id/track", { customerId: "C2", params: { id: "O1" } }).code, 403);
  assert.equal(t.call("GET /api/customer/orders/:id/track", { customerId: "C1", params: { id: "NOPE" } }).code, 404);
  const ok = t.call("GET /api/customer/orders/:id/track", { customerId: "C1", params: { id: "O1" } });
  assert.equal(ok.body.tracking, true); assert.ok(ok.body.distanceM > 0); assert.equal(ok.headers["Cache-Control"], "no-store");
  assert.ok(!JSON.stringify(ok.body).includes("D1"));
  const t2 = setup([mk({ status: "accepted" })], { lat: 33.26, lng: -7.58, at: NOW });
  assert.equal(t2.call("GET /api/customer/orders/:id/track", { customerId: "C1", params: { id: "O1" } }).body.tracking, false);
  const t3 = setup([mk({ status: "delivered" })], { lat: 33.26, lng: -7.58, at: NOW });
  assert.equal(t3.call("GET /api/customer/orders/:id/track", { customerId: "C1", params: { id: "O1" } }).body.driver, undefined);
});

test("rate-driver: validation, ownership, once only, 7-day window", () => {
  const body = { stars: 4, polite: true, askedExtraMoney: false, comment: "ok" };
  const del = (o = {}) => mk({ status: "delivered", deliveredAt: new Date(NOW - 3600e3).toISOString(), ...o });
  const t = setup([del()]);
  const R = "POST /api/customer/orders/:id/rate-driver";
  assert.equal(t.call(R, { customerId: "C1", params: { id: "O1" }, body: { stars: 9, polite: true, askedExtraMoney: false } }).code, 400);
  assert.equal(t.call(R, { customerId: "C2", params: { id: "O1" }, body }).code, 403);
  assert.equal(t.call(R, { customerId: "C1", params: { id: "O1" }, body }).body.ok, true);
  assert.equal(t.data.orders[0].driverRating.driverId, "D1"); assert.equal(t.saved(), 1);
  const again = t.call(R, { customerId: "C1", params: { id: "O1" }, body });
  assert.equal(again.code, 409); assert.equal(again.body.error, "already_rated"); assert.equal(t.saved(), 1);
  const old = setup([del({ deliveredAt: new Date(NOW - 8 * 86400e3).toISOString() })]);
  assert.equal(old.call(R, { customerId: "C1", params: { id: "O1" }, body }).code, 410);
  const notDel = setup([mk()]);
  assert.equal(notDel.call(R, { customerId: "C1", params: { id: "O1" }, body }).code, 409);
});

test("driver ratings card exposes stars/comments only", () => {
  const orders = [mk({ status: "delivered", customer: { name: "SecretName" }, driverRating: { stars: 5, polite: false, askedExtraMoney: true, comment: "great", createdAt: "2026-10-20" } })];
  const t = setup(orders);
  const r = t.call("GET /api/driver/ratings", { driverId: "D1" });
  assert.equal(r.body.count, 1); assert.equal(r.body.avg, 5);
  const j = JSON.stringify(r.body);
  assert.ok(!j.includes("SecretName") && !j.includes("polite") && !j.includes("askedExtraMoney"));
});

test("GET /api/route: validates, proxies, and maps provider failure to 502", async () => {
  const routes = {};
  const app = { get: (p, ...h) => (routes["GET " + p] = h), post: () => {} };
  let fail = false;
  registerExtrasRoutes(app, {
    requireCustomer: "c", requireDriver: "d", requireApprovedDriver: "a", loadOrders: () => ({ orders: [] }), saveOrders() {}, dispatchService: {},
    routeService: { route: async (a, b) => { if (!Number.isFinite(a.lat)) { const e = new Error("invalid_coordinates"); e.status = 400; throw e; } if (fail) { const e = new Error("route_unavailable"); e.status = 502; throw e; } return { coords: [[a.lat, a.lng], [b.lat, b.lng]], distance: 10, duration: 5, provider: "osrm" }; } },
  });
  const h = routes["GET /api/route"]; const fn = h[h.length - 1];
  const run = async (query) => { const res = { code: 200, set() {}, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } }; await fn({ query }, res); return res; };
  const ok = await run({ fromLat: "33.26", fromLng: "-7.58", toLat: "33.27", toLng: "-7.57" });
  assert.equal(ok.code, 200); assert.equal(ok.body.provider, "osrm");
  assert.equal((await run({ fromLat: "abc", fromLng: "1", toLat: "2", toLng: "3" })).code, 400);
  fail = true;
  const bad = await run({ fromLat: "33.26", fromLng: "-7.58", toLat: "33.27", toLng: "-7.57" });
  assert.equal(bad.code, 502); assert.equal(bad.body.error, "route_unavailable");
});

test("rating-prompted: owner only, idempotent (first call wins, saved once), unknown order 404", () => {
  const t = setup([mk({ status: "delivered" })], null);
  const P = "POST /api/customer/orders/:id/rating-prompted";
  assert.equal(t.call(P, { customerId: "C2", params: { id: "O1" } }).code, 403);
  assert.equal(t.call(P, { customerId: "C1", params: { id: "NOPE" } }).code, 404);
  assert.equal(t.saved(), 0);
  assert.equal(t.call(P, { customerId: "C1", params: { id: "O1" } }).body.ok, true);
  const first = t.data.orders[0].ratingPromptedAt;
  assert.ok(first);
  t.call(P, { customerId: "C1", params: { id: "O1" } });
  assert.equal(t.data.orders[0].ratingPromptedAt, first, "second call does not overwrite");
  assert.equal(t.saved(), 1, "persisted only once");
});

"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { createRouteService, decimate } = require("../lib/route-service");
const A = { lat: 33.2655, lng: -7.5875 }, B = { lat: 33.27, lng: -7.58 };
const okFetch = (calls) => async (url) => { calls.push(url); return { ok: true, json: async () => ({ routes: [{ geometry: { coordinates: [[-7.5875, 33.2655], [-7.585, 33.267], [-7.58, 33.27]] }, distance: 900.4, duration: 130.2 }] }) }; };

test("osrm route: swaps to [lat,lng], rounds, caches", async () => {
  const calls = []; let t = 0;
  const s = createRouteService({ fetchImpl: okFetch(calls), now: () => t });
  const r = await s.route(A, B);
  assert.deepEqual(r.coords[0], [33.2655, -7.5875]); assert.equal(r.distance, 900); assert.equal(r.provider, "osrm");
  assert.ok(calls[0].includes("-7.5875,33.2655;-7.58,33.27"));
  await s.route(A, B); assert.equal(calls.length, 1); // cached
  t = 61_000; await s.route(A, B); assert.equal(calls.length, 2); // ttl expired
});

test("validation: bad coords and too-far are rejected before any request", async () => {
  const calls = []; const s = createRouteService({ fetchImpl: okFetch(calls) });
  await assert.rejects(() => s.route({ lat: 0, lng: 0 }, B), (e) => e.status === 400);
  await assert.rejects(() => s.route(A, { lat: 36.7, lng: 3.0 }), (e) => e.message === "too_far");
  assert.equal(calls.length, 0);
});

test("provider failure -> 502 so the client falls back to a straight line", async () => {
  const s = createRouteService({ fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({}) }) });
  await assert.rejects(() => s.route(A, B), (e) => e.status === 502);
});

test("ORS is tried first when a key exists, OSRM is the fallback", async () => {
  const urls = [];
  const s = createRouteService({ orsKey: "k", fetchImpl: async (u) => { urls.push(u); if (u.includes("openrouteservice")) throw new Error("down"); return okFetch([])(u); } });
  const r = await s.route(A, B);
  assert.equal(r.provider, "osrm"); assert.ok(urls[0].includes("openrouteservice"));
});

test("decimate keeps endpoints and caps size", () => {
  const pts = Array.from({ length: 1000 }, (_, i) => [i, i]);
  const d = decimate(pts, 300);
  assert.equal(d.length, 300); assert.deepEqual(d[0], [0, 0]); assert.deepEqual(d[299], [999, 999]);
});

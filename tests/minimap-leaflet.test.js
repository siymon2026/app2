"use strict";
const test = require("node:test");
const assert = require("node:assert");
const vm = require("node:vm");
const fs = require("node:fs");

// Minimal fakes so createLeaflet()/draw()/route logic runs without a browser.
function makeEnv(routeOk) {
  const log = { markers: 0, polylines: [], fits: 0, fetches: [] };
  const routeFetches = () => log.fetches.filter((u) => u.startsWith("/api/route"));
  log.routeFetches = routeFetches;
  const el = () => ({ style: {}, classList: { add() {} }, appendChild() {}, append() {}, setAttribute() {}, set textContent(v) {}, set className(v) {}, set innerHTML(v) {}, clientWidth: 300 });
  const layer = () => ({ addTo() { return this; }, on() { return this; }, bindTooltip() { return this; }, clearLayers() {}, removeLayer() {}, setLatLngs(p) { this.pts = p; } });
  const L = {
    Browser: { mobile: true },
    map: () => ({ setView() { return this; }, getBounds: () => ({ pad: () => ({ contains: () => false }) }), fitBounds() { log.fits++; }, invalidateSize() {} }),
    layerGroup: layer, tileLayer: layer, divIcon: (o) => o, latLngBounds: (p) => p,
    marker: () => { log.markers++; return layer(); },
    polyline: (pts) => { const l = layer(); l.pts = pts; log.polylines.push(l); return l; },
    polygon: () => layer(),
  };
  const ctx = { L, console, setTimeout: () => {}, Date, Promise, Math, Number, Map, Set,
    addEventListener() {}, ResizeObserver: undefined,
    document: { getElementById: () => null, head: { appendChild() {} }, createElement: el, createElementNS: el, documentElement: { getAttribute: () => null } },
    fetch: async (u) => { log.fetches.push(u); return routeOk ? { ok: true, json: async () => ({ ok: true, coords: [[33.2655, -7.5875], [33.268, -7.584], [33.27, -7.58]], distance: 800, duration: 120 }) } : { ok: false, json: async () => ({}) }; } };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(__dirname + "/../public/shared/minimap.js", "utf8"), ctx);
  return { ctx, log };
}
const items = (extra) => [{ kind: "route", key: "r", from: { lat: 33.2655, lng: -7.5875 }, to: { lat: 33.27, lng: -7.58 }, color: "#3fae1c", ...extra },
  { kind: "pin", lat: 33.27, lng: -7.58 }, { kind: "dot", lat: 33.2655, lng: -7.5875, inner: true }];

test("leaflet engine: draws markers, fits once, replaces straight line with road route", async () => {
  const { ctx, log } = makeEnv(true); const infos = [];
  const m = ctx.SiyMap.create({ textContent: "", appendChild() {} }, { height: 200 });
  assert.equal(m.engine, "leaflet");
  m.draw(items({ onInfo: (i) => infos.push(i) }));
  assert.equal(log.markers, 2); assert.equal(log.fits, 1);
  assert.equal(infos[0].fallback, true); // straight line shown immediately
  await new Promise((r) => setImmediate(r)); await new Promise((r) => setImmediate(r));
  assert.equal(log.routeFetches().length, 1); assert.ok(log.routeFetches()[0].startsWith("/api/route?fromLat=33.2655"));
  assert.equal(infos[infos.length - 1].fallback, false); assert.equal(infos[infos.length - 1].distance, 800);
  assert.equal(log.polylines[0].pts.length, 3); // casing now follows the road geometry
  m.draw(items({ onInfo: () => {} })); // redraw: no extra route request within 15 s
  await new Promise((r) => setImmediate(r)); assert.equal(log.routeFetches().length, 1);
});

test("leaflet engine: route service down -> straight line stays, fallback reported", async () => {
  const { ctx } = makeEnv(false); const infos = [];
  const m = ctx.SiyMap.create({ textContent: "", appendChild() {} }, { height: 200 });
  m.draw(items({ onInfo: (i) => infos.push(i) }));
  await new Promise((r) => setImmediate(r)); await new Promise((r) => setImmediate(r));
  assert.ok(infos.every((i) => i.fallback === true));
});

test("without Leaflet the basic tile renderer is used", () => {
  const { ctx } = makeEnv(true); ctx.L = undefined; ctx.window.L = undefined;
  const m = ctx.SiyMap.create({ textContent: "", appendChild() {} }, { height: 200 });
  assert.notEqual(m.engine, "leaflet");
});

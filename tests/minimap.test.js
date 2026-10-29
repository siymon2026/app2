"use strict";
const test = require("node:test");
const assert = require("node:assert");
const vm = require("node:vm");
const fs = require("node:fs");
// Load the browser module with minimal DOM stubs; test only its pure math.
const stubEl = () => ({ style: {}, classList: { add() {} }, appendChild() {}, append() {}, setAttribute() {} });
const ctx = { window: {}, document: { getElementById: () => ({}), head: { appendChild() {} }, createElement: stubEl, createElementNS: stubEl, documentElement: { getAttribute: () => null } }, fetch: () => Promise.resolve({ ok: false }), console };
ctx.addEventListener = () => {}; ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname + "/../public/shared/minimap.js", "utf8"), ctx);
const M = ctx.SiyMap._math;

test("mercator: known tile for Berrechid-like coords at z=15", () => {
  const x = Math.floor(M.lngX(-7.5817, 15) / 256), y = Math.floor(M.latY(33.2656, 15) / 256);
  assert.equal(x, Math.floor(((-7.5817 + 180) / 360) * 32768));
  assert.ok(x > 15000 && x < 16500 && y > 12000 && y < 13500);
});

test("fit: identical points use street zoom; far points zoom out; always fits viewport", () => {
  const same = M.boundsOf([[33.2656, -7.5817], [33.2656, -7.5817]]);
  assert.ok(M.fitZoom(same, 320, 220, 34, 17) >= 16);
  const far = M.boundsOf([[33.2, -7.6], [33.5, -7.3]]);
  const z = M.fitZoom(far, 320, 220, 34, 17);
  assert.ok(z < 12 && z >= 3);
  const w = M.lngX(far.maxLng, z) - M.lngX(far.minLng, z), h = M.latY(far.minLat, z) - M.latY(far.maxLat, z);
  assert.ok(w <= 320 - 68 && h <= 220 - 68);
});

test("tiles cover the whole viewport and stay in range", () => {
  const b = M.boundsOf([[33.26, -7.58], [33.27, -7.57]]);
  const v = M.viewFor(b, 320, 220, 34, 17), t = M.tilesFor(v, 320, 220), n = 2 ** v.z;
  assert.ok(t.length >= 1 && t.length <= 12);
  t.forEach((q) => { assert.ok(q.x >= 0 && q.x < n && q.y >= 0 && q.y < n); });
  assert.ok(Math.min(...t.map((q) => q.left)) <= 0 && Math.max(...t.map((q) => q.left)) + 256 >= 320);
  assert.ok(Math.min(...t.map((q) => q.top)) <= 0 && Math.max(...t.map((q) => q.top)) + 256 >= 220);
});

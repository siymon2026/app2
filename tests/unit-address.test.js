"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const A = require("../lib/addresses");
const G = require("../lib/geocode");

test("sanitizeAddress rejects empty/invalid, strips markup, keeps coords pair only", () => {
  assert.equal(A.sanitizeAddress({}), null);
  assert.equal(A.sanitizeAddress({ hood: " ", street: "x" }), null);
  assert.equal(A.sanitizeAddress("nope"), null);
  const a = A.sanitizeAddress({ hood: "<b>السلام</b>", street: "شارع 1", lat: "33.27", lng: "abc" });
  assert.equal(a.hood.includes("<"), false);
  assert.equal(a.lat, null); assert.equal(a.lng, null);
  const b = A.sanitizeAddress({ hood: "السلام", lat: 33.2712345678, lng: -7.58 });
  assert.equal(b.lat, 33.271235);
  assert.equal(A.sanitizeAddress({ hood: "ab", lat: 999, lng: 1 }).lat, null);
});
test("sanitizeList caps at 10, dedupes ids, forces exactly one default", () => {
  const many = Array.from({ length: 15 }, (_, i) => ({ id: "a" + i, hood: "حي " + i, isDefault: true }));
  const l = A.sanitizeList(many);
  assert.equal(l.length, 10);
  assert.equal(l.filter((x) => x.isDefault).length, 1);
  assert.equal(A.sanitizeList([{ id: "x", hood: "aa" }, { id: "x", hood: "bb" }]).length, 1);
  assert.equal(A.sanitizeList(null).length, 0);
  assert.equal(A.sanitizeList([{ id: "x", hood: "aa" }])[0].isDefault, true);
});
test("mergeLists: no loss, no duplicates, local default wins, newest wins", () => {
  const remote = [{ id: "r1", hood: "السلام", street: "ش1", updatedAt: 100, isDefault: true }, { id: "r2", hood: "النصر", updatedAt: 50 }];
  const local = [{ id: "l1", hood: "الوفاء", updatedAt: 300, isDefault: true }, { id: "r1", hood: "السلام", street: "ش1", updatedAt: 100 }];
  const m = A.mergeLists(local, remote);
  assert.equal(m.length, 3);
  assert.equal(new Set(m.map((x) => x.id)).size, 3);
  assert.equal(m.find((x) => x.isDefault).id, "l1");
  assert.equal(m.filter((x) => x.isDefault).length, 1);
  // same content under different ids is not duplicated
  const dup = A.mergeLists([{ id: "z", hood: "السلام", street: "ش1", updatedAt: 1 }], [{ id: "q", hood: "السلام", street: "ش1", updatedAt: 2 }]);
  assert.equal(dup.length, 1);
  // newer edit wins
  const nw = A.mergeLists([{ id: "r1", hood: "جديد", updatedAt: 999 }], [{ id: "r1", hood: "قديم", updatedAt: 1 }]);
  assert.equal(nw[0].hood, "جديد");
  assert.equal(A.mergeLists([], []).length, 0);
});
test("geocode: parseNominatim maps fields", () => {
  const p = G.parseNominatim({ display_name: "d", address: { suburb: "حي السلام", road: "شارع X", house_number: "5", town: "برشيد" } });
  assert.deepEqual([p.hood, p.street, p.bldg, p.city], ["حي السلام", "شارع X", "5", "برشيد"]);
  assert.equal(G.parseNominatim(null).hood, "");
});
test("geocode: validCoords", () => {
  assert.equal(G.validCoords(33.27, -7.58), true);
  for (const [a, b] of [[0, 0], [91, 0], [1, 181], ["x", 1], [null, null]]) assert.equal(G.validCoords(a, b), false);
});
test("geocode: success, provider error, no result, timeout/exception, bad coords", async () => {
  const ok = await G.reverseGeocode({ lat: 33.27, lng: -7.58, fetchImpl: async (u) => { assert.ok(u.includes("lat=33.27")); return { ok: true, json: async () => ({ address: { road: "R", suburb: "S" } }) }; } });
  assert.equal(ok.ok, true); assert.equal(ok.street, "R");
  assert.equal((await G.reverseGeocode({ lat: 33, lng: -7, fetchImpl: async () => ({ ok: false }) })).status, 502);
  assert.equal((await G.reverseGeocode({ lat: 33, lng: -7, fetchImpl: async () => ({ ok: true, json: async () => ({ error: "x" }) }) })).status, 404);
  assert.equal((await G.reverseGeocode({ lat: 33, lng: -7, fetchImpl: async () => { throw new Error("net"); } })).status, 502);
  assert.equal((await G.reverseGeocode({ lat: 999, lng: 1, fetchImpl: async () => ({}) })).status, 400);
});
test("geocode cache returns stored value and is bounded", () => {
  const c = G.makeCache(2);
  c.set(1, 2, "ar", { a: 1 }); assert.deepEqual(c.get(1.00001, 2.00001, "ar"), { a: 1 });
  c.set(3, 4, "ar", 1); c.set(5, 6, "ar", 1); assert.equal(c.get(1, 2, "ar"), null);
});

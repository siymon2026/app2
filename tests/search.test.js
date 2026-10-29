"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { norm, within1, search } = require("../lib/search");

const stores = [
  { id: "p1", name: { ar: "صيدلية النور", fr: "Pharmacie Nour", en: "Nour" }, type: "pharmacy", status: "active" },
  { id: "g1", name: { ar: "بقالة الأمل", fr: "Épicerie Espoir", en: "Hope" }, type: "grocery", status: "active" },
  { id: "x1", name: { ar: "مخفي", fr: "Cache", en: "Hidden" }, type: "grocery", status: "unpublished" },
];
const items = [
  { id: "m1", restaurantId: "p1", name: { ar: "دوليبران 1000 ملغ", fr: "Doliprane 1000 mg", en: "Doliprane" }, price: 12, stock: 4, cat: "med" },
  { id: "m2", restaurantId: "p1", name: { ar: "أموكسيسيلين", fr: "Amoxicilline", en: "Amoxicillin" }, price: 30, stock: 0 },
  { id: "m3", restaurantId: "p1", name: { ar: "فيتامين سي", fr: "Vitamine C", en: "Vitamin C" }, price: 20, salePrice: 15, isAvailable: false },
  { id: "g1i", restaurantId: "g1", name: { ar: "حليب", fr: "Lait", en: "Milk" }, price: 8, stock: 50, attrs: { brand: "Jibal" } },
  { id: "h1", restaurantId: "x1", name: { ar: "حليب مخفي", fr: "Lait", en: "Milk" }, price: 1 },
  { id: "a1", restaurantId: "g1", name: { ar: "قديم", fr: "Vieux lait", en: "Old" }, price: 3, archived: true },
];
const S = (q, o = {}) => search({ q, items, stores, ...o });

test("norm folds Arabic letter variants, tashkeel, accents and Arabic digits", () => {
  assert.equal(norm("أموكسيسيلين"), norm("اموكسيسيلين"));
  assert.equal(norm("صيدلية"), norm("صيدليه"));
  assert.equal(norm("دَوليبران"), "دوليبران");
  assert.equal(norm("Épicerie"), "epicerie");
  assert.equal(norm("١٠٠٠"), "1000");
});
test("within1 handles typos and swaps", () => {
  assert.ok(within1("doliprane", "dolipran")); assert.ok(within1("doliprane", "doliprnae")); assert.ok(within1("lait", "lart"));
  assert.ok(!within1("doliprane", "doliprxxe"));
});
test("finds a medicine by any language, with price and availability", () => {
  const r = S("doliprane");
  assert.equal(r.items[0].id, "m1");
  assert.equal(r.items[0].available, true);
  assert.equal(r.items[0].unitPrice, 12);
  assert.equal(r.items[0].lowStock, true);
  assert.equal(S("دوليبران").items[0].id, "m1");
  assert.equal(S("DOLIPRANE 1000").items[0].id, "m1", "multi-word + case");
});
test("typo and Arabic variant still match", () => {
  assert.equal(S("dolipran").items[0].id, "m1");
  assert.equal(S("اموكسيسيلين").items[0].id, "m2");
});
test("unavailable / out-of-stock medicines are returned flagged, and rank after orderable ones", () => {
  const r = S("vitamine");
  assert.equal(r.items[0].id, "m3"); assert.equal(r.items[0].available, false); assert.equal(r.items[0].reason, "unavailable");
  assert.equal(r.items[0].unitPrice, 15); assert.equal(r.items[0].onSale, true);
  assert.equal(S("amoxicilline").items[0].reason, "out_of_stock");
  const both = S("l", {}); assert.equal(both.items.length, 0, "1-char query returns nothing");
});
test("never leaks unpublished stores or archived items", () => {
  const ids = S("lait").items.map((i) => i.id);
  assert.deepEqual(ids, ["g1i"]);
});
test("store filter, store hits, brand match", () => {
  assert.equal(S("lait", { storeId: "p1" }).items.length, 0);
  assert.equal(S("nour").stores[0].id, "p1");
  assert.equal(S("jibal").items[0].id, "g1i");
  assert.equal(S("pharmacie").stores[0].id, "p1");
});
test("all words must match; junk returns nothing; limit is capped", () => {
  assert.equal(S("doliprane xyz").items.length, 0);
  assert.equal(S("zzzzzz").items.length, 0);
  assert.equal(S("lait", { limit: 9999 }).items.length, 1);
});

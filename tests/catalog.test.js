"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const c = require("../lib/catalog");

const i18n = (v) => (typeof v === "string" ? { ar: v, en: v, fr: v } : { ar: v?.ar || "", en: v?.en || "", fr: v?.fr || "" });
const cleanImg = (u) => (/^(\/uploads\/|https:\/\/)/.test(String(u || "")) ? u : "");
// Build the UTC instant whose Africa/Casablanca wall-clock equals "YYYY-MM-DDTHH:MM".
// Derived via Intl so the test does not depend on the host's tz-database offset
// (Morocco switches between +00 and +01). 2026-10-19 is a Monday.
const at = (local) => {
  if (/Z$/.test(local)) return new Date(local); // absolute instant
  const [d, hm] = local.split("T");
  const want = `${d}T${hm}`;
  for (const off of [0, 1, 2]) {
    const inst = new Date(Date.parse(`${want}:00Z`) - off * 3600e3);
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", { timeZone: c.TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
        .formatToParts(inst).map((x) => [x.type, x.value]),
    );
    if (`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}` === want) return inst;
  }
  throw new Error("no instant for " + local);
};

test("hours: none configured => open", () => assert.equal(c.isWithinHours(null), true));
test("hours: normal window", () => {
  const h = { days: { 1: { open: "09:00", close: "23:00" } } };
  assert.equal(c.isWithinHours(h, at("2026-10-19T13:00")), true);
  assert.equal(c.isWithinHours(h, at("2026-10-19T23:30")), false);
  assert.equal(c.isWithinHours(h, at("2026-10-20T13:00")), false); // Tuesday not configured
});
test("hours: closed day and overnight window", () => {
  const h = { days: { 1: { closed: true }, 2: { open: "18:00", close: "02:00" } } };
  assert.equal(c.isWithinHours(h, at("2026-10-19T13:00")), false);
  assert.equal(c.isWithinHours(h, at("2026-10-20T20:00")), true);
  assert.equal(c.isWithinHours(h, at("2026-10-21T00:30")), true); // still inside Tue's overnight window
  assert.equal(c.isWithinHours(h, at("2026-10-21T02:30")), false);
});
test("status mapping", () => {
  assert.equal(c.effectiveStatus({ isActive: false }), "unpublished");
  assert.equal(c.effectiveStatus({}), "active");
  assert.equal(c.isPublic({ status: "archived" }), false);
  assert.equal(c.isPublic({ status: "paused" }), true);
  assert.equal(c.isOpenNow({ status: "paused" }), false);
});
test("pickStoreMeta validates", () => {
  const m = c.pickStoreMeta({ status: "bogus", minOrder: -5, deliveryFee: "12.505", avgDeliveryMin: 9999, hours: { days: { 1: { open: "25:00", close: "10:00" } } }, logo: "http://x" }, i18n, cleanImg);
  assert.equal(m.status, undefined);
  assert.equal(m.minOrder, 0);
  assert.equal(m.deliveryFee, 12.51);
  assert.equal(m.avgDeliveryMin, 600);
  assert.equal(m.hours, null);
  assert.equal(m.logo, "");
  const k = c.pickStoreMeta({ status: "archived" }, i18n, cleanImg);
  assert.equal(k.isActive, false);
});
const store = { id: "s1", status: "active", minOrder: 30, deliveryFee: 10, freeDeliveryOver: 100 };
const mk = (o) => new Map(o.map((x) => [x.id, x]));
const nameOf = (x) => x.id;
test("pricing: sale price, fee, snapshot, minimum", () => {
  const byId = mk([{ id: "a", price: 40, salePrice: 30 }, { id: "b", price: 20 }]);
  const r = c.computePricing({ store, lines: [{ id: "a", qty: 2 }, { id: "b", qty: 1 }], byId, nameOf });
  assert.equal(r.ok, true);
  assert.equal(r.subtotal, 80);
  assert.equal(r.deliveryFee, 10);
  assert.equal(r.total, 90);
  assert.equal(r.items[0].price, 30);
  assert.equal(r.items[0].basePrice, 40);
  const low = c.computePricing({ store, lines: [{ id: "b", qty: 1 }], byId, nameOf });
  assert.equal(low.ok, false);
  assert.equal(low.error, "Minimum order not reached");
  const free = c.computePricing({ store, lines: [{ id: "b", qty: 6 }], byId, nameOf });
  assert.equal(free.deliveryFee, 0);
});
test("pricing: rejects invalid/unavailable/out of stock/closed/unpublished", () => {
  const byId = mk([{ id: "a", price: 40, isAvailable: false }, { id: "b", price: 40, stock: 1 }, { id: "z", price: 40, archived: true }]);
  assert.equal(c.computePricing({ store, lines: [{ id: "nope", qty: 1 }], byId }).status, 400);
  assert.equal(c.computePricing({ store, lines: [{ id: "a", qty: 1 }], byId }).status, 409);
  assert.equal(c.computePricing({ store, lines: [{ id: "z", qty: 1 }], byId }).status, 409);
  assert.equal(c.computePricing({ store, lines: [{ id: "b", qty: 2 }], byId }).status, 409);
  assert.equal(c.computePricing({ store: { ...store, status: "paused" }, lines: [{ id: "b", qty: 1 }], byId }).status, 403);
  const closed = { ...store, hours: { days: { 1: { closed: true } } } };
  assert.equal(c.computePricing({ store: closed, lines: [{ id: "b", qty: 1 }], byId, now: at("2026-10-19T12:00:00Z") }).error, "Restaurant is closed");
});
test("applyStock decrements only tracked items", () => {
  const m = { items: [{ id: "a", stock: 5 }, { id: "b" }] };
  assert.equal(c.applyStock(m, [{ id: "a", qty: 2 }, { id: "b", qty: 3 }]), true);
  assert.equal(m.items[0].stock, 3);
  assert.equal(m.items[1].stock, undefined);
});
test("home: only published stores/items, live banners, hidden sections", () => {
  let n = 0;
  const cat = c.sanitizeCatalog({
    categories: [{ name: "Pizza", visible: true }, { name: "Hidden", visible: false }, { name: "" }],
    banners: [{ image: "/uploads/b.webp", active: true }, { image: "/uploads/c.webp", endsAt: "2020-01-01" }, { image: "http://bad" }],
    sections: [{ type: "featured", title: "F" }, { type: "trending", title: "T", visible: false }],
  }, { i18n, cleanImg, makeId: () => "id" + ++n });
  assert.equal(cat.categories.length, 2);
  const stores = [{ id: "s1", name: i18n("A"), status: "active", featured: true }, { id: "s2", name: i18n("B"), status: "unpublished", featured: true }];
  const items = [{ id: "i1", restaurantId: "s1", featured: true, price: 10, name: i18n("x") }, { id: "i2", restaurantId: "s2", featured: true, price: 10, name: i18n("y") }, { id: "i3", restaurantId: "s1", featured: true, price: 10, isAvailable: false, name: i18n("z") }];
  const h = c.buildHome({ catalog: cat, stores, items, now: at("2026-10-19T12:00:00Z") });
  assert.equal(h.categories.length, 1);
  assert.equal(h.banners.length, 1);
  assert.equal(h.sections.length, 1);
  assert.deepEqual(h.sections[0].stores.map((s) => s.id), ["s1"]);
  assert.deepEqual(h.sections[0].items.map((i) => i.id), ["i1"]);
  assert.deepEqual(h.stores.map((s) => s.id), ["s1"]);
});

test("restoreStock is the inverse of applyStock and ignores untracked items", () => {
  const menu = { items: [{ id: "a", stock: 5 }, { id: "b" }] };
  const lines = [{ id: "a", qty: 2 }, { id: "b", qty: 3 }, { id: "zzz", qty: 1 }];
  assert.equal(c.applyStock(menu, lines), true);
  assert.equal(menu.items[0].stock, 3);
  assert.equal(c.restoreStock(menu, lines), true);
  assert.equal(menu.items[0].stock, 5);
  assert.equal(menu.items[1].stock, undefined);
  assert.equal(c.restoreStock(menu, [{ id: "a", qty: -4 }, { id: "a", qty: "x" }]), false);
});

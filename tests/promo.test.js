"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const p = require("../lib/promo");
const NOW = new Date("2026-10-25T12:00:00Z");
const promo = (x = {}) => ({ id: "p1", code: "WELCOME10", type: "percent", value: 10, isActive: true, ...x });
const ev = (o = {}) => p.evaluate({ promo: promo(o.promo), subtotal: 100, customerId: "c1", storeId: "s1", orders: [], now: NOW, ...o.args });

test("definition validation", () => {
  assert.equal(p.validateDefinition({ code: "a", type: "percent", value: 5 }).code, "BAD_CODE");
  assert.equal(p.validateDefinition({ code: "ok1", type: "x", value: 5 }).code, "BAD_TYPE");
  assert.equal(p.validateDefinition({ code: "ok1", type: "percent", value: 150 }).code, "BAD_VALUE");
  assert.equal(p.validateDefinition({ code: "ok1", type: "fixed", value: 0 }).code, "BAD_VALUE");
  assert.equal(p.validateDefinition({ code: "ok1", type: "fixed", value: 5, endsAt: "2026-01-01", startsAt: "2026-02-01" }).code, "BAD_WINDOW");
  assert.equal(p.validateDefinition({ code: "ok1", type: "fixed", value: 5, maxUses: 1.5 }).code, "BAD_MAXUSES");
  const ok = p.validateDefinition({ code: " we lcome-1 ", type: "percent", value: "10", maxUses: 100, storeIds: ["s1", ""] });
  assert.equal(ok.ok, true);
  assert.equal(ok.value.code, "WELCOME-1");
  assert.deepEqual(ok.value.storeIds, ["s1"]);
});

test("percent and fixed amounts, caps, never above subtotal", () => {
  assert.equal(ev().amount, 10);
  assert.equal(ev({ promo: { maxDiscount: 4 } }).amount, 4);
  assert.equal(ev({ promo: { type: "fixed", value: 30 } }).amount, 30);
  assert.equal(ev({ promo: { type: "fixed", value: 500 } }).amount, 100);
  assert.equal(ev({ args: { subtotal: 33.33 } }).amount, 3.33);
});

test("eligibility: inactive, window, store, login, minimum", () => {
  assert.equal(ev({ promo: { isActive: false } }).code, "PROMO_INVALID");
  assert.equal(p.evaluate({ promo: null, subtotal: 10, customerId: "c", orders: [] }).code, "PROMO_INVALID");
  assert.equal(ev({ promo: { startsAt: "2026-11-01T00:00:00Z" } }).code, "PROMO_NOT_STARTED");
  assert.equal(ev({ promo: { endsAt: "2026-10-01T00:00:00Z" } }).code, "PROMO_EXPIRED");
  assert.equal(ev({ promo: { storeIds: ["other"] } }).code, "PROMO_STORE");
  assert.equal(ev({ promo: { storeIds: ["s1"] } }).ok, true);
  assert.equal(ev({ args: { customerId: null } }).code, "LOGIN_REQUIRED");
  assert.equal(ev({ promo: { minSubtotal: 150 } }).code, "PROMO_MIN");
});

test("limits are counted from non-cancelled orders; cancelling gives the use back", () => {
  const orders = [
    { promo: { id: "p1" }, customerId: "c1", status: "done" },
    { promo: { id: "p1" }, customerId: "c2", status: "canceled" },
    { promo: { id: "other" }, customerId: "c1", status: "done" },
  ];
  assert.deepEqual(p.usage("p1", orders, "c1"), { total: 1, mine: 1, discountTotal: 0 });
  assert.equal(ev({ promo: { maxUsesPerCustomer: 1 }, args: { orders } }).code, "PROMO_USED");
  assert.equal(ev({ promo: { maxUsesPerCustomer: 2 }, args: { orders } }).ok, true);
  assert.equal(ev({ promo: { maxUses: 1 }, args: { orders, customerId: "c9" } }).code, "PROMO_EXHAUSTED");
  assert.equal(ev({ promo: { maxUses: 2 }, args: { orders, customerId: "c9" } }).ok, true);
});

test("order helpers: customer pays less, driver is charged less by the same amount", () => {
  const o = { subtotal: 100, deliveryFee: 10, promo: { amount: 15 } };
  assert.equal(p.discountOf(o), 15);
  assert.equal(p.totalOf(o), 95);
  assert.equal(p.goodsDue(o), 85);
  assert.equal(p.totalOf({ subtotal: 100, deliveryFee: 10 }), 110);
  assert.equal(p.goodsDue({ subtotal: 100 }), 100);
  // receipt edited down below the discount: clamp, never negative
  assert.equal(p.discountOf({ subtotal: 8, promo: { amount: 15 } }), 8);
  assert.equal(p.goodsDue({ subtotal: 8, promo: { amount: 15 } }), 0);
});

test("snapshot records what was applied", () => {
  const r = ev();
  assert.deepEqual({ ...r.snapshot, at: undefined }, { id: "p1", code: "WELCOME10", type: "percent", value: 10, amount: 10, fundedBy: "platform", at: undefined });
});

test("first-order-only and category rules", () => {
  const orders = [{ customerId: "c1", status: "done" }, { customerId: "c2", status: "canceled" }];
  assert.equal(ev({ promo: { firstOrderOnly: true }, args: { orders } }).code, "PROMO_FIRST_ONLY");
  assert.equal(ev({ promo: { firstOrderOnly: true }, args: { orders, customerId: "c2" } }).ok, true); // only a cancelled order before
  const byId = new Map([["a", { cat: "pizza" }], ["b", { cat: "drinks" }]]);
  const items = [{ id: "a", qty: 2, price: 30 }, { id: "b", qty: 1, price: 40 }];
  assert.equal(p.eligibleSubtotal(items, byId, []), 100);
  assert.equal(p.eligibleSubtotal(items, byId, ["pizza"]), 60);
  const r = ev({ promo: { categories: ["pizza"] }, args: { eligibleSubtotal: 60 } });
  assert.equal(r.amount, 6); // 10% of the pizza only, not of the whole 100
  assert.equal(ev({ promo: { categories: ["x"] }, args: { eligibleSubtotal: 0 } }).code, "PROMO_CATEGORY");
  assert.equal(ev({ promo: { type: "fixed", value: 50, categories: ["pizza"] }, args: { eligibleSubtotal: 60 } }).amount, 50);
  assert.equal(ev({ promo: { type: "fixed", value: 80, categories: ["pizza"] }, args: { eligibleSubtotal: 60 } }).amount, 60);
});

test("usage reports the platform cost and skips cancelled orders", () => {
  const orders = [
    { promo: { id: "p1", amount: 10 }, customerId: "a", status: "done" },
    { promo: { id: "p1", amount: 5.5 }, customerId: "b", status: "new" },
    { promo: { id: "p1", amount: 99 }, customerId: "c", status: "canceled" },
  ];
  assert.deepEqual(p.usage("p1", orders, null), { total: 2, mine: 0, discountTotal: 15.5 });
});

test("definition accepts categories and firstOrderOnly", () => {
  const v = p.validateDefinition({ code: "ok1", type: "fixed", value: 5, categories: [" pizza ", ""], firstOrderOnly: true });
  assert.deepEqual(v.value.categories, ["pizza"]);
  assert.equal(v.value.firstOrderOnly, true);
});

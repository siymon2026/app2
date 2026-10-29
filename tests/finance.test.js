"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const f = require("../lib/finance");

test("commission amounts: percent on goods only, fixed, none, capped at subtotal", () => {
  assert.equal(f.commissionAmount(200, { type: "percent", value: 10 }), 20);
  assert.equal(f.commissionAmount(33.33, { type: "percent", value: 12.5 }), 4.17);
  assert.equal(f.commissionAmount(200, { type: "fixed", value: 5 }), 5);
  assert.equal(f.commissionAmount(3, { type: "fixed", value: 5 }), 3);
  assert.equal(f.commissionAmount(200, { type: "none" }), 0);
  assert.equal(f.commissionAmount(200, undefined), 0);
  assert.equal(f.commissionAmount(-5, { type: "percent", value: 10 }), 0);
});

test("commission validation is strict (rejects, never clamps)", () => {
  assert.equal(f.validateCommission({ type: "percent", value: 51 }).ok, false);
  assert.equal(f.validateCommission({ type: "percent", value: -1 }).ok, false);
  assert.equal(f.validateCommission({ type: "fixed", value: 1001 }).ok, false);
  assert.equal(f.validateCommission({ type: "fixed", value: "" }).ok, false);
  assert.equal(f.validateCommission({ type: "weird", value: 1 }).ok, false);
  assert.deepEqual(f.validateCommission({ type: "none", value: 99 }), { ok: true, value: { type: "none", value: 0 } });
  assert.deepEqual(f.validateCommission({ type: "percent", value: "12.5" }), { ok: true, value: { type: "percent", value: 12.5 } });
});

test("stored bad commission values are normalized when read", () => {
  assert.deepEqual(f.normalizeCommission({ type: "percent", value: 900 }), { type: "percent", value: 50 });
  assert.deepEqual(f.normalizeCommission({ type: "x", value: 5 }), { type: "none", value: 0 });
});

test("order snapshot freezes setting and amounts; later changes do not alter it", () => {
  const store = { commission: { type: "percent", value: 10 } };
  const order = { subtotal: 100, deliveryFee: 12, total: 112, paymentMethod: "cod" };
  const fin = f.orderFinancials({ order, store, driverEarning: 8, now: new Date("2026-10-24T10:00:00Z") });
  assert.equal(fin.commissionAmount, 10);
  assert.equal(fin.businessNet, 90);
  assert.equal(fin.platformDeliveryMargin, 4);
  assert.deepEqual(fin.commission, { type: "percent", value: 10 });
  store.commission.value = 40; // admin changes it later
  assert.equal(fin.commissionAmount, 10);
  assert.equal(fin.commission.value, 10);
  assert.equal(fin.status, "open");
});

test("delivery margin can be negative and is recorded as such", () => {
  const fin = f.orderFinancials({ order: { subtotal: 50, deliveryFee: 5, total: 55 }, store: {}, driverEarning: 9 });
  assert.equal(fin.platformDeliveryMargin, -4);
  assert.equal(fin.commissionAmount, 0);
  assert.equal(fin.businessNet, 50);
});

test("finalize: delivered -> final once; cancelled -> void; final is never reopened", () => {
  const o = { status: "delivered", financials: { status: "open" } };
  assert.equal(f.finalize(o), true);
  assert.equal(o.financials.status, "final");
  assert.equal(f.finalize(o), false); // idempotent
  o.status = "canceled"; // should never happen, but a final record must not change
  assert.equal(f.finalize(o), false);
  assert.equal(o.financials.status, "final");
  const c = { status: "canceled", financials: { status: "open" } };
  assert.equal(f.finalize(c), true);
  assert.equal(c.financials.status, "void");
  assert.equal(f.finalize({ status: "delivered" }), false); // legacy order
  assert.equal(f.finalize({ status: "accepted", financials: { status: "open" } }), false);
});

test("settlement validation: required fields, bounds, unique reference per store", () => {
  const now = new Date("2026-10-24T12:00:00Z");
  const ok = { storeId: "s1", amount: "150.5", reference: "VIR-001", date: "2026-10-24", note: "weekly" };
  const v = f.validateSettlement(ok, [], now);
  assert.equal(v.ok, true);
  assert.deepEqual([v.value.amount, v.value.direction], [150.5, "to_store"]);
  for (const bad of [
    { amount: 0 }, { amount: -5 }, { amount: "x" }, { amount: 1e9 }, { reference: "ab" }, { reference: "" },
    { date: "24/10/2026" }, { date: "2030-01-01" }, { direction: "sideways" }, { storeId: "" },
  ]) assert.equal(f.validateSettlement({ ...ok, ...bad }, [], now).ok, false, JSON.stringify(bad));
  const dup = f.validateSettlement({ ...ok, reference: "vir-001" }, [{ storeId: "s1", reference: "VIR-001" }], now);
  assert.equal(dup.status, 409);
  assert.equal(f.validateSettlement({ ...ok, storeId: "s2" }, [{ storeId: "s1", reference: "VIR-001" }], now).ok, true);
});

test("statement: range totals, legacy orders flagged, voided settlements ignored, balance", () => {
  const fin = (sub, c) => ({ status: "final", commissionAmount: c, businessNet: sub - c });
  const orders = [
    { restaurantId: "s1", status: "delivered", subtotal: 100, deliveryFee: 10, paymentMethod: "cod", deliveredAt: "2026-10-20T10:00:00Z", financials: fin(100, 10) },
    { restaurantId: "s1", status: "done", subtotal: 50, deliveryFee: 5, deliveredAt: "2026-10-22T10:00:00Z" }, // legacy
    { restaurantId: "s1", status: "canceled", subtotal: 999, deliveredAt: "2026-10-21T10:00:00Z" },
    { restaurantId: "s2", status: "delivered", subtotal: 777, deliveredAt: "2026-10-21T10:00:00Z" },
    { restaurantId: "s1", status: "delivered", subtotal: 40, deliveryFee: 4, deliveredAt: "2026-09-01T10:00:00Z", financials: fin(40, 4) },
  ];
  const settlements = [
    { storeId: "s1", amount: 60, direction: "to_store", date: "2026-10-23", status: "recorded" },
    { storeId: "s1", amount: 1000, direction: "to_store", date: "2026-10-23", status: "void" },
    { storeId: "s1", amount: 10, direction: "from_store", date: "2026-10-24", status: "recorded" },
  ];
  const s = f.statement({ orders, settlements, storeId: "s1", from: Date.parse("2026-10-01"), to: Date.parse("2026-10-31") });
  assert.deepEqual(
    [s.range.orders, s.range.goods, s.range.commission, s.range.net, s.range.legacyOrdersWithoutSnapshot],
    [2, 150, 10, 140, 1],
  );
  assert.equal(s.range.settlementsNet, 50);
  assert.equal(s.allTime.netEntitlement, 140 + 36);
  assert.equal(s.allTime.settledNet, 50);
  assert.equal(s.allTime.balanceOwedToStore, 126);
});

test("refresh recomputes amounts with the SNAPSHOTTED commission, only while open", () => {
  const store = { commission: { type: "percent", value: 10 } };
  const order = { subtotal: 100, deliveryFee: 10, total: 110 };
  order.financials = f.orderFinancials({ order, store, driverEarning: 6, now: new Date("2026-10-24T10:00:00Z") });
  store.commission = { type: "percent", value: 40 }; // later setting change
  order.subtotal = 200; order.total = 210; // receipt edit before delivery
  assert.equal(f.refresh(order, 6), true);
  assert.equal(order.financials.commissionAmount, 20); // still 10%
  assert.equal(order.financials.businessNet, 180);
  assert.equal(order.financials.snapshotAt, "2026-10-24T10:00:00.000Z");
  order.status = "delivered"; f.finalize(order);
  order.subtotal = 1; assert.equal(f.refresh(order, 6), false); // final records are frozen
  assert.equal(f.refresh({ subtotal: 5 }, 0), false); // legacy
});

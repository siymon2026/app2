"use strict";
const test = require("node:test");
const assert = require("node:assert");
const R = require("../lib/reports");
const fin = require("../lib/finance");
const roles = require("../lib/admin-roles");

const NOW = Date.parse("2026-10-27T12:00:00Z");
const P = (q = {}) => R.parseParams({ from: "2026-10-01", to: "2026-10-27", ...q }, { now: NOW }).params;
const ADMIN = { scope: "admin", finance: true };

function order(id, store, sub, fee, { comm = { type: "percent", value: 10 }, status = "delivered", at = "2026-10-20T11:00:00Z", extra = {} } = {}) {
  const o = { id, restaurantId: store, status, createdAt: "2026-10-20T10:00:00Z", deliveredAt: at, subtotal: sub, deliveryFee: fee, total: sub + fee, paymentMethod: "cod", driverId: "d1", ...extra };
  o.financials = fin.orderFinancials({ order: o, store: { commission: comm }, driverEarning: fee });
  fin.finalize(o);
  return o;
}
const world = () => ({
  now: NOW,
  stores: [{ id: "s1", name: { en: "One" }, commission: { type: "percent", value: 10 } }, { id: "s2", name: { en: "Two" }, commission: { type: "fixed", value: 5 } }],
  orders: [order("a", "s1", 100, 10), order("b", "s2", 50, 10, { comm: { type: "fixed", value: 5 } }), order("c", "s1", 200, 20)],
  settlements: [{ id: "x", storeId: "s1", amount: 100, direction: "to_store", date: "2026-10-22", status: "recorded", reference: "REF1" }],
  drivers: [{ id: "d1", name: "Ali", walletBalance: 0, walletHistory: [] }], customers: [], topups: [],
});

test("range: defaults, presets, validation, 366-day cap", () => {
  const r = R.parseRange({}, { now: NOW });
  assert.equal(r.range.toKey, "2026-10-27");
  assert.equal(r.range.fromKey, "2026-09-28");
  assert.equal(R.parseRange({ from: "2026-02-30" }, { now: NOW }).code, "BAD_DATE");
  assert.equal(R.parseRange({ from: "2026-10-05", to: "2026-10-01" }, { now: NOW }).code, "BAD_RANGE");
  assert.equal(R.parseRange({ from: "2024-01-01", to: "2026-01-01" }, { now: NOW }).code, "RANGE_TOO_LONG");
  assert.equal(R.parseRange({ preset: "last_month" }, { now: NOW }).range.fromKey, "2026-09-01");
  assert.equal(R.parseRange({ preset: "nope" }, { now: NOW }).code, "BAD_PRESET");
  assert.equal(R.parseRange({ from: ["a", "b"] }, { now: NOW }).ok, false);
});

test("buckets: weeks start Monday, empty periods are present", () => {
  assert.equal(R.weekStart("2026-10-27"), "2026-10-26");
  const keys = R.bucketKeys(R.parseRange({ from: "2026-10-01", to: "2026-10-31" }, { now: NOW }).range, "month");
  assert.deepEqual(keys, ["2026-10"]);
  assert.equal(R.bucketKeys(R.parseRange({ from: "2026-10-01", to: "2026-10-07" }, { now: NOW }).range, "day").length, 7);
});

test("sales: totals equal the sum of rows and of the orders", () => {
  const D = world();
  for (const gran of ["day", "week", "month"]) {
    const t = R.generate("sales", D, P({ granularity: gran }), ADMIN).report.tables[0];
    const sum = (k) => Math.round(t.rows.reduce((s, r) => s + r[k] * 100, 0)) / 100;
    assert.equal(sum("total"), t.totals.total);
    assert.equal(sum("commission"), t.totals.commission);
    assert.equal(t.totals.delivered, 3);
    assert.equal(t.totals.goods, 350);
    assert.equal(t.totals.total, 390);
  }
});

test("sales: platform net = commission + delivery margin - discount", () => {
  const D = world();
  const t = R.generate("sales", D, P(), ADMIN).report.tables[0];
  // commission 10 + 5 + 20 = 35 ; margin 0 (driver gets the fee)
  assert.equal(t.totals.commission, 35);
  assert.equal(t.totals.platformNet, 35);
  assert.equal(t.totals.businessNet, 315);
});

test("sales: canceled counted by cancellation date, not delivered", () => {
  const D = world();
  D.orders.push({ id: "z", restaurantId: "s1", status: "canceled", canceledBy: "customer", createdAt: "2026-10-20T10:00:00Z", canceledAt: "2026-10-21T10:00:00Z", subtotal: 40, deliveryFee: 5, total: 45 });
  const t = R.generate("sales", D, P(), ADMIN).report.tables[0];
  assert.equal(t.totals.canceled, 1);
  assert.equal(t.totals.delivered, 3);
  assert.equal(t.totals.total, 390); // canceled money never counts as revenue
});

test("commissions report equals finance.statement() for each store", () => {
  const D = world();
  const p = P();
  const rows = R.generate("commissions", D, p, ADMIN).report.tables[0].rows;
  for (const row of rows) {
    const st = fin.statement({ orders: D.orders, settlements: D.settlements, storeId: row.storeId, from: p.range.from, to: p.range.to });
    assert.equal(row.businessNet, st.range.net);
    assert.equal(row.commission, st.range.commission);
    assert.equal(row.balance, st.allTime.balanceOwedToStore);
    assert.equal(row.settled, st.range.settlementsNet);
  }
  assert.equal(rows.find((r) => r.storeId === "s1").balance, 270 - 100);
});

test("settlements report excludes void entries from the net but still lists them", () => {
  const D = world();
  D.settlements.push({ id: "y", storeId: "s1", amount: 40, direction: "to_store", date: "2026-10-23", status: "void", voidReason: "typo", reference: "REF2" });
  const t = R.generate("settlements", D, P(), ADMIN).report.tables[0];
  assert.equal(t.rows.length, 2);
  assert.equal(t.totals.amount, 100);
});

test("legacy orders without a snapshot use the statement fallback and are flagged", () => {
  const D = world();
  D.orders.push({ id: "old", restaurantId: "s1", status: "delivered", createdAt: "2026-10-20T10:00:00Z", deliveredAt: "2026-10-20T11:00:00Z", subtotal: 60, deliveryFee: 10, total: 70 });
  const r = R.generate("sales", D, P(), ADMIN).report;
  assert.equal(r.meta.legacyOrders, 1);
  const p = P();
  const row = R.generate("commissions", D, p, ADMIN).report.tables[0].rows.find((x) => x.storeId === "s1");
  const st = fin.statement({ orders: D.orders, settlements: D.settlements, storeId: "s1", from: p.range.from, to: p.range.to });
  assert.equal(row.businessNet, st.range.net);
});

test("STORE ISOLATION: a store scope never sees another store's orders, in any store-visible report", () => {
  const D = world();
  for (const type of R.availableTypes("store")) {
    const g = R.generate(type, D, P(), { scope: "store", finance: true, storeId: "s2" });
    assert.ok(g.ok, type);
    const text = JSON.stringify(g.report);
    assert.ok(!text.includes('"a"') && !text.includes('"c"'), `${type} leaked another store's order`);
    assert.ok(!text.includes("One"), `${type} leaked another store's name`);
  }
  const s = R.generate("sales", D, P(), { scope: "store", finance: true, storeId: "s2" }).report.tables[0];
  assert.equal(s.totals.goods, 50);
  // query-supplied filters are ignored for a store: ctx.storeId is authoritative
  assert.equal(R.generate("sales", D, P(), { scope: "store", finance: true, storeId: "s2" }).report.tables[0].totals.delivered, 1);
});

test("a store scope with no store id sees nothing and is refused", () => {
  const D = world();
  assert.equal(R.generate("sales", D, P(), { scope: "store", finance: true }).status, 403);
});

test("store scope cannot open admin-only reports and never gets platform columns", () => {
  const D = world();
  for (const t of ["payments", "drivers", "comparison", "reconcile", "driver-earnings"]) {
    assert.equal(R.generate(t, D, P(), { scope: "store", finance: true, storeId: "s1" }).status, 404, t);
  }
  const of = R.generate("order-financials", D, P(), { scope: "store", finance: true, storeId: "s1" }).report.tables[0];
  const keys = of.columns.map((c) => c.key);
  for (const k of ["driverEarning", "margin", "platformNet", "walletPaid", "cashDue", "store"]) assert.ok(!keys.includes(k), k);
  for (const row of of.rows) assert.ok(!("driverEarning" in row));
  assert.ok(!JSON.stringify(of).includes("customer"));
});

test("finance columns are removed for a role without finance.read", () => {
  const D = world();
  const t = R.generate("sales", D, P(), { scope: "admin", finance: false }).report.tables[0];
  const keys = t.columns.map((c) => c.key);
  for (const k of ["commission", "businessNet", "driverEarnings", "platformNet"]) {
    assert.ok(!keys.includes(k));
    assert.ok(!(k in t.totals));
  }
  assert.ok(keys.includes("goods"));
  assert.equal(R.generate("payments", D, P(), { scope: "admin", finance: false }).status, 403);
  const d = R.generate("drivers", D, P(), { scope: "admin", finance: false }).report.tables[0];
  assert.ok(!d.columns.some((c) => ["earnings", "cash", "walletBalance"].includes(c.key)));
});

test("driver scope: only own deliveries", () => {
  const D = world();
  D.orders.push(order("e", "s1", 30, 8, { extra: { driverId: "d2" } }));
  const g = R.generate("driver-earnings", D, P(), { scope: "driver", finance: true, driverId: "d2" }).report.tables[0];
  assert.equal(g.totals.deliveries, 1);
  assert.equal(g.totals.earnings, 8);
  assert.equal(R.generate("driver-earnings", D, P(), { scope: "driver", finance: true }).status, 403);
});

test("drivers report: counts, km, delivery time, rating, earnings", () => {
  const D = world();
  D.orders[0].deliveryPricing = { km: 3.5 };
  D.orders[0].assignedAt = "2026-10-20T10:30:00Z";
  D.orders[0].driverRating = { stars: 4, createdAt: "2026-10-20T12:00:00Z" };
  const t = R.generate("drivers", D, P(), ADMIN).report.tables[0];
  const row = t.rows[0];
  assert.equal(row.delivered, 3);
  assert.equal(row.km, 3.5);
  assert.equal(row.avgDeliveryMin, 30);
  assert.equal(row.avgRating, 4);
  assert.equal(row.earnings, 40);
});

test("exceptions: canceled by actor, delayed preparation, failed delivery; reasons grouped", () => {
  const D = world();
  D.orders.push(
    { id: "k1", restaurantId: "s1", status: "canceled", canceledBy: "store", cancelReason: "out of stock", createdAt: "2026-10-20T10:00:00Z", canceledAt: "2026-10-20T10:05:00Z", total: 20 },
    { id: "k2", restaurantId: "s1", status: "canceled", canceledBy: "customer", createdAt: "2026-10-21T10:00:00Z", canceledAt: "2026-10-21T10:01:00Z", total: 20 },
    { id: "k3", restaurantId: "s2", status: "restaurant_ready", storeAcceptedAt: "2026-10-22T10:00:00Z", restaurantReadyAt: "2026-10-22T10:40:00Z", createdAt: "2026-10-22T09:59:00Z", total: 10 },
    { id: "k4", restaurantId: "s2", status: "failed_delivery", failedDelivery: { reason: "no answer" }, deliveryFailedAt: "2026-10-23T10:00:00Z", createdAt: "2026-10-23T09:00:00Z", total: 10 },
  );
  const rep = R.generate("exceptions", D, P(), ADMIN).report;
  const cat = Object.fromEntries(rep.tables[0].rows.map((r) => [r.category, r.count]));
  assert.equal(cat.rejected_store, 1);
  assert.equal(cat.canceled_customer, 1);
  assert.equal(cat.delayed_preparation, 1);
  assert.equal(cat.failed_delivery, 1);
  assert.ok(rep.tables[1].rows.some((r) => r.reason === "out of stock"));
  // a business sees only its own
  const mine = R.generate("exceptions", D, P(), { scope: "store", finance: true, storeId: "s2" }).report.tables[0].rows;
  assert.equal(mine.reduce((s, r) => s + r.count, 0), 2);
});

test("payments: method split, wallet movements, topups, pending refunds, balance consistency", () => {
  const D = world();
  D.orders[0].payment = { method: "cod", walletAmount: 20, amountDueOnDelivery: 90 };
  D.customers = [{ id: "c1", walletBalance: 30, walletHistory: [
    { ref: "topup:1", type: "topup", amount: 50, createdAt: "2026-10-10T10:00:00Z" },
    { ref: "order:a:wallet", type: "order_payment", amount: -20, createdAt: "2026-10-20T10:00:00Z" },
  ] }];
  D.topups = [{ id: "t1", walletType: "customer", status: "approved", amount: 50, createdAt: "2026-10-10T10:00:00Z" }, { id: "t2", status: "pending", amount: 10, createdAt: "2026-10-11T10:00:00Z" }];
  D.orders.push({ id: "rf", restaurantId: "s1", status: "canceled", canceledAt: "2026-10-21T10:00:00Z", createdAt: "2026-10-20T10:00:00Z", total: 30, payment: { walletAmount: 12 } });
  const tabs = Object.fromEntries(R.generate("payments", D, P(), ADMIN).report.tables.map((t) => [t.id, t]));
  assert.equal(tabs.byMethod.totals.walletPaid, 20);
  assert.equal(tabs.byMethod.totals.cashDue, 90 + 60 + 220);
  assert.equal(tabs.walletMovements.totals.net, 30);
  assert.equal(tabs.topups.rows.length, 2);
  assert.equal(tabs.refunds.rows.find((r) => r.kind === "pending").amount, 12);
  assert.equal(tabs.consistency.rows.find((r) => r.walletType === "customer").mismatched, 0);
  D.customers[0].walletBalance = 999;
  const bad = R.generate("payments", D, P(), ADMIN).report.tables.find((t) => t.id === "consistency");
  assert.equal(bad.rows.find((r) => r.walletType === "customer").mismatched, 1);
});

test("comparison ranks stores by delivered goods and groups by type", () => {
  const D = world();
  D.stores[0].type = "restaurant"; D.stores[1].type = "grocery";
  const t = R.generate("comparison", D, P(), ADMIN).report.tables;
  assert.equal(t[0].rows[0].store, "One");
  assert.equal(t[0].rows[0].rank, 1);
  assert.equal(t[1].rows.length, 2);
});

test("reconcile: clean data passes; tampering is caught and listed", () => {
  const D = world();
  D.customers = [];
  let r = R.generate("reconcile", D, P(), ADMIN).report;
  assert.equal(r.meta.ok, true);
  D.orders[0].total = 999; // order no longer equals its snapshot
  D.orders[1].financials.status = "open";
  r = R.generate("reconcile", D, P(), ADMIN).report;
  assert.equal(r.meta.ok, false);
  const kinds = r.tables[1].rows.map((x) => x.kind);
  assert.ok(kinds.includes("total_mismatch"));
  assert.ok(kinds.includes("snapshot_total"));
  assert.ok(kinds.includes("snapshot_not_final"));
});

test("reconcile: wallet payment missing from the ledger is reported", () => {
  const D = world();
  D.orders[0].customerId = "c1";
  D.orders[0].payment = { walletAmount: 20 };
  D.customers = [{ id: "c1", walletBalance: 0, walletHistory: [] }];
  const r = R.generate("reconcile", D, P(), ADMIN).report;
  assert.ok(r.tables[1].rows.some((x) => x.kind === "wallet_payment_missing" && x.ref === "a"));
});

test("registry permissions agree with the role rules (no report is reachable by a role the table forbids)", () => {
  for (const id of R.TYPE_IDS) {
    const need = R.REPORTS[id].admin;
    const rule = roles.permissionFor("GET", `/api/admin/reports/${id}`);
    assert.equal(rule, need, `${id}: RULES=${rule} registry=${need}`);
  }
  assert.equal(roles.permissionFor("GET", "/api/admin/reports"), roles.SELF);
  // support role: no finance, no sales reports
  assert.equal(roles.authorize("support", "GET", "/api/admin/reports/payments").ok, false);
  assert.equal(roles.authorize("support", "GET", "/api/admin/reports/sales").ok, false);
  assert.equal(roles.authorize("accountant", "GET", "/api/admin/reports/payments").ok, true);
  assert.equal(roles.authorize("order_supervisor", "GET", "/api/admin/reports/payments").ok, false);
  assert.equal(roles.authorize("order_supervisor", "GET", "/api/admin/reports/sales").ok, true);
  assert.equal(roles.authorize("driver_supervisor", "GET", "/api/admin/reports/drivers").ok, true);
  assert.equal(roles.authorize("driver_supervisor", "GET", "/api/admin/reports/comparison").ok, false);
});

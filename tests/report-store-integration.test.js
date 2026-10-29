"use strict";
/** Business reports through the REAL store authentication/membership (lib/store-routes.js requireStore). */
const test = require("node:test");
const assert = require("node:assert");
const { world, TOK, H } = require("./store-world");
const { registerReportRoutes } = require("../lib/report-routes");
const roles = require("../lib/admin-roles");
const fin = require("../lib/finance");

function setup() {
  const w = world();
  const mk = (id, store) => {
    const o = { id, restaurantId: store, status: "delivered", createdAt: "2026-10-20T10:00:00Z", deliveredAt: "2026-10-20T11:00:00Z", subtotal: 100, deliveryFee: 10, total: 110, paymentMethod: "cod", customer: { name: "Zed", phone: "0699" } };
    o.financials = fin.orderFinancials({ order: o, store: { commission: { type: "percent", value: 10 } }, driverEarning: 10 });
    fin.finalize(o);
    return o;
  };
  const orders = [mk("G-1", "g1"), mk("R-1", "r1")];
  registerReportRoutes(w.app, {
    requireAdmin: (q, r, n) => n(), requireStore: w.storeApi.requireStore, adminRoles: roles, appendAuditLog: (e) => w.audits.push(e), now: () => Date.parse("2026-10-27T12:00:00Z"),
    loaders: { orders: () => orders, stores: () => w.files.restaurants.restaurants, drivers: () => [], customers: () => [], settlements: () => [], topups: () => [], exceptions: () => ({ cases: [], settings: {} }) },
  });
  return w;
}
const Q = { from: "2026-10-01", to: "2026-10-27" };

test("owner sees only the store selected by a membership they hold", async () => {
  const w = setup();
  const own = await w.call("GET", "/api/store/reports/sales", { headers: H(TOK(["u-own"]), "g1"), query: Q });
  assert.equal(own.status, 200);
  assert.equal(own.body.report.tables[0].totals.delivered, 1);
  const txt = JSON.stringify(own.body);
  assert.ok(!txt.includes("R-1"));
});

test("a member of g1 cannot read r1's reports by switching X-Store-Id", async () => {
  const w = setup();
  const r = await w.call("GET", "/api/store/reports/sales", { headers: H(TOK(["u-own"]), "r1"), query: Q });
  assert.equal(r.status, 403);
});

test("one account owning two stores gets each store's own numbers, never the sum", async () => {
  const w = setup();
  const tok = TOK(["u-own", "u-own2"]);
  const a = await w.call("GET", "/api/store/reports/order-financials", { headers: H(tok, "g1"), query: Q });
  const b = await w.call("GET", "/api/store/reports/order-financials", { headers: H(tok, "r1"), query: Q });
  assert.deepEqual(a.body.report.tables[0].rows.map((x) => x.orderId), ["G-1"]);
  assert.deepEqual(b.body.report.tables[0].rows.map((x) => x.orderId), ["R-1"]);
  assert.equal((await w.call("GET", "/api/store/reports/sales", { headers: H(tok), query: Q })).status, 400); // must pick a store
});

test("a cashier has no reports.read: refused; no token: 401", async () => {
  const w = setup();
  assert.equal((await w.call("GET", "/api/store/reports/sales", { headers: H(TOK(["u-cash"]), "g1"), query: Q })).status, 403);
  assert.equal((await w.call("GET", "/api/store/reports", { headers: {}, query: Q })).status, 401);
});

test("pharmacy store gets the same scoped reports; export is audited with store id", async () => {
  const w = setup();
  const r = await w.call("GET", "/api/store/reports/commissions", { headers: H(TOK(["u-ph"]), "p1"), query: { ...Q, format: "csv" } });
  assert.equal(r.status, 200);
  assert.ok(w.audits.some((a) => a.action === "report.export" && a.storeId === "p1"));
});

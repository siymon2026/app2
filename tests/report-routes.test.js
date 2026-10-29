"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { registerReportRoutes } = require("../lib/report-routes");
const roles = require("../lib/admin-roles");
const fin = require("../lib/finance");

const NOW = Date.parse("2026-10-27T12:00:00Z");
function mkOrder(id, store, sub, fee, driverId = "d1") {
  const o = { id, restaurantId: store, status: "delivered", createdAt: "2026-10-20T10:00:00Z", deliveredAt: "2026-10-20T11:00:00Z", subtotal: sub, deliveryFee: fee, total: sub + fee, paymentMethod: "cod", driverId, customer: { name: "Secret Name", phone: "0600000000" } };
  o.financials = fin.orderFinancials({ order: o, store: { commission: { type: "percent", value: 10 } }, driverEarning: fee });
  fin.finalize(o);
  return o;
}
function setup() {
  const audit = [];
  const routes = [];
  const reg = (m) => (path, ...h) => routes.push({ m, path, h });
  const app = { get: reg("GET") };
  const data = {
    orders: [mkOrder("a", "s1", 100, 10), mkOrder("b", "s2", 50, 10, "d2")],
    stores: [{ id: "s1", name: { en: "One" } }, { id: "s2", name: { en: "Two" } }],
    drivers: [{ id: "d1", name: "Ali" }, { id: "d2", name: "Omar" }], customers: [], settlements: [], topups: [],
  };
  // auth stand-ins: the identity comes from headers the test controls (as a token would in production)
  const requireAdmin = (req, res, next) => {
    const role = req.headers["x-role"];
    if (!role) return res.status(401).json({ error: "Unauthorized" });
    const az = roles.authorize(role, "GET", req.originalUrl);
    if (!az.ok) return res.status(403).json({ error: "Forbidden" });
    req.adminRole = role; req.adminId = "adm1"; next();
  };
  const requireStore = (perm) => (req, res, next) => {
    if (!req.headers["x-store"]) return res.status(401).json({ error: "Unauthorized" });
    req.storeId = req.headers["x-store"]; req.storeRole = "owner"; req.storeUserId = "u1"; next();
  };
  const requireDriver = (req, res, next) => { if (!req.headers["x-driver"]) return res.status(401).json({ error: "Unauthorized" }); req.driverId = req.headers["x-driver"]; next(); };
  registerReportRoutes(app, {
    requireAdmin, requireStore, requireDriver, adminRoles: roles, appendAuditLog: (e) => audit.push(e), now: () => NOW, getConfig: () => ({ currency: "MAD" }),
    loaders: { orders: () => data.orders, stores: () => data.stores, drivers: () => data.drivers, customers: () => data.customers, settlements: () => data.settlements, topups: () => data.topups, exceptions: () => ({ cases: [], settings: {} }) },
  });
  async function call(path, { headers = {}, query = {} } = {}) {
    for (const r of routes) {
      const rp = r.path.split("/"), up = path.split("/");
      if (rp.length !== up.length) continue;
      const params = {};
      const ok = rp.every((seg, i) => {
        if (!seg.startsWith(":")) return seg === up[i];
        const name = seg.slice(1).replace(/\(.*$/, "");
        const re = /\(([^)]*)\)/.exec(seg);
        if (re && !new RegExp("^(?:" + re[1].replace(/^\[a-z-\]\+$/, "[a-z-]+") + ")$").test(up[i])) return false;
        params[name] = up[i]; return true;
      });
      if (!ok) continue;
      const h = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
      const req = { params, query, headers: h, originalUrl: path, header: (k) => h[k.toLowerCase()] };
      return await new Promise((resolve) => {
        const res = { code: 200, hdr: {}, status(c) { this.code = c; return this; }, setHeader(k, v) { this.hdr[k] = v; }, json(o) { resolve({ status: this.code, body: o, hdr: this.hdr }); }, send(b) { resolve({ status: this.code, raw: b, hdr: this.hdr }); } };
        let i = 0;
        const next = () => { const fn = r.h[i++]; if (fn) fn(req, res, next); };
        next();
      });
    }
    throw new Error("no route " + path);
  }
  return { call, audit, data };
}
const Q = { from: "2026-10-01", to: "2026-10-27" };

test("unauthenticated requests are rejected on every audience", async () => {
  const { call } = setup();
  for (const p of ["/api/admin/reports", "/api/admin/reports/sales", "/api/store/reports", "/api/store/reports/sales", "/api/driver/reports/earnings"]) {
    assert.equal((await call(p, { query: Q })).status, 401, p);
  }
});

test("admin: system_admin gets JSON with labels; unknown report 404; bad dates 400", async () => {
  const { call } = setup();
  const r = await call("/api/admin/reports/sales", { headers: { "x-role": "system_admin" }, query: Q });
  assert.equal(r.status, 200);
  assert.equal(r.body.report.tables[0].totals.delivered, 2);
  assert.ok(r.body.labels.columns.goods);
  assert.equal((await call("/api/admin/reports/nope", { headers: { "x-role": "system_admin" }, query: Q })).status, 404);
  assert.equal((await call("/api/admin/reports/sales", { headers: { "x-role": "system_admin" }, query: { from: "x" } })).status, 400);
  assert.equal((await call("/api/admin/reports/sales", { headers: { "x-role": "system_admin" }, query: { ...Q, format: "exe" } })).status, 400);
  assert.equal((await call("/api/admin/reports/sales", { headers: { "x-role": "system_admin" }, query: { ...Q, storeId: "zzz" } })).status, 404);
});

test("admin: roles are enforced (support none, supervisor no finance, accountant finance)", async () => {
  const { call } = setup();
  const as = (role, p) => call(p, { headers: { "x-role": role }, query: Q }).then((r) => r.status);
  assert.equal(await as("support", "/api/admin/reports/sales"), 403);
  assert.equal(await as("support", "/api/admin/reports/payments"), 403);
  assert.equal(await as("order_supervisor", "/api/admin/reports/payments"), 403);
  assert.equal(await as("order_supervisor", "/api/admin/reports/sales"), 200);
  assert.equal(await as("accountant", "/api/admin/reports/payments"), 200);
  assert.equal(await as("accountant", "/api/admin/reports/reconcile"), 200);
  assert.equal(await as("driver_supervisor", "/api/admin/reports/drivers"), 200);
  assert.equal(await as("driver_supervisor", "/api/admin/reports/sales"), 403);
  const idx = await call("/api/admin/reports", { headers: { "x-role": "order_supervisor" } });
  const ids = idx.body.types.map((t) => t.id);
  assert.ok(ids.includes("sales") && !ids.includes("payments"));
});

test("admin: supervisor without finance.read gets sales without finance columns", async () => {
  const { call } = setup();
  const r = await call("/api/admin/reports/sales", { headers: { "x-role": "order_supervisor" }, query: Q });
  const keys = r.body.report.tables[0].columns.map((c) => c.key);
  assert.ok(!keys.includes("commission") && keys.includes("goods"));
});

test("STORE: sees only its own data; storeId in the query is ignored; no PII; no admin reports", async () => {
  const { call } = setup();
  const r = await call("/api/store/reports/sales", { headers: { "x-store": "s2" }, query: { ...Q, storeId: "s1" } });
  assert.equal(r.status, 200);
  assert.equal(r.body.report.tables[0].totals.goods, 50);
  const of = await call("/api/store/reports/order-financials", { headers: { "x-store": "s2" }, query: Q });
  const txt = JSON.stringify(of.body);
  assert.ok(!txt.includes("Secret Name") && !txt.includes("0600000000") && !txt.includes('"a"'));
  for (const t of ["payments", "drivers", "comparison", "reconcile", "driver-earnings"]) assert.equal((await call("/api/store/reports/" + t, { headers: { "x-store": "s2" }, query: Q })).status, 404, t);
  const idx = await call("/api/store/reports", { headers: { "x-store": "s2" } });
  assert.deepEqual(idx.body.stores, []);
});

test("DRIVER: only own earnings", async () => {
  const { call } = setup();
  const r = await call("/api/driver/reports/earnings", { headers: { "x-driver": "d2" }, query: Q });
  assert.equal(r.body.report.tables[0].totals.deliveries, 1);
  assert.equal(r.body.report.tables[0].totals.earnings, 10);
});

test("exports: content types, attachment names, audit entries; html is not an attachment", async () => {
  const { call, audit } = setup();
  const h = { "x-role": "system_admin" };
  const x = await call("/api/admin/reports/sales", { headers: h, query: { ...Q, format: "xlsx", lang: "ar" } });
  assert.match(x.hdr["Content-Type"], /spreadsheetml/);
  assert.match(x.hdr["Content-Disposition"], /siymon-sales-2026-10-01_2026-10-27\.xlsx/);
  assert.equal(x.hdr["Cache-Control"], "no-store");
  assert.equal((await call("/api/admin/reports/sales", { headers: h, query: { ...Q, format: "csv" } })).hdr["Content-Type"], "text/csv; charset=utf-8");
  const pdf = await call("/api/admin/reports/sales", { headers: h, query: { ...Q, format: "pdf", lang: "ar" } });
  assert.equal(pdf.hdr["X-Report-Lang"], "en");
  assert.ok(pdf.raw.subarray(0, 5).toString() === "%PDF-");
  const html = await call("/api/admin/reports/sales", { headers: h, query: { ...Q, format: "html", lang: "ar" } });
  assert.ok(!html.hdr["Content-Disposition"]);
  assert.match(html.hdr["Content-Security-Policy"], /default-src 'none'/);
  const exp = audit.filter((a) => a.action === "report.export");
  assert.equal(exp.length, 4);
  assert.equal(exp[0].actorId, "adm1");
  await call("/api/admin/reports/payments", { headers: h, query: Q });
  assert.ok(audit.some((a) => a.action === "report.view" && a.report === "payments")); // financial views are logged too
});

test("store exports are audited with the store id", async () => {
  const { call, audit } = setup();
  await call("/api/store/reports/sales", { headers: { "x-store": "s1" }, query: { ...Q, format: "csv" } });
  const e = audit.find((a) => a.action === "report.export");
  assert.equal(e.storeId, "s1");
  assert.equal(e.actorType, "store");
});

test("rate limit: exports are throttled per actor", async () => {
  const { call } = setup();
  const h = { "x-role": "system_admin" };
  let last;
  for (let i = 0; i < 21; i++) last = await call("/api/admin/reports/sales", { headers: h, query: { ...Q, format: "csv" } });
  assert.equal(last.status, 429);
  assert.equal(last.body.code, "RATE_LIMITED");
  // another actor is unaffected
  assert.equal((await call("/api/store/reports/sales", { headers: { "x-store": "s1" }, query: { ...Q, format: "csv" } })).status, 200);
});

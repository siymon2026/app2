"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const r = require("../lib/admin-roles");

const ok = (role, m, p) => r.authorize(role, m, p).ok;

test("legacy admin accounts (no role / 'admin') keep full access", () => {
  for (const role of [undefined, "", "admin", "system_admin"]) {
    assert.equal(ok(role, "DELETE", "/api/admin/restaurants/1"), true);
    assert.equal(ok(role, "PUT", "/api/config"), true);
    assert.equal(ok(role, "POST", "/api/admin/anything-new"), true);
  }
});

test("unknown role gets nothing, not even 'self' routes", () => {
  assert.equal(ok("hacker", "GET", "/api/admin/me"), false);
  assert.equal(ok("hacker", "GET", "/api/orders"), false);
});

test("deny-by-default: unlisted routes are system_admin only", () => {
  for (const role of ["order_supervisor", "driver_supervisor", "accountant", "support"]) {
    assert.equal(ok(role, "POST", "/api/admin/something-new"), false, role);
    assert.equal(ok(role, "GET", "/api/admin/audit-logs"), false, role);
    assert.equal(ok(role, "PUT", "/api/admin/plans"), false, role);
  }
});

test("no restricted role can manage staff, signup, config, impersonate stores or delete stores", () => {
  for (const role of ["order_supervisor", "driver_supervisor", "accountant", "support"]) {
    assert.equal(ok(role, "GET", "/api/admin/staff"), false);
    assert.equal(ok(role, "POST", "/api/admin/staff"), false);
    assert.equal(ok(role, "PATCH", "/api/admin/staff/abc"), false);
    assert.equal(ok(role, "POST", "/api/admin/signup"), false);
    assert.equal(ok(role, "PUT", "/api/config"), false);
    assert.equal(ok(role, "POST", "/api/admin/stores/s1/enter"), false);
    assert.equal(ok(role, "DELETE", "/api/admin/restaurants/s1"), false);
    assert.equal(ok(role, "PUT", "/api/admin/restaurants/s1"), false);
  }
});

test("accountant: money yes, drivers' private documents / dispatch / order edits no", () => {
  const a = "accountant";
  assert.equal(ok(a, "GET", "/api/admin/stores/s1/statement"), true);
  assert.equal(ok(a, "POST", "/api/admin/settlements"), true);
  assert.equal(ok(a, "POST", "/api/admin/settlements/x/void"), true);
  assert.equal(ok(a, "PUT", "/api/admin/stores/s1/commission"), true);
  assert.equal(ok(a, "POST", "/api/admin/drivers/d1/wallet-adjust"), true);
  assert.equal(ok(a, "PATCH", "/api/admin/topups/t1"), true);
  assert.equal(ok(a, "GET", "/api/admin/drivers/d1/image/idFront"), false);
  assert.equal(ok(a, "PATCH", "/api/admin/drivers/d1"), false);
  assert.equal(ok(a, "POST", "/api/admin/dispatch/settings"), false);
  assert.equal(ok(a, "PATCH", "/api/orders/o1"), false);
  assert.equal(ok(a, "GET", "/api/admin/support/c1"), false);
});

test("support: read-only operations plus customer chat; no money, no documents, no order changes", () => {
  const s = "support";
  assert.equal(ok(s, "GET", "/api/orders"), true);
  assert.equal(ok(s, "GET", "/api/admin/support/conversations"), true);
  assert.equal(ok(s, "POST", "/api/admin/support/c1"), true);
  assert.equal(ok(s, "GET", "/api/admin/customers"), true);
  assert.equal(ok(s, "PATCH", "/api/orders/o1"), false);
  assert.equal(ok(s, "GET", "/api/admin/settlements"), false);
  assert.equal(ok(s, "GET", "/api/admin/stores/s1/statement"), false);
  assert.equal(ok(s, "GET", "/api/admin/drivers/d1/image/idFront"), false);
  assert.equal(ok(s, "POST", "/api/admin/orders/o1/verify-exception"), false);
});

test("driver supervisor: reviews drivers and sees documents; no finance, no order edits", () => {
  const d = "driver_supervisor";
  assert.equal(ok(d, "GET", "/api/admin/drivers/d1/image/idFront"), true);
  assert.equal(ok(d, "PATCH", "/api/admin/drivers/d1"), true);
  assert.equal(ok(d, "POST", "/api/admin/dispatch/orders/o1/offer"), true);
  assert.equal(ok(d, "POST", "/api/admin/drivers/d1/wallet-adjust"), false);
  assert.equal(ok(d, "GET", "/api/admin/settlements"), false);
  assert.equal(ok(d, "PATCH", "/api/orders/o1"), false);
});

test("order supervisor: orders, exceptions, dispatch; no driver documents, no finance", () => {
  const o = "order_supervisor";
  assert.equal(ok(o, "PATCH", "/api/orders/o1"), true);
  assert.equal(ok(o, "POST", "/api/admin/orders/o1/verify-exception"), true);
  assert.equal(ok(o, "POST", "/api/admin/dispatch/orders/o1/reset"), true);
  assert.equal(ok(o, "GET", "/api/admin/drivers/d1/image/idBack"), false);
  assert.equal(ok(o, "PATCH", "/api/admin/drivers/d1"), false);
  assert.equal(ok(o, "POST", "/api/admin/settlements"), false);
  assert.equal(ok(o, "POST", "/api/admin/drivers/d1/wallet-adjust"), false);
});

test("method matters: same path, different method", () => {
  assert.equal(ok("accountant", "GET", "/api/admin/stores/s1/commission"), true);
  assert.equal(ok("support", "PUT", "/api/admin/stores/s1/commission"), false);
  assert.equal(ok("accountant", "DELETE", "/api/orders/o1"), false);
});

test("path normalisation: query string and trailing slash do not bypass or break rules", () => {
  assert.equal(ok("support", "GET", "/api/orders/?x=1"), true);
  assert.equal(ok("support", "PATCH", "/api/orders/o1/?force=1"), false);
  assert.equal(ok("support", "GET", "/api/orders/o1/../../admin/staff"), false);
});

test("permissionsOf lists a role's permissions", () => {
  assert.deepEqual(r.permissionsOf("admin"), ["*"]);
  assert.ok(r.permissionsOf("accountant").includes("finance.write"));
  assert.deepEqual(r.permissionsOf("nope"), []);
});

test("store review is system_admin only", () => {
  const A = require("../lib/admin-roles");
  const p = "/api/admin/stores/s1/review";
  assert.equal(A.authorize("system_admin", "PATCH", p).ok, true);
  for (const role of ["order_supervisor", "driver_supervisor", "accountant", "support"]) {
    assert.equal(A.authorize(role, "PATCH", p).ok, false, role);
  }
});

test("payment configuration: only system_admin (explicit permission payments.manage)", () => {
  const A = require("../lib/admin-roles");
  for (const [m, p] of [["GET", "/api/admin/payment-methods"], ["PUT", "/api/admin/payment-methods/cih"]]) {
    assert.equal(A.authorize("system_admin", m, p).ok, true);
    for (const role of ["order_supervisor", "driver_supervisor", "accountant", "support", "unknown", ""]) {
      if (role === "") continue; // legacy empty role == full admin by design
      assert.equal(A.authorize(role, m, p).ok, false, `${role} ${m}`);
    }
  }
  assert.equal(A.authorize("system_admin", "DELETE", "/api/admin/payment-methods/cih").ok, true); // full admin passes the gate; no delete route exists
});

test("support channels + store tickets: read for support staff, write only system_admin + support role", () => {
  const R = require("../lib/admin-roles");
  const az = (role, m, p) => R.authorize(role, m, p).ok;
  for (const role of ["system_admin", "support"]) {
    assert.equal(az(role, "POST", "/api/admin/support-channels"), true, role);
    assert.equal(az(role, "PUT", "/api/admin/support-channels/abc"), true, role);
    assert.equal(az(role, "DELETE", "/api/admin/support-channels/abc"), true, role);
    assert.equal(az(role, "GET", "/api/admin/store-support/tickets"), true, role);
    assert.equal(az(role, "POST", "/api/admin/store-support/tickets/TK-AAAAAAAA/messages"), true, role);
  }
  assert.equal(az("order_supervisor", "GET", "/api/admin/support-channels"), true, "may read");
  assert.equal(az("order_supervisor", "POST", "/api/admin/support-channels"), false, "may not edit contact numbers");
  assert.equal(az("order_supervisor", "DELETE", "/api/admin/support-channels/abc"), false);
  for (const role of ["accountant", "driver_supervisor"]) {
    assert.equal(az(role, "GET", "/api/admin/support-channels"), false, role);
    assert.equal(az(role, "GET", "/api/admin/store-support/tickets"), false, role);
  }
});

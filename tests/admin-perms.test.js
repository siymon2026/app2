"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const roles = require("../lib/admin-roles");
global.document = { readyState: "complete", getElementById() { return null; }, documentElement: {}, head: {} };
global.localStorage = { getItem() { return null; } };
global.setTimeout = global.setTimeout;
const P = require("../public/admin/admin-perms.js");

const all = new Set([...Object.values(roles.PERMISSIONS).flat(), ...roles.EXPLICIT_ONLY]);

test("every permission named by the UI exists on the server (or is '*')", () => {
  for (const p of [...Object.values(P.NAV), ...Object.keys(P.ACTIONS)]) {
    assert.ok(p === "*" || all.has(p), p);
  }
});

test("system_admin sees everything", () => {
  assert.deepEqual(P.hiddenFor(["*"]), []);
});

test("accountant: no dispatch / drivers review, keeps finance", () => {
  const h = P.hiddenFor(roles.permissionsOf("accountant")).join(" ");
  assert.match(h, /data-key="dispatch"/);
  assert.match(h, /approve-driver/);
  assert.match(h, /data-key="settings"/);
  assert.doesNotMatch(h, /data-key="topups"/);
  assert.doesNotMatch(h, /fnSaveComm/);
});

test("driver_supervisor can review drivers but not touch finance or stores", () => {
  const h = P.hiddenFor(roles.permissionsOf("driver_supervisor")).join(" ");
  assert.doesNotMatch(h, /approve-driver/);
  assert.doesNotMatch(h, /data-key="drivers"/);
  assert.match(h, /fnSaveComm/);
  assert.match(h, /review-store/);
  assert.match(h, /data-key="topups"/);
});

test("order action buttons are hidden for roles without orders.manage, kept for those with it", () => {
  const sup = P.hiddenFor(roles.permissionsOf("support")).join(" ");
  assert.match(sup, /data-action="accept"/);
  assert.match(sup, /data-action="done"/);
  assert.match(sup, /\[data-perm="orders\.manage"\]/);
  const ord = P.hiddenFor(roles.permissionsOf("order_supervisor")).join(" ");
  assert.doesNotMatch(ord, /data-action="accept"/);
  assert.doesNotMatch(ord, /\[data-perm="orders\.manage"\]/);
  assert.match(ord, /#restToggleBtn/, "restaurant open/close writes /api/config (system admin only)");
});

test("every UI-gated permission is also enforced by the server rule table", () => {
  assert.equal(roles.permissionFor("POST", "/api/print/wifi"), "orders.manage");
  assert.equal(roles.authorize("support", "POST", "/api/print/wifi").ok, false);
  assert.equal(roles.authorize("order_supervisor", "POST", "/api/print/wifi").ok, true);
  assert.equal(roles.authorize("support", "PATCH", "/api/orders/X").ok, false);
  assert.equal(roles.authorize("accountant", "GET", "/api/admin/store-types").ok, true);
  assert.equal(roles.authorize("driver_supervisor", "GET", "/api/admin/store-types").ok, false);
});

test("typed routes: pages restricted roles cannot use are refused by the client route guard data", () => {
  for (const k of ["settings", "menuManage", "notifications"]) assert.equal(P.ROUTE_PERM[k], "*");
  assert.equal(P.NAV.topups, "finance.read");
});

test("while permissions load, everything gated is hidden (no flash of forbidden UI)", () => {
  const h = P.allGated().join(" ");
  assert.match(h, /data-key="settings"/);
  assert.match(h, /data-key="topups"/);
  assert.match(h, /\[data-perm="orders\.manage"\]/);
});

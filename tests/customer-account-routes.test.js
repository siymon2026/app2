"use strict";
// Runs the REAL route block of server.js (section 15) against an in-memory fake
// `app` and stubbed storage. It verifies wiring + logic of the handlers; it is
// NOT a full HTTP test (express/node_modules are not installable offline).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const bcrypt = (() => { try { return require("bcryptjs"); } catch { return null; } })();

const src = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
const a = src.indexOf('app.patch("/api/customer/me", requireCustomer');
const b = src.indexOf('app.get("/api/customer/me", requireCustomer');
assert.ok(a > 0 && b > a, "route block markers found");
const block = src.slice(a, b);

function world(overrides = {}) {
  const db = {
    customers: { customers: [
      { id: "C1", firstName: "Ali", lastName: "K", email: "ali@x.com", phone: "0611111111", password: "pw:secret", walletBalance: 0, walletHistory: [] },
      { id: "C2", firstName: "Bob", lastName: "L", email: "bob@x.com", phone: "0622222222", password: "pw:secret", walletBalance: 0, walletHistory: [] },
    ] },
    orders: { orders: [
      { id: "O1", customerId: "C1", restaurantId: "S1", status: "done", createdAt: "t", total: 40, subtotal: 30, deliveryFee: 10, items: [{ id: "a", name: "A", qty: 2, price: 10 }, { id: "gone", name: "G", qty: 1, price: 10 }], customer: { name: "Ali", phone: "0611111111", addr: "x", lat: 1, lng: 2 }, verify: { salt: "s" } },
      { id: "O2", customerId: "C2", restaurantId: "S1", status: "done", total: 9, items: [], customer: { name: "Bob", phone: "0622222222", addr: "y" } },
      { id: "O3", customerId: "C1", restaurantId: "S1", status: "on_the_way", total: 5, items: [], customer: { phone: "0611111111" } },
      { id: "G1", customerId: null, status: "accepted", total: 12, items: [{ name: "A", qty: 1 }], customer: { name: "Guest", phone: "0633333333", addr: "z" }, driverId: "D" },
    ] },
    audit: [], tokens: { tokens: [{ userType: "customer", userId: "C1" }, { userType: "customer", userId: "C2" }] }, push: { subscriptions: [{ customerId: "C1" }] },
    store: { id: "S1", nameAr: "متجر" },
  };
  Object.assign(db, overrides);
  const handlers = {};
  const reg = (m) => (p, ...fns) => { handlers[m + " " + p] = fns[fns.length - 1]; };
  const app = { get: reg("GET"), post: reg("POST"), put: reg("PUT"), patch: reg("PATCH"), delete: reg("DELETE") };
  const catalogLib = require("../lib/catalog");
  const deps = {
    app, requireCustomer: () => {}, rateLimit: () => () => {}, customerAccount: require("../lib/customer-account"), catalogLib,
    storesLib: { blockedForSale: () => false },
    loadCustomers: () => db.customers, saveCustomers: () => {}, customerById: (d, id) => d.customers.find((c) => String(c.id) === String(id)),
    loadOrders: () => db.orders, saveOrders: () => {},
    getRestaurantById: (id) => (id === "S1" ? db.store : null),
    enforceRestaurantCanReceiveOrders: () => ({ ok: true }),
    loadMenu: () => db.menu || { items: [{ id: "a", restaurantId: "S1", name: "A", price: 12 }] },
    loadConfig: () => ({ currency: "MAD" }), safeCustomer: (c) => { const { password, ...r } = c; return r; },
    appendAuditLog: (e) => db.audit.push(e), verifyPassword: (p, rec) => rec === "pw:" + p,
    loadRefreshTokens: () => db.tokens, saveRefreshTokens: () => {}, loadPushSubscriptions: () => db.push, savePushSubscriptions: () => {},
  };
  new Function(...Object.keys(deps), block)(...Object.values(deps));
  return { db, handlers };
}
function call(h, { customerId = "C1", body = {}, params = {}, headers = {} } = {}) {
  const out = { status: 200, body: null };
  const res = { status(c) { out.status = c; return res; }, json(b) { out.body = b; return res; } };
  h({ customerId, body, params, header: (k) => headers[k] }, res);
  return out;
}

test("PATCH /me edits whitelisted fields only and detects duplicates", () => {
  const { db, handlers } = world();
  const h = handlers["PATCH /api/customer/me"];
  let r = call(h, { body: { firstName: "Ahmed", walletBalance: 999, id: "HACK" } });
  assert.equal(r.status, 200); assert.equal(r.body.customer.firstName, "Ahmed");
  assert.equal(db.customers.customers[0].walletBalance, 0); assert.equal(db.customers.customers[0].id, "C1");
  assert.equal(call(h, { body: { email: "bob@x.com" } }).status, 409);
  assert.equal(call(h, { body: { phone: "0622222222" } }).body.code, "DUPLICATE_PHONE");
  assert.equal(call(h, { body: {} }).status, 400);
  db.customers.customers[0].phoneVerifiedAt = "x";
  call(h, { body: { phone: "0699999999" } });
  assert.equal(db.customers.customers[0].phoneVerifiedAt, null);
  assert.ok(db.audit.some((e) => e.action === "customer.profile.contact_change"));
});

test("favorites are per account", () => {
  const { handlers } = world();
  const put = handlers["PUT /api/customer/favorites"], get = handlers["GET /api/customer/favorites"];
  assert.equal(call(put, { body: { favorites: "x" } }).status, 400);
  call(put, { body: { favorites: [{ type: "store", id: "S1" }] } });
  assert.equal(call(get).body.favorites.length, 1);
  assert.equal(call(get, { customerId: "C2" }).body.favorites.length, 0);
});

test("reorder re-prices from the live catalogue and hides other people's orders", () => {
  const { handlers } = world();
  const h = handlers["POST /api/customer/orders/:id/reorder"];
  const r = call(h, { params: { id: "O1" } });
  assert.equal(r.status, 200);
  assert.equal(r.body.items[0].price, 12); assert.equal(r.body.items[0].oldPrice, 10); assert.equal(r.body.items[0].priceChanged, true);
  assert.equal(r.body.unavailable[0].reason, "removed");
  assert.equal(call(h, { customerId: "C2", params: { id: "O1" } }).status, 404);
  assert.equal(call(h, { params: { id: "NOPE" } }).status, 404);
});

test("receipt: owner + delivered only, no internals", () => {
  const { handlers } = world();
  const h = handlers["GET /api/customer/orders/:id/receipt"];
  const ok = call(h, { params: { id: "O1" } });
  assert.equal(ok.status, 200); assert.equal(ok.body.receipt.total, 40); assert.equal(ok.body.receipt.store, "متجر");
  assert.equal(JSON.stringify(ok.body).includes("verify"), false);
  assert.equal(call(h, { params: { id: "O3" } }).status, 409);
  assert.equal(call(h, { customerId: "C2", params: { id: "O1" } }).status, 404);
});

test("tracking needs the private token; id/phone alone reveal nothing", () => {
  const ca = require("../lib/customer-account");
  const { db, handlers } = world();
  const { token, hash } = ca.newTrackingToken();
  db.orders.orders.find((o) => o.id === "G1").trackHash = hash;
  const h = handlers["GET /api/track/:id"];
  assert.equal(call(h, { params: { id: "G1" } }).status, 404);
  assert.equal(call(h, { params: { id: "G1" }, headers: { "X-Track-Token": "bad" } }).status, 404);
  const r = call(h, { params: { id: "G1" }, headers: { "X-Track-Token": token } });
  assert.equal(r.status, 200); assert.equal(r.body.order.status, "accepted");
  const t = JSON.stringify(r.body);
  assert.equal(t.includes("0633333333"), false); assert.equal(t.includes("trackHash"), false);
  assert.equal(call(h, { params: { id: "O1" }, headers: { "X-Track-Token": token } }).status, 404);
});

test("delete: re-auth, active-order and wallet guards, then anonymize but retain records", () => {
  const { db, handlers } = world();
  const h = handlers["DELETE /api/customer/me"];
  assert.equal(call(h, { body: { password: "wrong" } }).body.code, "REAUTH_REQUIRED");
  assert.equal(call(h, { body: { password: "secret" } }).body.code, "ACTIVE_ORDERS"); // O3 in progress
  db.orders.orders.find((o) => o.id === "O3").status = "done";
  db.customers.customers[0].walletBalance = 5;
  assert.equal(call(h, { body: { password: "secret" } }).body.code, "WALLET_BALANCE");
  db.customers.customers[0].walletBalance = 0;
  const r = call(h, { body: { password: "secret" } });
  assert.equal(r.status, 200); assert.equal(r.body.ordersRetained, 2);
  assert.equal(db.customers.customers.some((c) => c.id === "C1"), false);
  const tomb = db.customers.deletedCustomers[0];
  assert.equal(tomb.email, null); assert.equal(tomb.password, null);
  const o1 = db.orders.orders.find((o) => o.id === "O1");
  assert.equal(o1.total, 40); assert.equal(o1.customer.phone, ""); assert.equal(o1.items.length, 2);
  assert.equal(db.orders.orders.find((o) => o.id === "O2").customer.name, "Bob"); // others untouched
  assert.equal(db.tokens.tokens.some((t) => t.userId === "C1"), false); assert.equal(db.tokens.tokens.some((t) => t.userId === "C2"), true);
  assert.equal(db.push.subscriptions.length, 0);
  assert.ok(db.audit.some((e) => e.action === "customer.account.delete"));
});

test("Google-only accounts must type DELETE", () => {
  const { db, handlers } = world();
  Object.assign(db.customers.customers[1], { googleSub: "g", password: null });
  const h = handlers["DELETE /api/customer/me"];
  db.orders.orders = db.orders.orders.filter((o) => o.customerId !== "C2");
  assert.equal(call(h, { customerId: "C2", body: {} }).body.code, "REAUTH_REQUIRED");
  assert.equal(call(h, { customerId: "C2", body: { confirm: "DELETE" } }).status, 200);
});

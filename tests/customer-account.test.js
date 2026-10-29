"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const ca = require("../lib/customer-account");

const me = { id: "C1", phone: "0612345678" };
const victimOrder = { id: "O1", customer: { phone: "0612345678" }, status: "done" };

test("phone alone never grants access to order details", () => {
  assert.equal(ca.ownsOrder(victimOrder, me), false); // unverified phone
  assert.equal(ca.ordersOf([victimOrder], me).length, 0);
});
test("verified phone may claim only guest orders", () => {
  const v = { ...me, phoneVerifiedAt: "2026-01-01" };
  assert.equal(ca.ownsOrder(victimOrder, v), true);
  assert.equal(ca.ownsOrder({ ...victimOrder, customerId: "OTHER" }, v), false);
  assert.equal(ca.ownsOrder({ ...victimOrder, customerId: "C1" }, me), true);
});
test("profile edit validates and resets phone verification", () => {
  assert.equal(ca.sanitizeProfile({}, me).code, "EMPTY_PATCH");
  assert.equal(ca.sanitizeProfile({ email: "bad" }, me).code, "INVALID_EMAIL");
  assert.equal(ca.sanitizeProfile({ phone: "123" }, me).code, "INVALID_PHONE");
  assert.equal(ca.sanitizeProfile({ firstName: "  " }, me).code, "INVALID_FIRST_NAME");
  const r = ca.sanitizeProfile({ firstName: "<b>Ali</b>", phone: "0699 887 766" }, { ...me, phoneVerifiedAt: "x" });
  assert.equal(r.ok, true);
  assert.equal(r.patch.phone, "0699887766");
  assert.equal(r.patch.phoneVerifiedAt, null);
  assert.equal(r.phoneChanged, true);
  const same = ca.sanitizeProfile({ phone: "0612345678" }, { ...me, phoneVerifiedAt: "x" });
  assert.equal("phoneVerifiedAt" in same.patch, false);
});
test("profile cannot set privileged fields", () => {
  const r = ca.sanitizeProfile({ firstName: "A", walletBalance: 9999, password: "x", id: "Z" }, me);
  assert.deepEqual(Object.keys(r.patch), ["firstName"]);
});
test("conflict detection ignores self", () => {
  const list = [{ id: "C1", email: "a@x.com", phone: "0611111111" }, { id: "C2", email: "b@x.com", phone: "0622222222" }];
  assert.equal(ca.findConflict(list, "C1", { email: "b@x.com" }), "email");
  assert.equal(ca.findConflict(list, "C1", { phone: "0622222222" }), "phone");
  assert.equal(ca.findConflict(list, "C1", { email: "a@x.com" }), null);
});
test("favorites are cleaned, deduped and capped", () => {
  const out = ca.sanitizeFavorites([
    { type: "store", id: "S1" }, { type: "store", id: "S1" },
    { type: "item", id: "I1", storeId: "S1" }, { type: "item", id: "I2" },
    { type: "x", id: "1" }, null, { type: "store", id: "<s>" },
  ]);
  assert.deepEqual(out, [{ type: "store", id: "S1" }, { type: "item", id: "I1", storeId: "S1" }, { type: "store", id: "s" }]);
  const many = Array.from({ length: 300 }, (_, i) => ({ type: "store", id: "S" + i }));
  assert.equal(ca.sanitizeFavorites(many).length, ca.MAX_FAVORITES);
});
test("reorder re-prices and flags unavailable / out of stock / reduced qty", () => {
  const menu = new Map([
    ["a", { id: "a", price: 12, stock: null }],
    ["b", { id: "b", price: 5, stock: 0 }],
    ["c", { id: "c", price: 7, stock: 2 }],
    ["d", { id: "d", price: 3, hidden: true }],
  ]);
  const r = ca.buildReorder({
    order: { restaurantId: "S1", items: [
      { id: "a", name: "A", qty: 2, price: 10 }, { id: "b", name: "B", qty: 1, price: 5 },
      { id: "c", name: "C", qty: 5, price: 7 }, { id: "d", name: "D", qty: 1, price: 3 }, { id: "z", name: "Z", qty: 1, price: 1 } ] },
    byId: menu, nameOf: (s) => s.id.toUpperCase(),
    itemOrderable: (s) => !s.hidden, unitPrice: (s) => s.price,
  });
  assert.equal(r.ok, true);
  assert.equal(r.lines[0].price, 12); assert.equal(r.lines[0].priceChanged, true); assert.equal(r.lines[0].oldPrice, 10);
  assert.equal(r.lines[1].qty, 2); assert.equal(r.lines[1].qtyReduced, true);
  assert.deepEqual(r.unavailable.map((u) => u.reason), ["out_of_stock", "unavailable", "removed"]);
  assert.equal(r.subtotal, 2 * 12 + 2 * 7);
  assert.equal(ca.buildReorder({ order: { items: [{ id: "z", qty: 1 }] }, byId: menu, itemOrderable: () => true, unitPrice: (s) => s.price }).ok, false);
});
test("receipt only for delivered orders and leaks nothing internal", () => {
  assert.equal(ca.receiptOf({ id: "O", status: "accepted" }), null);
  const o = { id: "O", status: "done", createdAt: "t0", deliveredAt: "t1", subtotal: 30, deliveryFee: 10, total: 35, promo: { code: "P5", amount: 5 },
    items: [{ id: "a", name: "A", qty: 2, price: 15 }], customer: { name: "N", phone: "06", addr: "Addr" },
    verify: { salt: "s" }, financials: { commission: 3 }, driverId: "D", events: [{}], paymentMethod: "cod", payment: { walletAmount: 0 } };
  const r = ca.receiptOf(o, { storeName: "Shop" });
  assert.equal(r.total, 35); assert.equal(r.discount, 5); assert.equal(r.items[0].lineTotal, 30);
  const text = JSON.stringify(r);
  for (const bad of ["verify", "financials", "commission", "driverId", "events", "\"06\""]) assert.equal(text.includes(bad), false, bad);
});
test("tracking token: stored only as hash, constant-time check", () => {
  const { token, hash } = ca.newTrackingToken();
  const order = { id: "O", trackHash: hash };
  assert.equal(ca.checkTrackingToken(order, token), true);
  assert.equal(ca.checkTrackingToken(order, token + "x"), false);
  assert.equal(ca.checkTrackingToken(order, ""), false);
  assert.equal(ca.checkTrackingToken({ id: "O" }, token), false);
  assert.notEqual(hash, token);
});
test("tracking view exposes no phone, address or codes", () => {
  const v = ca.trackingView({ id: "O", status: "accepted", driverId: "D", total: 9, items: [{ name: "A", qty: 1 }],
    customer: { phone: "06", addr: "x" }, verify: { s: 1 }, deliveryCode: "123456" });
  const text = JSON.stringify(v);
  for (const bad of ["06", "addr", "verify", "123456", "\"D\""]) assert.equal(text.includes(bad), false, bad);
  assert.equal(v.driverAssigned, true);
});
test("active orders block deletion; anonymize removes PII but keeps money", () => {
  const c = { id: "C1", firstName: "A", lastName: "B", email: "a@b.c", phone: "0612345678", password: "h", walletBalance: 4, walletHistory: [{ ref: "r" }], addresses: [{}] };
  const orders = [{ id: "1", customerId: "C1", status: "on_the_way" }, { id: "2", customerId: "C1", status: "done" }];
  assert.equal(ca.activeOrders(orders, c).length, 1);
  const t = ca.anonymizeCustomer(c, "now");
  assert.equal(t.password, null); assert.equal(t.email, null); assert.equal(t.phone, null); assert.equal(t.deleted, true);
  assert.equal(t.walletBalance, 4); assert.deepEqual(t.addresses, []);
  const o = ca.anonymizeOrderPII({ id: "2", total: 20, customer: { name: "A", phone: "06", addr: "x", lat: 1, lng: 2 }, trackHash: "h" });
  assert.equal(o.total, 20); assert.equal(o.customer.phone, ""); assert.equal("lat" in o.customer, false); assert.equal("trackHash" in o, false);
});

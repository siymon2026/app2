"use strict";
const test = require("node:test");
const assert = require("node:assert");
const S = require("../lib/stores");

const types = S.mergeTypes({});
const T = (id) => S.getType(types, id);

test("12 default types; restaurant-like (restaurant/fastfood/pizza) keep admin_review, others direct", () => {
  assert.equal(types.length, 12);
  assert.equal(T("fastfood").flow, "admin_review");
  assert.equal(T("pizza").flow, "admin_review");
  assert.equal(T("restaurant").flow, "admin_review");
  assert.equal(T("pharmacy").flow, "direct");
  assert.equal(S.initialOrderStatus(T("restaurant")), "new");
  assert.equal(S.initialOrderStatus(T("grocery")), "admin_accepted");
});

test("unknown type falls back to restaurant", () => {
  assert.equal(S.getType(types, "nope").id, "restaurant");
});

test("mergeTypes: stored overrides seed, adds custom, can disable", () => {
  const m = S.mergeTypes({ types: [{ id: "cafe", enabled: false }, { id: "toys", name: { ar: "ألعاب" }, flow: "direct", sections: ["dashboard"], productFields: [] }] });
  assert.equal(m.find((t) => t.id === "cafe").enabled, false);
  assert.ok(m.find((t) => t.id === "toys"));
});

test("sanitizeType validates and always keeps dashboard", () => {
  const r = S.sanitizeType({ id: "Toys Shop", name: "ألعاب", flow: "direct", sections: ["orders", "bogus"], productFields: [{ key: "Age", kind: "number", min: 0, max: 18 }, { key: "x", kind: "select", options: [] }, { key: "age", kind: "text" }] });
  assert.ok(r.ok);
  assert.equal(r.type.id, "toys-shop");
  assert.deepEqual(r.type.sections, ["dashboard", "orders"]);
  assert.equal(r.type.productFields.length, 1); // empty select + duplicate dropped
  assert.equal(S.sanitizeType({ id: "a", name: "x", flow: "weird" }).ok, false);
  assert.equal(S.sanitizeType({ name: "x" }).ok, false);
});

test("canDeleteType: not built-in and no stores use it", () => {
  assert.equal(S.canDeleteType(T("cafe"), []), false);
  const custom = { id: "toys", builtin: false };
  assert.equal(S.canDeleteType(custom, [{ type: "toys" }]), false);
  assert.equal(S.canDeleteType(custom, [{ type: "cafe" }]), true);
});

test("validateAttrs per type: drops unknown keys, checks ranges/options", () => {
  const g = S.validateAttrs(T("greengrocer"), { unit: "kg", origin: "Agadir", hack: "x" });
  assert.deepEqual(g.attrs, { unit: "kg", origin: "Agadir" });
  assert.equal(S.validateAttrs(T("greengrocer"), { unit: "tonne" }).ok, false);
  assert.equal(S.validateAttrs(T("restaurant"), { prepTimeMin: -3 }).ok, false);
  assert.equal(S.validateAttrs(T("electronics"), { warrantyMonths: 24 }).attrs.warrantyMonths, 24);
});

test("pharmacy: controlled rejected, prescription blocked for online sale", () => {
  assert.equal(S.checkRegulated({ controlled: true }).ok, false);
  assert.equal(S.checkRegulated({ requiresPrescription: true }).blockedForSale, true);
  assert.equal(S.checkRegulated({}).blockedForSale, false);
  assert.equal(S.blockedForSale({ attrs: { requiresPrescription: true } }), true);
  assert.equal(S.blockedForSale({ attrs: {} }), false);
});

test("permissions: cashier cannot price/delete/see phone; owner can", () => {
  assert.equal(S.can("cashier", "products.price"), false);
  assert.equal(S.can("cashier", "customers.contact"), false);
  assert.equal(S.can("manager", "products.price"), true);
  assert.equal(S.can("manager", "settings.write"), false);
  assert.equal(S.can("owner", "products.delete"), true);
  assert.equal(S.can("ghost", "orders.read"), false);
});

test("orderForStore masks phone for cashier, strips payment details, doesn't mutate", () => {
  const o = { id: "1", customer: { name: "A", phone: "0612345678" }, paymentDetails: { card: "x" } };
  assert.equal(S.orderForStore(o, "cashier").customer.phone, "••••••5678");
  assert.equal(S.orderForStore(o, "owner").customer.phone, "0612345678");
  assert.equal(S.orderForStore(o, "owner").paymentDetails, undefined);
  assert.equal(o.customer.phone, "0612345678");
});

test("conversation only for a customer with an order at THIS store", () => {
  const o = { customerId: "c1", restaurantId: "r1" };
  assert.equal(S.canConverse(o, "r1"), true);
  assert.equal(S.canConverse(o, "r2"), false);
  assert.equal(S.canConverse({ restaurantId: "r1" }, "r1"), false);
  assert.equal(S.canConverse(null, "r1"), false);
});

test("messages: trim, cap, sender check, unread + markRead", () => {
  assert.equal(S.newMessage({ id: "m", from: "store", text: "   " }), null);
  assert.equal(S.newMessage({ id: "m", from: "admin", text: "hi" }), null);
  assert.equal(S.newMessage({ id: "m", from: "store", text: "x".repeat(5000) }).text.length, 1000);
  const conv = { messages: [S.newMessage({ id: "1", from: "customer", text: "hi" }), S.newMessage({ id: "2", from: "store", text: "yo" })] };
  assert.equal(S.unreadForStore(conv), 1);
  assert.equal(S.unreadForCustomer(conv), 1);
  assert.equal(S.markRead(conv, "store"), 1);
  assert.equal(S.unreadForStore(conv), 0);
  assert.equal(S.unreadForCustomer(conv), 1);
});

test("stats: scoped to store, real counts, value vs sales differ", () => {
  const d = (n) => new Date(Date.now() - n * 86400000).toISOString();
  const orders = [
    { restaurantId: "r1", status: "admin_accepted", total: 50, createdAt: d(0), customerId: "a" },
    { restaurantId: "r1", status: "delivered", total: 100, createdAt: d(1), customerId: "b" },
    { restaurantId: "r1", status: "canceled", total: 70, createdAt: d(1), customerId: "c" },
    { restaurantId: "r2", status: "delivered", total: 999, createdAt: d(1), customerId: "z" },
    { restaurantId: "r1", status: "delivered", total: 10, createdAt: d(40), customerId: "a" },
  ];
  const items = [
    { restaurantId: "r1", isAvailable: false },
    { restaurantId: "r1", stock: 2 },
    { restaurantId: "r1", stock: 50 },
    { restaurantId: "r1", archived: true, stock: 0 },
    { restaurantId: "r2", stock: 0 },
  ];
  const r = S.computeStoreStats({ orders, items, storeId: "r1", from: Date.now() - 7 * 86400000 });
  assert.equal(r.newOrders, 1);
  assert.equal(r.completedOrders, 1);
  assert.equal(r.sales, 100);
  assert.equal(r.ordersValue, 150);
  assert.equal(r.customers, 3);
  assert.equal(r.unavailableProducts, 1);
  assert.equal(r.lowStockProducts, 1);
  assert.equal(r.productsTotal, 3);
});

test("orderForStore exposes a platform-funded code as an explicit discount (ticket stays consistent)", () => {
  const o = { id: "1", subtotal: 100, deliveryFee: 10, total: 95, promo: { id: "p", code: "WELCOME10", amount: 15, fundedBy: "platform" } };
  const v = S.orderForStore(o, "owner");
  assert.equal(v.discount, 15);
  assert.equal(v.promoCode, "WELCOME10");
  assert.equal(v.promo, undefined);
  assert.equal(v.subtotal + v.deliveryFee - v.discount, v.total);
  assert.ok(o.promo, "input untouched");
});

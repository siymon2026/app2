"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const p = require("../lib/driver-privacy");
const NOW = Date.parse("2026-10-25T12:00:00Z");
const order = (x = {}) => ({
  id: "o1", status: "restaurant_ready", total: 50, deliveryFee: 10,
  customer: { name: "Ali", phone: "0600", addr: "rue 1", notes: "n", lat: 33.5, lng: -7.6 },
  deliveryPricing: { km: 3.2 }, ...x,
});

test("available list hides every customer detail but keeps km and money", () => {
  const o = order();
  const v = p.forAvailable(o);
  assert.deepEqual(v.customer, { withheld: true });
  assert.equal(v.dropoffKm, 3.2);
  assert.equal(v.total, 50);
  assert.ok(!JSON.stringify(v).includes("0600"));
  assert.ok(!JSON.stringify(v).includes("rue 1"));
  assert.equal(o.customer.phone, "0600"); // input untouched
});

test("no km when distance pricing was not used", () => {
  assert.equal(p.forAvailable(order({ deliveryPricing: undefined })).dropoffKm, null);
});

test("active orders keep full customer data", () => {
  const o = order({ status: "on_the_way", driverId: "d" });
  assert.equal(p.forMine(o, NOW), o);
});

test("finished orders keep data for 24h, then lose phone/address/notes/coords", () => {
  const recent = order({ status: "done", deliveredAt: new Date(NOW - 3600e3).toISOString() });
  assert.equal(p.forMine(recent, NOW), recent);
  const old = order({ status: "done", deliveredAt: new Date(NOW - 25 * 3600e3).toISOString() });
  const v = p.forMine(old, NOW);
  assert.deepEqual(v.customer, { name: "Ali", withheld: true });
  assert.equal(v.total, 50);
  assert.equal(old.customer.phone, "0600");
});

test("finished order with unknown date is treated as old only when a date exists", () => {
  const o = order({ status: "done" });
  assert.equal(p.forMine(o, NOW), o);
});

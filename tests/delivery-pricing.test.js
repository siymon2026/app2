"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const dp = require("../lib/delivery-pricing");

const store = { lat: 33.265, lng: -7.585, deliveryFee: 10, freeDeliveryOver: 200 };
const drop = { lat: 33.27, lng: -7.59 };
const dist = (over = {}) => dp.settingsFromConfig({ deliveryPricingMode: "distance", deliveryPricePerKm: 2, ...over });
const rs = (distance, provider = "osrm") => ({ route: async () => ({ distance, duration: 100, provider }) });
const failing = (msg) => ({ route: async () => { throw new Error(msg); } });

test("defaults: flat mode, no base fee, no per-km price", () => {
  const s = dp.settingsFromConfig({});
  assert.deepEqual(s, { mode: "flat", pricePerKm: 0, baseFee: 0, maxKm: 15 });
});

test("settings are clamped to safe bounds when read", () => {
  const s = dp.settingsFromConfig({ deliveryPricingMode: "bogus", deliveryPricePerKm: 9999, deliveryBaseFee: -5, deliveryMaxKm: 500 });
  assert.equal(s.mode, "flat");
  assert.equal(s.pricePerKm, 50);
  assert.equal(s.baseFee, 0);
  assert.equal(s.maxKm, 60);
});

test("admin update validation rejects out-of-range values instead of clamping", () => {
  assert.equal(dp.validateUpdate({ deliveryPricePerKm: 51 }).ok, false);
  assert.equal(dp.validateUpdate({ deliveryPricePerKm: -1 }).ok, false);
  assert.equal(dp.validateUpdate({ deliveryPricePerKm: "" }).ok, false);
  assert.equal(dp.validateUpdate({ deliveryPricingMode: "free" }).ok, false);
  assert.equal(dp.validateUpdate({ deliveryMaxKm: 0 }).ok, false);
  const ok = dp.validateUpdate({ deliveryPricingMode: "distance", deliveryPricePerKm: "2.5", deliveryBaseFee: 0 });
  assert.deepEqual(ok, { ok: true, values: { deliveryPricingMode: "distance", deliveryPricePerKm: 2.5, deliveryBaseFee: 0 } });
  assert.deepEqual(dp.validateUpdate({}), { ok: true, values: {} });
});

test("flat mode keeps legacy behavior including free-delivery threshold", async () => {
  const s = dp.settingsFromConfig({});
  assert.equal((await dp.quote({ settings: s, store, subtotal: 50 })).fee, 10);
  assert.equal((await dp.quote({ settings: s, store, subtotal: 250 })).fee, 0);
});

test("distance mode: fee = km * pricePerKm with no base fee", async () => {
  const q = await dp.quote({ settings: dist(), store, dropoff: drop, subtotal: 50, routeService: rs(3250) });
  assert.equal(q.ok, true);
  assert.equal(q.km, 3.25);
  assert.equal(q.fee, 6.5);
  assert.equal(q.snapshot.baseFee, 0);
  assert.equal(q.snapshot.pricePerKm, 2);
  assert.equal(q.snapshot.distanceM, 3250);
  assert.equal(q.snapshot.provider, "osrm");
});

test("distance mode: optional base fee and free-delivery threshold", async () => {
  const q = await dp.quote({ settings: dist({ deliveryBaseFee: 3 }), store, dropoff: drop, subtotal: 50, routeService: rs(1000) });
  assert.equal(q.fee, 5);
  const free = await dp.quote({ settings: dist(), store, dropoff: drop, subtotal: 200, routeService: rs(5000) });
  assert.equal(free.fee, 0);
  assert.equal(free.snapshot.feeBeforeFreeOver, 10);
});

test("missing store location or customer pin => explicit error, never a guess", async () => {
  const a = await dp.quote({ settings: dist(), store: { ...store, lat: undefined }, dropoff: drop, routeService: rs(1000) });
  assert.equal(a.code, "STORE_LOCATION_MISSING");
  for (const bad of [null, {}, { lat: 0, lng: 0 }, { lat: 95, lng: 10 }, { lat: "x", lng: 1 }]) {
    const b = await dp.quote({ settings: dist(), store, dropoff: bad, routeService: rs(1000) });
    assert.equal(b.code, "ADDRESS_LOCATION_REQUIRED");
    assert.equal(b.status, 422);
  }
});

test("routing failures return 503 and never fall back to straight line", async () => {
  for (const svc of [failing("route_unavailable"), failing("http_500"), null, {}, rs(NaN), rs(0), rs(-5)]) {
    const q = await dp.quote({ settings: dist(), store, dropoff: drop, routeService: svc });
    assert.equal(q.ok, false);
    assert.equal(q.status, 503);
    assert.equal(q.code, "ROUTING_UNAVAILABLE");
    assert.equal("fee" in q, false);
  }
});

test("too far (provider limit or configured max) is OUT_OF_RANGE", async () => {
  assert.equal((await dp.quote({ settings: dist(), store, dropoff: drop, routeService: failing("too_far") })).code, "OUT_OF_RANGE");
  const q = await dp.quote({ settings: dist({ deliveryMaxKm: 5 }), store, dropoff: drop, routeService: rs(5001) });
  assert.equal(q.code, "OUT_OF_RANGE");
  assert.equal((await dp.quote({ settings: dist({ deliveryMaxKm: 5 }), store, dropoff: drop, routeService: rs(5000) })).ok, true);
});

test("fee rounds to 2 decimals", async () => {
  const q = await dp.quote({ settings: dist({ deliveryPricePerKm: 2.33 }), store, dropoff: drop, routeService: rs(1234) });
  assert.equal(q.fee, 2.88); // 1.234 km * 2.33 = 2.8752
});

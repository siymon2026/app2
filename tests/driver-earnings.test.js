"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const de = require("../lib/driver-earnings");

test("defaults to legacy: earnings = delivery fee, no snapshot", () => {
  const s = de.settingsFromConfig({});
  assert.deepEqual(s, { mode: "delivery_fee", base: 0, perKm: 0 });
  assert.equal(de.snapshot({ deliveryFee: 12 }, s), null);
  assert.equal(de.earningOf({ deliveryFee: 12 }), 12);
  assert.equal(de.earningOf({}), 0);
});

test("legacy mode follows later fee edits (no snapshot to go stale)", () => {
  const o = { deliveryFee: 10 };
  o.deliveryFee = 15;
  assert.equal(de.earningOf(o), 15);
});

test("formula = base + road km * perKm, snapshotted with the rates used", () => {
  const s = de.settingsFromConfig({ driverEarningsMode: "formula", driverEarningBase: 5, driverEarningPerKm: 1.5 });
  const o = { deliveryFee: 99, deliveryPricing: { km: 4 } };
  const snap = de.snapshot(o, s, new Date("2026-10-24T10:00:00Z"));
  assert.equal(snap.amount, 11);
  assert.deepEqual([snap.base, snap.perKm, snap.km, snap.distanceMissing], [5, 1.5, 4, false]);
  o.driverEarnings = snap;
  assert.equal(de.earningOf(o), 11);
});

test("history is not rewritten by later setting changes", () => {
  const o = { deliveryFee: 8, deliveryPricing: { km: 2 } };
  o.driverEarnings = de.snapshot(o, de.settingsFromConfig({ driverEarningsMode: "formula", driverEarningBase: 3, driverEarningPerKm: 2 }));
  const before = de.earningOf(o);
  de.settingsFromConfig({ driverEarningsMode: "formula", driverEarningBase: 50, driverEarningPerKm: 50 });
  assert.equal(de.earningOf(o), before);
  assert.equal(before, 7);
});

test("no road distance => base only, never an invented distance", () => {
  const s = de.settingsFromConfig({ driverEarningsMode: "formula", driverEarningBase: 4, driverEarningPerKm: 3 });
  for (const o of [{}, { deliveryPricing: { mode: "flat" } }, { deliveryPricing: { km: 0 } }, { deliveryPricing: { km: "x" } }]) {
    const snap = de.snapshot(o, s);
    assert.equal(snap.amount, 4);
    assert.equal(snap.distanceMissing, true);
    assert.equal(snap.km, null);
  }
});

test("admin update validation: strict bounds, mode check", () => {
  assert.equal(de.validateUpdate({ driverEarningsMode: "bonus" }).ok, false);
  assert.equal(de.validateUpdate({ driverEarningBase: 201 }).ok, false);
  assert.equal(de.validateUpdate({ driverEarningPerKm: -1 }).ok, false);
  assert.equal(de.validateUpdate({ driverEarningPerKm: "" }).ok, false);
  assert.deepEqual(de.validateUpdate({ driverEarningsMode: "formula", driverEarningBase: "5", driverEarningPerKm: 1.5 }),
    { ok: true, values: { driverEarningsMode: "formula", driverEarningBase: 5, driverEarningPerKm: 1.5 } });
  assert.deepEqual(de.validateUpdate({}), { ok: true, values: {} });
});

test("settings read from config are clamped", () => {
  const s = de.settingsFromConfig({ driverEarningsMode: "x", driverEarningBase: 1e6, driverEarningPerKm: -3 });
  assert.deepEqual(s, { mode: "delivery_fee", base: 200, perKm: 0 });
});

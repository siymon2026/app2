"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const r = require("../lib/driver-review");

const docs = { idFront: "a", idBack: "b", faceWithBikeCard: "c" };
const drv = (extra = {}) => ({ id: "d1", status: "pending", images: { ...docs }, ...extra });
const NOW = new Date("2026-10-24T12:00:00Z");

test("uploading documents does not verify: new drivers stay pending", () => {
  assert.equal(r.statusOf(drv()), "pending");
  assert.equal(r.statusOf({}), "pending");
  assert.equal(r.statusOf({ status: "weird" }), "pending");
});

test("approval records reviewer, time and optional reason, and history", () => {
  const d = drv();
  const res = r.applyReview(d, { to: "approved", by: "adm1", now: NOW });
  assert.equal(res.ok, true);
  assert.deepEqual(d.review, { status: "approved", by: "adm1", at: NOW.toISOString(), reason: "" });
  assert.equal(d.reviewHistory.length, 1);
  assert.equal(d.approvedAt, NOW.toISOString());
  assert.deepEqual(res.warnings.sort(), ["license_missing", "vehicle_missing"]);
});

test("cannot approve without identity documents", () => {
  const d = drv({ images: { idFront: "a" } });
  const res = r.applyReview(d, { to: "approved", by: "x" });
  assert.equal(res.code, "MISSING_DOCUMENTS");
  assert.deepEqual(res.missing.sort(), ["faceWithBikeCard", "idBack"]);
  assert.equal(d.status, "pending");
  assert.equal(d.reviewHistory, undefined);
});

test("reject / suspend require a reason; approve does not", () => {
  for (const to of ["rejected"]) {
    assert.equal(r.applyReview(drv(), { to, by: "x", reason: "  " }).code, "REASON_REQUIRED");
    assert.equal(r.applyReview(drv(), { to, by: "x", reason: "ab" }).code, "REASON_REQUIRED");
  }
  const a = drv({ status: "approved" });
  assert.equal(r.applyReview(a, { to: "suspended", by: "x" }).code, "REASON_REQUIRED");
  assert.equal(a.status, "approved");
  assert.equal(r.applyReview(a, { to: "suspended", by: "x", reason: "complaints" }).ok, true);
  assert.equal(a.suspendedAt != null, true);
});

test("illegal transitions are refused", () => {
  assert.equal(r.applyReview(drv(), { to: "suspended", by: "x", reason: "nope" }).code, "ILLEGAL_TRANSITION");
  assert.equal(r.applyReview(drv({ status: "approved" }), { to: "pending", by: "x" }).code, "ILLEGAL_TRANSITION");
  assert.equal(r.applyReview(drv({ status: "approved" }), { to: "approved", by: "x" }).code, "NO_CHANGE");
  assert.equal(r.applyReview(drv(), { to: "banana", by: "x" }).code, "INVALID_STATUS");
});

test("suspended can be reinstated; leaving approved is flagged", () => {
  const d = drv({ status: "approved" });
  const s = r.applyReview(d, { to: "suspended", by: "a", reason: "fraud check" });
  assert.equal(s.leftApproved, true);
  const back = r.applyReview(d, { to: "approved", by: "a" });
  assert.equal(back.ok, true);
  assert.equal(d.suspendedAt, null);
  assert.equal(d.reviewHistory.length, 2);
});

test("history is bounded", () => {
  const d = drv();
  for (let i = 0; i < 80; i++) {
    r.applyReview(d, { to: d.status === "pending" ? "rejected" : "pending", by: "a", reason: "loop" });
  }
  assert.equal(d.reviewHistory.length, 50);
});

test("suspension releases accepted orders and flags in-delivery ones", () => {
  const orders = [
    { id: "1", driverId: "d1", status: "accepted", acceptedAt: "t" },
    { id: "2", driverId: "d1", status: "picked_up" },
    { id: "3", driverId: "d1", status: "on_the_way" },
    { id: "4", driverId: "d1", status: "delivered" },
    { id: "5", driverId: "d2", status: "accepted" },
  ];
  const out = r.handleSuspension(orders, "d1", { by: "adm", now: NOW });
  assert.deepEqual(out, { released: ["1"], keptActive: ["2", "3"] });
  assert.equal(orders[0].status, "restaurant_ready");
  assert.equal(orders[0].driverId, null);
  assert.equal(orders[0].events.at(-1).to, "restaurant_ready");
  assert.equal(orders[0].supervisorAlert.type, "driver_suspended_released");
  assert.equal(orders[1].status, "picked_up");
  assert.equal(orders[1].driverId, "d1");
  assert.equal(orders[1].supervisorAlert.type, "driver_suspended_in_delivery");
  assert.equal(orders[3].supervisorAlert, undefined);
  assert.equal(orders[4].status, "accepted");
});

test("a suspended driver may only finish orders already in their hands", () => {
  const d = { id: "d1", status: "suspended" };
  assert.equal(r.mayFinishDelivery(d, { driverId: "d1", status: "picked_up" }), true);
  assert.equal(r.mayFinishDelivery(d, { driverId: "d1", status: "on_the_way" }), true);
  assert.equal(r.mayFinishDelivery(d, { driverId: "d1", status: "accepted" }), false);
  assert.equal(r.mayFinishDelivery(d, { driverId: "d2", status: "on_the_way" }), false);
  assert.equal(r.mayFinishDelivery({ id: "d1", status: "rejected" }, { driverId: "d1", status: "on_the_way" }), false);
  assert.equal(r.mayFinishDelivery({ id: "d1", status: "pending" }, { driverId: "d1", status: "on_the_way" }), false);
});

"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const r = require("../lib/store-review");
const NOW = new Date("2026-10-24T12:00:00Z");
const store = (x = {}) => ({ id: "s1", name: { ar: "م" }, phone: "0600", address: "x", status: "active", isActive: true, ...x });

test("legacy stores without review count as approved", () => {
  assert.equal(r.statusOf(store()), "approved");
  assert.equal(r.statusOf({ review: { status: "bogus" } }), "approved");
});

test("new store starts pending and unpublished", () => {
  const s = r.initPending(store(), { by: "a", now: NOW });
  assert.equal(r.statusOf(s), "pending");
  assert.equal(s.status, "unpublished");
  assert.equal(s.isActive, false);
});

test("approval needs name/phone/address, records reviewer and restores status", () => {
  const s = r.initPending(store({ status: "paused" }), { by: "a", now: NOW });
  const bad = r.applyReview({ ...s, phone: "" }, { to: "approved", by: "b" });
  assert.equal(bad.code, "MISSING_INFO");
  assert.deepEqual(bad.missing, ["phone"]);
  const ok = r.applyReview(s, { to: "approved", by: "b", now: NOW });
  assert.equal(ok.ok, true);
  assert.equal(s.status, "paused");
  assert.equal(s.isActive, true);
  assert.deepEqual(s.review, { status: "approved", by: "b", at: NOW.toISOString(), reason: "" });
  assert.equal(s.reviewHistory.length, 2);
});

test("reject/suspend need a reason; illegal transitions refused", () => {
  const s = store();
  assert.equal(r.applyReview(s, { to: "suspended", by: "x", reason: " " }).code, "REASON_REQUIRED");
  assert.equal(r.applyReview(s, { to: "pending", by: "x" }).code, "ILLEGAL_TRANSITION");
  assert.equal(r.applyReview(s, { to: "approved", by: "x" }).code, "NO_CHANGE");
  assert.equal(r.applyReview(s, { to: "zzz", by: "x" }).code, "INVALID_STATUS");
  assert.equal(s.review, undefined);
});

test("suspension unpublishes, remembers status, re-approval restores it", () => {
  const s = store({ status: "paused" });
  const res = r.applyReview(s, { to: "suspended", by: "x", reason: "complaints", now: NOW });
  assert.equal(res.leftApproved, true);
  assert.equal(s.status, "unpublished");
  assert.equal(s.isActive, false);
  assert.equal(r.applyReview(s, { to: "approved", by: "x" }).ok, true);
  assert.equal(s.status, "paused");
});

test("rejected can be resubmitted as pending", () => {
  const s = r.initPending(store(), { by: "a" });
  assert.equal(r.applyReview(s, { to: "rejected", by: "x", reason: "bad docs" }).ok, true);
  assert.equal(r.applyReview(s, { to: "pending", by: "x" }).ok, true);
});

test("handleSuspension cancels untouched orders, flags started ones, ignores others", () => {
  const orders = [
    { id: "1", restaurantId: "s1", status: "admin_accepted" },
    { id: "2", restaurantId: "s1", status: "admin_accepted", storeAcceptedAt: "t" },
    { id: "3", restaurantId: "s1", status: "on_the_way" },
    { id: "4", restaurantId: "s1", status: "done" },
    { id: "5", restaurantId: "other", status: "admin_accepted" },
  ];
  const h = r.handleSuspension(orders, "s1", { by: "x", reason: "r", now: NOW });
  assert.deepEqual(h.cancelled, ["1"]);
  assert.deepEqual(h.flagged.sort(), ["2", "3"]);
  assert.equal(orders[0].status, "canceled");
  assert.equal(orders[0].events[0].to, "canceled");
  assert.equal(orders[1].status, "admin_accepted");
  assert.equal(orders[3].status, "done");
  assert.equal(orders[4].status, "admin_accepted");
});

"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const s = require("../lib/order-state");

test("normal driver flow is allowed step by step", () => {
  for (const [f, t] of [["accepted", "picked_up"], ["picked_up", "on_the_way"], ["on_the_way", "delivered"], ["delivered", "done"]]) {
    assert.deepEqual(s.checkDriverTransition(f, t), { ok: true, noop: false });
  }
});

test("steps cannot be skipped", () => {
  for (const [f, t] of [["accepted", "delivered"], ["accepted", "on_the_way"], ["picked_up", "delivered"], ["accepted", "done"]]) {
    const r = s.checkDriverTransition(f, t);
    assert.equal(r.ok, false);
    assert.equal(r.code, "ILLEGAL_TRANSITION");
  }
});

test("finished orders cannot be rewound or reopened", () => {
  for (const f of ["done", "canceled", "cancelled"]) {
    assert.equal(s.checkDriverTransition(f, "accepted").code, "ORDER_CLOSED");
    assert.equal(s.checkDriverTransition(f, "delivered").code, "ORDER_CLOSED");
  }
  assert.equal(s.checkDriverTransition("delivered", "accepted").code, "ILLEGAL_TRANSITION");
  assert.equal(s.checkDriverTransition("delivered", "canceled").code, "ILLEGAL_TRANSITION");
});

test("pre-assignment states are not driver-controllable", () => {
  for (const f of ["new", "admin_accepted", "restaurant_ready", ""]) {
    assert.equal(s.checkDriverTransition(f, "picked_up").ok, false);
    assert.equal(s.checkDriverTransition(f, "delivered").ok, false);
  }
});

test("repeating the same status is an idempotent no-op", () => {
  assert.deepEqual(s.checkDriverTransition("delivered", "delivered"), { ok: true, noop: true });
  assert.deepEqual(s.checkDriverTransition("on_the_way", "on_the_way"), { ok: true, noop: true });
});

test("event history is appended and bounded", () => {
  const o = {};
  for (let i = 0; i < 250; i++) s.recordEvent(o, { from: "a", to: "b", actorType: "driver", actorId: i });
  assert.equal(o.events.length, 200);
  assert.equal(o.events.at(-1).actorId, "249");
  assert.deepEqual(Object.keys(o.events[0]).sort(), ["actorId", "actorType", "at", "from", "to"]);
});

test("admin transitions: no skipping, no reopening, no sending to drivers", () => {
  assert.equal(s.checkAdminTransition("new", "admin_accepted").ok, true);
  assert.equal(s.checkAdminTransition("accepted", "delivered").code, "ILLEGAL_TRANSITION");
  assert.equal(s.checkAdminTransition("admin_accepted", "restaurant_ready").code, "ILLEGAL_TRANSITION");
  assert.equal(s.checkAdminTransition("delivered", "accepted").code, "ILLEGAL_TRANSITION");
  assert.equal(s.checkAdminTransition("canceled", "new").code, "ORDER_CLOSED");
  assert.equal(s.checkAdminTransition("done", "canceled").code, "ORDER_CLOSED");
  assert.equal(s.checkAdminTransition("on_the_way", "canceled").ok, true);
  assert.deepEqual(s.checkAdminTransition("done", "done"), { ok: true, noop: true });
});

test("customer can cancel only before the store accepts", () => {
  assert.equal(s.canCustomerCancel({ status: "new" }).ok, true);
  assert.equal(s.canCustomerCancel({ status: "admin_accepted" }).ok, true);
  assert.equal(s.canCustomerCancel({ status: "admin_accepted", storeAcceptedAt: "x" }).code, "CANCEL_NOT_ALLOWED");
  for (const st of ["restaurant_ready", "accepted", "picked_up", "on_the_way"]) {
    assert.equal(s.canCustomerCancel({ status: st }).code, "CANCEL_NOT_ALLOWED");
  }
  for (const st of ["delivered", "done", "canceled"]) {
    assert.equal(s.canCustomerCancel({ status: st }).code, "ORDER_CLOSED");
  }
});

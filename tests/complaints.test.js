"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../lib/complaints");

const T0 = Date.parse("2026-10-27T12:00:00Z");
const H = 3600e3;
const order = (o = {}) => ({ id: "o1", status: "delivered", restaurantId: "s1", driverId: "d1", customerId: "c1", deliveredAt: new Date(T0 - H).toISOString(), ...o });
const value = (o = {}) => ({ orderId: "o1", against: "store", category: "missing_items", text: "The fries were missing from my bag", ...o });
const mk = (against = "store", over = {}) => C.create({ id: "CP-TEST0001", order: order(), customerId: "c1", value: C.validateComplaint(value({ against })).value, now: T0, ...over });
const store = { role: "store", id: "s1" };

test("validation: order, target, category and a real description are required", () => {
  assert.equal(C.validateComplaint(value({ orderId: "" })).code, "ORDER_REQUIRED");
  assert.equal(C.validateComplaint(value({ against: "moon" })).code, "INVALID_AGAINST");
  assert.equal(C.validateComplaint(value({ category: "x" })).code, "INVALID_CATEGORY");
  assert.equal(C.validateComplaint(value({ text: "bad" })).code, "TEXT_TOO_SHORT");
  const ok = C.validateComplaint(value({ text: "<script>alert(1)</script> missing the drink please", clientId: "abc-123456" }));
  assert.ok(ok.ok && !/[<>]/.test(ok.value.text) && ok.value.clientId === "abc-123456");
});

test("canFile: only accepted orders, matching target, 30-day window", () => {
  assert.equal(C.canFile(order(), "store", T0).ok, true);
  assert.equal(C.canFile(order({ status: "new" }), "store", T0).code, "ORDER_NOT_ACTIVE");
  assert.equal(C.canFile(order({ driverId: null }), "driver", T0).code, "NO_DRIVER");
  assert.equal(C.canFile(order({ restaurantId: "" }), "store", T0).code, "NO_STORE");
  assert.equal(C.canFile(order({ deliveredAt: new Date(T0 - 31 * 24 * H).toISOString() }), "store", T0).code, "WINDOW_EXPIRED");
  assert.equal(C.canFile(order({ driverId: null }), "platform", T0).ok, true);
  assert.equal(C.canFile(null, "store", T0).code, "ORDER_NOT_FOUND");
});

test("store/driver complaints go to the party FIRST with a deadline; platform ones go straight to the supervisor", () => {
  const s = mk("store");
  assert.deepEqual([s.status, s.responsible.role, s.responsible.id], ["with_party", "store", "s1"]);
  assert.equal(Date.parse(s.respondBy) - T0, 24 * H);
  const d = mk("driver");
  assert.deepEqual([d.status, d.responsible.role, d.responsible.id], ["with_party", "driver", "d1"]);
  const p = mk("platform");
  assert.deepEqual([p.status, p.responsible.role, p.respondBy], ["escalated", "supervisor", null]);
});

test("happy path: party answers, customer accepts => resolved with a recorded outcome", () => {
  const c = mk();
  assert.equal(C.partyRespond(c, { party: store, text: "ok", now: T0 + H }).code, "TEXT_REQUIRED");
  const r = C.partyRespond(c, { party: store, text: "Sorry, we will send the fries again", now: T0 + H });
  assert.equal(r.ok, true);
  assert.equal(c.status, "party_responded");
  assert.ok(c.replyBy);
  assert.equal(C.partyRespond(c, { party: store, text: "second answer", now: T0 + H }).code, "NOT_AWAITING_PARTY", "one answer per round");
  assert.equal(C.customerAccept(c, { actor: { id: "c1" }, now: T0 + 2 * H }).ok, true);
  assert.equal(c.status, "resolved");
  assert.deepEqual([c.resolution.outcome, c.resolution.by.role], ["resolved_by_party", "customer"]);
  assert.equal(C.customerAccept(c, {}).code, "COMPLAINT_CLOSED");
});

test("only the responsible party can answer", () => {
  const c = mk("store");
  assert.equal(C.partyRespond(c, { party: { role: "store", id: "s2" }, text: "not mine" }).code, "NOT_RESPONSIBLE");
  assert.equal(C.partyRespond(c, { party: { role: "driver", id: "d1" }, text: "not mine" }).code, "NOT_RESPONSIBLE");
  assert.equal(c.status, "with_party");
});

test("customer can escalate (reason required) after an answer or while waiting; escalated goes to the supervisor", () => {
  const c = mk();
  assert.equal(C.customerEscalate(c, { reason: "" }).code, "REASON_REQUIRED");
  C.partyRespond(c, { party: store, text: "we disagree with you", now: T0 + H });
  assert.equal(C.customerEscalate(c, { reason: "Not solved, still missing", actor: { id: "c1" }, now: T0 + 2 * H }).ok, true);
  assert.deepEqual([c.status, c.responsible.role, c.respondBy, c.replyBy], ["escalated", "supervisor", null, null]);
  assert.equal(C.customerEscalate(c, { reason: "again please" }).code, "ALREADY_ESCALATED");
  assert.equal(C.customerWithdraw(c, {}).code, "WITH_SUPERVISOR");
});

test("deadlines: silent party => automatic escalation; silent customer => closed as no_customer_reply; both recorded", () => {
  const c = mk();
  assert.equal(C.age(c, { now: T0 + 23 * H }), null);
  assert.equal(C.age(c, { now: T0 + 24 * H }), "escalated");
  assert.equal(c.status, "escalated");
  assert.equal(c.timeline.at(-1).kind, "auto_escalated");
  assert.equal(C.age(c, { now: T0 + 99 * H }), null, "idempotent");

  const d = mk();
  C.partyRespond(d, { party: store, text: "we replaced it", now: T0 + H });
  assert.equal(C.age(d, { now: T0 + H + 71 * H }), null);
  assert.equal(C.age(d, { now: T0 + H + 72 * H }), "auto_resolved");
  assert.deepEqual([d.status, d.resolution.outcome, d.resolution.by.role], ["resolved", "no_customer_reply", "system"]);
});

test("a complaint can never be closed without a recorded resolution (outcome + note)", () => {
  const c = mk("platform");
  assert.equal(C.supervisorResolve(c, { outcome: "", note: "x" }).code, "RESOLUTION_REQUIRED");
  assert.equal(C.supervisorResolve(c, { outcome: "fixed", note: "" }).code, "RESOLUTION_REQUIRED");
  assert.equal(C.supervisorResolve(c, { outcome: "banana", note: "something" }).code, "RESOLUTION_REQUIRED");
  assert.equal(c.status, "escalated");
  assert.equal(C.supervisorTake(c, { actor: { id: "a1", role: "support" }, now: T0 }).ok, true);
  assert.deepEqual([c.status, c.responsible.id], ["in_review", "a1"]);
  assert.equal(C.supervisorResolve(c, { outcome: "compensated", note: "Credit agreed by phone", actor: { id: "a1", role: "support" }, now: T0 + H }).ok, true);
  assert.equal(c.resolution.by.id, "a1");
  assert.equal(C.addInternalNote(c, { text: "late note" }).code, "COMPLAINT_CLOSED");
  assert.equal(C.supervisorTake(mk("store"), { actor: {} }).code, "NOT_ESCALATED");
});

test("customer and party never see internal supervisor notes; party view carries no customer identity", () => {
  const c = mk("platform");
  C.addInternalNote(c, { text: "customer is a repeat complainer, be careful", actor: { id: "a1", role: "support" }, now: T0 });
  C.addPublicNote(c, { text: "We are looking into it", actor: { id: "a1" }, now: T0 });
  const cv = JSON.stringify(C.customerView(c)), pv = JSON.stringify(C.partyView(c));
  assert.ok(!cv.includes("repeat complainer") && !pv.includes("repeat complainer"));
  assert.ok(cv.includes("looking into it"));
  assert.ok(!pv.includes("c1"), "customer id is not exposed to the party");
  assert.ok(!("customerId" in C.partyView(c)));
  assert.ok(JSON.stringify(C.adminDetail(c)).includes("repeat complainer"), "supervisor sees everything");
});

test("limits: idempotent by clientId, one open complaint per (order,target), per-customer cap", () => {
  const a = mk("store"); a.clientId = "client-0001";
  assert.ok(C.checkLimits([a], { customerId: "c1", orderId: "o1", against: "store", clientId: "client-0001" }).duplicate);
  assert.equal(C.checkLimits([a], { customerId: "c1", orderId: "o1", against: "store", clientId: null }).code, "ALREADY_OPEN");
  assert.equal(C.checkLimits([a], { customerId: "c1", orderId: "o1", against: "driver", clientId: null }).ok, true);
  const many = Array.from({ length: C.LIMITS.openPerCustomer }, (_, i) => ({ ...mk("store"), id: "CP-" + i, orderId: "x" + i }));
  assert.equal(C.checkLimits(many, { customerId: "c1", orderId: "new", against: "store" }).code, "TOO_MANY_OPEN");
  a.status = "resolved";
  assert.equal(C.checkLimits([a], { customerId: "c1", orderId: "o1", against: "store" }).ok, true, "a resolved one does not block a new complaint");
});

test("settings are bounded and out-of-range values are rejected, never silently clamped", () => {
  assert.deepEqual(C.clampSettings({ partyResponseHours: 99999, customerReplyHours: 1 }), { partyResponseHours: 168, customerReplyHours: 12 });
  assert.equal(C.validateSettingsPatch({ partyResponseHours: 0 }).code, "OUT_OF_RANGE");
  assert.equal(C.validateSettingsPatch({ nope: 1 }).code, "UNKNOWN_SETTING");
  assert.equal(C.validateSettingsPatch({}).code, "EMPTY");
  assert.deepEqual(C.validateSettingsPatch({ partyResponseHours: 12 }).value, { partyResponseHours: 12 });
  const c = mk("store", { settings: { partyResponseHours: 2 } });
  assert.equal(Date.parse(c.respondBy) - T0, 2 * H);
});

test("filter + counts for the supervisor list", () => {
  const list = [mk("store"), { ...mk("platform"), id: "CP-TEST0002" }, { ...mk("driver"), id: "CP-TEST0003", status: "resolved" }];
  assert.equal(C.counts(list).open, 2);
  assert.equal(C.filter(list, { status: "open" }).length, 2);
  assert.equal(C.filter(list, { against: "driver" }).length, 1);
  assert.equal(C.filter(list, { status: "escalated" })[0].id, "CP-TEST0002");
  assert.equal(C.filter(list, { q: "cp-test0003" }).length, 1);
});

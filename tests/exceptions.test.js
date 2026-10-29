"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const X = require("../lib/exceptions");

const NOW = Date.parse("2026-10-27T12:00:00Z");
const minAgo = (m) => new Date(NOW - m * 60000).toISOString();
const mk = (o = {}) => X.createCase({ type: "failed_delivery", orderId: "o1", reason: "customer not answering", ...o }, { id: "EX-1", now: NOW }).case;
const actor = { id: "a1", role: "order_supervisor", name: "Sara" };

test("createCase validates type, reason and order", () => {
  assert.equal(X.createCase({ type: "nope", orderId: "o1", reason: "x" }).code, "INVALID_TYPE");
  assert.equal(X.createCase({ type: "rejected_order", orderId: "o1", reason: " " }).code, "REASON_REQUIRED");
  assert.equal(X.createCase({ type: "rejected_order", reason: "x" }).code, "ORDER_REQUIRED");
  assert.equal(X.createCase({ type: "payment_error", reason: "webhook mismatch" }).ok, true); // payments may have no order
});

test("new case has state, priority, responsible party, reason and first timeline entry", () => {
  const c = mk();
  assert.equal(c.status, "open");
  assert.equal(c.priority, "high");
  assert.equal(c.responsible.role, "supervisor");
  assert.deepEqual(c.reasons, ["customer not answering"]);
  assert.equal(c.timeline.length, 1);
  assert.equal(c.timeline[0].kind, "opened");
  assert.equal(c.resolution, null);
});

test("a case cannot be closed without outcome and note", () => {
  const c = mk();
  assert.equal(X.resolve(c, {}, { actor, now: NOW }).code, "RESOLUTION_REQUIRED");
  assert.equal(X.resolve(c, { outcome: "fixed" }, { actor, now: NOW }).code, "RESOLUTION_REQUIRED");
  assert.equal(X.resolve(c, { outcome: "fixed", note: "  " }, { actor, now: NOW }).code, "RESOLUTION_REQUIRED");
  assert.equal(X.resolve(c, { outcome: "made-up", note: "ok done" }, { actor, now: NOW }).code, "RESOLUTION_REQUIRED");
  assert.equal(c.status, "open");
  assert.equal(c.resolution, null);
});

test("resolve records outcome, note, who and when; resolved is final", () => {
  const c = mk();
  const r = X.resolve(c, { outcome: "redelivered", note: "delivered next day" }, { actor, now: NOW });
  assert.equal(r.ok, true);
  assert.equal(c.status, "resolved");
  assert.equal(c.resolution.outcome, "redelivered");
  assert.equal(c.resolution.by, "a1");
  assert.equal(c.resolution.at, new Date(NOW).toISOString());
  const before = c.timeline.length;
  for (const r2 of [X.resolve(c, { outcome: "fixed", note: "again" }), X.escalate(c, "support", "x"), X.assign(c, { role: "support" }),
    X.recordContact(c, "store", "hello"), X.addReason(c, "more"), X.setPriority(c, "low"), X.recordFailedAttempt(c, "x"), X.recordReassign(c, {})]) {
    assert.equal(r2.code, "CASE_CLOSED");
    assert.equal(r2.status, 409);
  }
  assert.equal(c.timeline.length, before); // nothing appended after closure
});

test("timeline is append-only and records every action", () => {
  const c = mk();
  X.assign(c, { role: "supervisor", id: "a1", name: "Sara" }, { actor, now: NOW });
  X.recordContact(c, "customer", "called, no answer", { actor, now: NOW });
  X.escalate(c, "support", "customer dispute", { actor, now: NOW });
  assert.deepEqual(c.timeline.map((e) => e.kind), ["opened", "assigned", "contact", "escalated"]);
  assert.deepEqual(c.actions.map((a) => a.kind), ["assign", "contact", "escalate"]);
  assert.equal(c.status, "escalated");
  assert.equal(c.responsible.role, "support");
});

test("contact validates party and note", () => {
  const c = mk();
  assert.equal(X.recordContact(c, "alien", "x").code, "INVALID_PARTY");
  assert.equal(X.recordContact(c, "store", "").code, "NOTE_REQUIRED");
  assert.equal(c.timeline.length, 1);
});

test("escalate validates target and reason, and raises low priority", () => {
  const c = mk({ priority: "low" });
  assert.equal(X.escalate(c, "nobody", "x").code, "INVALID_TARGET");
  assert.equal(X.escalate(c, "accounting", "").code, "REASON_REQUIRED");
  assert.equal(X.escalate(c, "accounting", "refund needs approval", { actor, now: NOW }).ok, true);
  assert.equal(c.priority, "high");
  assert.equal(c.responsible.role, "accounting");
});

test("failed delivery: redeliver within configured attempts, then escalate to supervisor", () => {
  const c = mk({ maxRedelivery: 2 });
  assert.equal(X.recordFailedAttempt(c, "").code, "REASON_REQUIRED");
  let r = X.recordFailedAttempt(c, "no answer", { actor, now: NOW });
  assert.equal(r.decision, "redeliver");
  assert.equal(c.status, "in_progress");
  r = X.recordFailedAttempt(c, "wrong address", { actor, now: NOW });
  assert.equal(r.decision, "redeliver");
  r = X.recordFailedAttempt(c, "phone off", { actor, now: NOW });
  assert.equal(r.decision, "escalate");
  assert.equal(c.status, "escalated");
  assert.equal(c.priority, "urgent");
  assert.equal(c.responsible.role, "supervisor");
  assert.equal(c.redelivery.attempts, 3);
  assert.deepEqual(c.reasons, ["customer not answering", "no answer", "wrong address", "phone off"]);
});

test("zero redelivery attempts escalates immediately", () => {
  const c = mk();
  assert.equal(X.recordFailedAttempt(c, "refused", { maxAttempts: 0, now: NOW }).decision, "escalate");
});

test("reassign records success and failure honestly", () => {
  const c = mk({ type: "driver_failure" });
  X.recordReassign(c, { fromDriverId: "d1", ok: false, error: "no_candidates", actor, now: NOW });
  assert.equal(c.actions.at(-1).ok, false);
  assert.equal(c.status, "open");
  X.recordReassign(c, { fromDriverId: "d1", ok: true, actor, now: NOW });
  assert.equal(c.status, "in_progress");
});

test("settings are clamped to safe bounds; patch validation rejects out-of-range", () => {
  assert.equal(X.clampSettings({ prepDelayMin: 1 }).prepDelayMin, 3);
  assert.equal(X.clampSettings({ prepDelayMin: 99999 }).prepDelayMin, 240);
  assert.equal(X.clampSettings({ maxRedeliveryAttempts: "x" }).maxRedeliveryAttempts, X.DEFAULTS.maxRedeliveryAttempts);
  assert.equal(X.validateSettingsPatch({ prepDelayMin: 1 }).code, "OUT_OF_RANGE");
  assert.equal(X.validateSettingsPatch({ hack: 1 }).code, "UNKNOWN_SETTING");
  assert.equal(X.validateSettingsPatch({}).code, "EMPTY");
  assert.deepEqual(X.validateSettingsPatch({ maxRedeliveryAttempts: 3 }).value, { maxRedeliveryAttempts: 3 });
});

test("detect: delayed preparation uses store acceptance time and expected prep time", () => {
  const o = { id: "o1", status: "admin_accepted", storeAcceptedAt: minAgo(20), storeId: "s1" };
  assert.equal(X.detect([o], { now: NOW })[0].type, "delayed_preparation");
  assert.equal(X.detect([{ ...o, storeAcceptedAt: minAgo(10) }], { now: NOW }).length, 0);
  assert.equal(X.detect([{ ...o, prepMinutes: 30 }], { now: NOW }).length, 0); // 20 < 30 + 15
  assert.equal(X.detect([{ ...o, status: "restaurant_ready" }], { now: NOW }).filter((c) => c.type === "delayed_preparation").length, 0);
});

test("detect: unassigned only when released to drivers with no driver", () => {
  const o = { id: "o2", status: "restaurant_ready", readyAt: minAgo(8) };
  assert.equal(X.detect([o], { now: NOW })[0].type, "unassigned_order");
  assert.equal(X.detect([{ ...o, driverId: "d1" }], { now: NOW }).length, 0);
  assert.equal(X.detect([{ ...o, readyAt: minAgo(2) }], { now: NOW }).length, 0);
});

test("detect: store rejection, failed delivery, payment error — and nothing for healthy orders", () => {
  const list = [
    { id: "a", status: "canceled", canceledBy: "store", rejectReason: "out of stock" },
    { id: "b", status: "failed_delivery", deliveryFailReason: "no answer" },
    { id: "c", status: "new", paymentError: "amount mismatch" },
    { id: "d", status: "canceled", canceledBy: "customer" },
    { id: "e", status: "done" },
  ];
  const got = X.detect(list, { now: NOW }).map((c) => c.type + ":" + c.orderId).sort();
  assert.deepEqual(got, ["failed_delivery:b", "payment_error:c", "rejected_order:a"]);
  assert.equal(X.detect(list, { now: NOW }).find((c) => c.type === "rejected_order").reason, "out of stock");
});

test("detection is idempotent through findOpen (no duplicate cases on re-scan)", () => {
  const cand = X.detect([{ id: "o2", status: "restaurant_ready", readyAt: minAgo(8) }], { now: NOW })[0];
  const c = X.createCase(cand, { id: "EX-9", now: NOW }).case;
  assert.equal(c.dedupeKey, "unassigned_order:o2");
  assert.equal(X.findOpen([c], "unassigned_order:o2"), c);
  X.resolve(c, { outcome: "reassigned", note: "driver found" }, { now: NOW });
  assert.equal(X.findOpen([c], "unassigned_order:o2"), null); // resolved case no longer blocks a new one
});

test("ageCase bumps stale cases to urgent once", () => {
  const c = mk({ priority: "normal" });
  assert.equal(X.ageCase(c, { now: NOW + 10 * 60000 }), false);
  assert.equal(X.ageCase(c, { now: NOW + 31 * 60000 }), true);
  assert.equal(c.priority, "urgent");
  assert.equal(X.ageCase(c, { now: NOW + 99 * 60000 }), false);
});

test("filter, sort and counts", () => {
  const a = mk({ type: "rejected_order", priority: "low" });
  const b = X.createCase({ type: "payment_error", reason: "x" }, { id: "EX-2", now: NOW }).case;
  const c = X.createCase({ type: "unassigned_order", orderId: "o3", reason: "x" }, { id: "EX-3", now: NOW }).case;
  X.resolve(c, { outcome: "fixed", note: "done ok" }, { now: NOW });
  const all = [a, b, c];
  assert.deepEqual(X.filterCases(all, {}).map((x) => x.id), ["EX-2", "EX-1", "EX-3"]); // urgent first, resolved last
  assert.equal(X.filterCases(all, { status: "active" }).length, 2);
  assert.equal(X.filterCases(all, { type: "payment_error" }).length, 1);
  assert.equal(X.filterCases(all, { q: "o3" }).length, 1);
  const n = X.counts(all);
  assert.equal(n.active, 2); assert.equal(n.urgent, 1); assert.equal(n.resolved, 1);
  assert.equal(n.byType.payment_error, 1);
});

test("text input is sanitised and length-limited", () => {
  const c = X.createCase({ type: "rejected_order", orderId: "o1", reason: "<script>x</script>" + "a".repeat(999) }, { now: NOW }).case;
  assert.ok(!c.reasons[0].includes("<"));
  assert.ok(c.reasons[0].length <= X.LIMITS.reason);
});

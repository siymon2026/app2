"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const v = require("../lib/verify-codes");

const SECRET = "test-secret";
const mk = (status = "accepted") => ({ id: "o1", status, verify: v.newVerify(new Date("2026-10-24T10:00:00Z")) });
const NOW = new Date("2026-10-24T11:00:00Z");

test("codes are 6 digits, deterministic, stage-specific and secret-specific", () => {
  const o = mk();
  const p = v.codeFor(SECRET, o, "pickup");
  assert.match(p, /^\d{6}$/);
  assert.equal(p, v.codeFor(SECRET, o, "pickup"));
  assert.notEqual(p, v.codeFor("other", o, "pickup"));
  assert.equal(v.codeFor(SECRET, { ...o, id: "o2" }, "pickup") === p, false);
  assert.ok(v.codeFor(SECRET, o, "pickup") !== null && v.codeFor(SECRET, o, "bogus") === null);
});

test("no plaintext code is stored on the order", () => {
  const o = mk();
  const json = JSON.stringify(o);
  assert.equal(json.includes(v.codeFor(SECRET, o, "pickup")), false);
  assert.equal(json.includes(v.codeFor(SECRET, o, "delivery")), false);
});

test("correct code passes once and is remembered", () => {
  const o = mk();
  const c = v.codeFor(SECRET, o, "pickup");
  assert.deepEqual(v.check(SECRET, o, "pickup", c, NOW), { ok: true });
  assert.ok(o.verify.pickup.verifiedAt);
  assert.equal(v.isRequired(o, "pickup"), false);
  // delivery stage is independent and still required
  assert.equal(v.isRequired(o, "delivery"), true);
  assert.equal(v.check(SECRET, o, "delivery", c, NOW).ok, false); // pickup code is not the delivery code
});

test("missing / malformed / wrong code is rejected", () => {
  const o = mk();
  assert.equal(v.check(SECRET, o, "delivery", "", NOW).code, "CODE_REQUIRED");
  assert.equal(v.check(SECRET, o, "delivery", "12ab56", NOW).code, "CODE_REQUIRED");
  const r = v.check(SECRET, o, "delivery", "000000" === v.codeFor(SECRET, o, "delivery") ? "000001" : "000000", NOW);
  assert.equal(r.code, "CODE_INVALID");
  assert.equal(r.attemptsLeft, 4);
});

test("locks after max attempts, even for the right code, then unlocks", () => {
  const o = mk();
  const good = v.codeFor(SECRET, o, "delivery");
  const bad = good === "111111" ? "222222" : "111111";
  let r;
  for (let i = 0; i < v.MAX_ATTEMPTS; i++) r = v.check(SECRET, o, "delivery", bad, NOW);
  assert.equal(r.code, "CODE_LOCKED");
  assert.equal(v.check(SECRET, o, "delivery", good, NOW).code, "CODE_LOCKED");
  const later = new Date(NOW.getTime() + v.LOCK_MS + 1000);
  assert.equal(v.check(SECRET, o, "delivery", good, later).ok, true);
});

test("expired codes are rejected", () => {
  const o = mk();
  const late = new Date(Date.parse(o.verify.expiresAt) + 1000);
  assert.equal(v.check(SECRET, o, "pickup", v.codeFor(SECRET, o, "pickup"), late).code, "CODE_EXPIRED");
});

test("legacy orders (no verify) are not gated", () => {
  const o = { id: "old", status: "accepted" };
  assert.equal(v.isRequired(o, "pickup"), false);
  assert.equal(v.check(SECRET, o, "pickup", "", NOW).ok, true);
});

test("supervisor exception needs a reason, records actor, and unlocks the stage", () => {
  const o = mk();
  assert.equal(v.grantException(o, "delivery", { by: "admin1", reason: "" }).ok, false);
  assert.equal(v.grantException(o, "delivery", { by: "admin1", reason: "customer phone dead", now: NOW }).ok, true);
  assert.equal(o.verify.delivery.exception.by, "admin1");
  assert.equal(v.isRequired(o, "delivery"), false);
  assert.equal(v.isRequired(o, "pickup"), true);
});

test("customer / store only see their own code, only in the right states", () => {
  const o = mk("accepted");
  assert.equal(v.deliveryCodeForCustomer(SECRET, o), v.codeFor(SECRET, o, "delivery"));
  assert.equal(v.pickupCodeForStore(SECRET, o), v.codeFor(SECRET, o, "pickup"));
  assert.equal(v.deliveryCodeForCustomer(SECRET, { ...o, status: "restaurant_ready" }), null);
  assert.equal(v.pickupCodeForStore(SECRET, { ...o, status: "on_the_way" }), null);
  assert.equal(v.deliveryCodeForCustomer(SECRET, { ...o, status: "delivered" }), null);
});

test("driver view never contains verify data or codes", () => {
  const o = mk("accepted");
  o.verify.pickup.exception = { by: "x" };
  const d = v.stripForDriver(o);
  assert.equal("verify" in d, false);
  const s = JSON.stringify(d);
  assert.equal(s.includes(o.verify.salt), false);
  assert.deepEqual(d.verifyRequired, { pickup: false, delivery: true });
});

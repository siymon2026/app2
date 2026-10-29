"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const T = require("../lib/topups");
const PM = require("../lib/payment-methods");
const L = require("../lib/wallet-ledger");

function methods() {
  let list = PM.withDefaults([]);
  const set = (id, patch) => { list = list.map((m) => (m.id === id ? PM.applyUpdate(m, patch).value : m)); };
  set("cih", { enabled: true, details: { default: { holderName: "SIYMON", rib: "111" } }, minAmount: 50, maxAmount: 1000 });
  set("wafacash", { enabled: true, details: { default: { holderName: "SIYMON", paymentIdentifier: "W-1" } }, requireReceipt: false });
  set("barid", { enabled: true, contexts: { driverTopup: false }, details: { default: { holderName: "S", rib: "9" } } });
  return list;
}
const base = (o = {}) => ({ walletType: "driver", ownerId: "d1", methodId: "cih", amount: 100, reference: "TRX-12345", hasReceipt: true, methods: methods(), topups: [], ...o });

test("a valid request is only a claim: pending data, normalised reference", () => {
  const r = T.validateRequest(base());
  assert.equal(r.ok, true);
  assert.equal(r.value.refKey, "TRX12345");
  assert.equal(r.value.amount, 100);
});

test("method must be an available MANUAL TRANSFER in the right context (Stripe, COD, disabled, other context refused)", () => {
  for (const id of ["stripe", "cod", "tpe", "attijariwafa", "nope"]) assert.equal(T.validateRequest(base({ methodId: id })).code, "METHOD_UNAVAILABLE", id);
  assert.equal(T.validateRequest(base({ methodId: "barid" })).code, "METHOD_UNAVAILABLE"); // not allowed for drivers
  assert.equal(T.validateRequest(base({ methodId: "barid", walletType: "customer" })).ok, true);
});

test("amount rules: positive, per-method min/max, global cap", () => {
  assert.equal(T.validateRequest(base({ amount: 0 })).code, "BAD_AMOUNT");
  assert.equal(T.validateRequest(base({ amount: "abc" })).code, "BAD_AMOUNT");
  assert.equal(T.validateRequest(base({ amount: 49 })).code, "BELOW_MIN");
  assert.equal(T.validateRequest(base({ amount: 1001 })).code, "ABOVE_MAX");
  assert.equal(T.validateRequest(base({ methodId: "wafacash", amount: 1e6 })).code, "BAD_AMOUNT");
});

test("reference and receipt requirements", () => {
  assert.equal(T.validateRequest(base({ reference: "ab" })).code, "REFERENCE_REQUIRED");
  assert.equal(T.validateRequest(base({ reference: "--  " })).code, "REFERENCE_REQUIRED");
  assert.equal(T.validateRequest(base({ hasReceipt: false })).code, "RECEIPT_REQUIRED");
  assert.equal(T.validateRequest(base({ methodId: "wafacash", hasReceipt: false })).ok, true);
});

test("a reference can never be reused: same method, any wallet, any status except failed; case/format insensitive", () => {
  const prior = (status, extra = {}) => ({ id: "t1", methodId: "cih", refKey: "TRX12345", status, walletType: "customer", customerId: "c9", ...extra });
  for (const s of ["pending", "approved", "rejected"]) {
    assert.equal(T.validateRequest(base({ reference: "trx 12345", topups: [prior(s)] })).code, "DUPLICATE_REFERENCE", s);
  }
  assert.equal(T.validateRequest(base({ topups: [prior("failed")] })).ok, true);
  assert.equal(T.validateRequest(base({ methodId: "wafacash", topups: [prior("pending")] })).ok, true); // other method = other transfer
});

test("anti-spam: at most 3 pending per owner, owners are independent, wallets separate", () => {
  const p = (i, owner = "d1", wt = "driver") => ({ id: "p" + i, status: "pending", methodId: "cih", refKey: "R" + i + "XXXX", walletType: wt, ...(wt === "driver" ? { driverId: owner } : { customerId: owner }) });
  const three = [p(1), p(2), p(3)];
  assert.equal(T.validateRequest(base({ topups: three })).code, "TOO_MANY_PENDING");
  assert.equal(T.validateRequest(base({ ownerId: "d2", topups: three })).ok, true);
  assert.equal(T.validateRequest(base({ walletType: "customer", methodId: "cih", ownerId: "d1", topups: three })).ok, true);
});

test("decision: only pending, reason for reject/fail, no self-review, no reopening", () => {
  const mk = () => ({ id: "t1", status: "pending", walletType: "driver", driverId: "d1", amount: 100 });
  assert.equal(T.decide(mk(), { to: "approved", by: "admin" }).credit, true);
  assert.equal(T.decide(mk(), { to: "rejected", by: "admin" }).code, "REASON_REQUIRED");
  assert.equal(T.decide(mk(), { to: "failed", by: "admin", reason: "ab" }).code, "REASON_REQUIRED");
  assert.equal(T.decide(mk(), { to: "approved", by: "d1" }).code, "SELF_REVIEW");
  assert.equal(T.decide(mk(), { to: "approved" }).code, "REVIEWER_REQUIRED");
  assert.equal(T.decide(mk(), { to: "weird", by: "a" }).code, "BAD_STATUS");
  assert.equal(T.decide(null, { to: "approved", by: "a" }).status, 404);
  const t = mk();
  assert.equal(T.decide(t, { to: "rejected", by: "a", reason: "no money received" }).ok, true);
  assert.equal(T.decide(t, { to: "approved", by: "a" }).code, "ALREADY_DECIDED");
  assert.equal(t.status, "rejected");
  assert.equal(t.decidedBy, "a");
});

test("repeated / concurrent approvals credit the wallet exactly once (state machine + ledger ref)", () => {
  const t = { id: "t9", status: "pending", walletType: "driver", driverId: "d1", amount: 120 };
  const d = { id: "d1", walletBalance: 0, walletHistory: [] };
  let credits = 0;
  const approve = () => {
    const r = T.decide(t, { to: "approved", by: "admin", confirmedReference: "bank ref 7" });
    if (r.ok && r.credit) { const e = L.applyEntry(d, { ref: T.ledgerRef(t), type: "topup", amount: t.amount }); if (!e.duplicate) credits++; }
    return r;
  };
  const results = [approve(), approve(), approve()];
  assert.deepEqual(results.map((r) => r.ok), [true, false, false]);
  assert.equal(credits, 1);
  assert.equal(d.walletBalance, 120);
  // crash between the two writes, then approval re-driven on a still-pending copy: ledger ref still blocks a second credit
  const again = L.applyEntry(d, { ref: T.ledgerRef(t), type: "topup", amount: t.amount });
  assert.equal(again.duplicate, true);
  assert.equal(d.walletBalance, 120);
  assert.equal(L.reconcile(d).ok, true);
  assert.equal(t.confirmedReference, "bank ref 7");
});

test("customer and driver wallets are separate: same request id never touches the other ledger", () => {
  const c = { id: "c1", walletBalance: 0, walletHistory: [] };
  const d = { id: "d1", walletBalance: 0, walletHistory: [] };
  const t = { id: "tx", amount: 50 };
  L.applyEntry(c, { ref: T.ledgerRef(t), type: "topup", amount: 50 });
  assert.equal(c.walletBalance, 50);
  assert.equal(d.walletBalance, 0);
});

test("owner view hides internal data and the rejection reason is visible, approval note is not", () => {
  const v = T.ownerView({ id: "t", walletType: "customer", customerId: "c", amount: 5, status: "rejected", decisionNote: "no funds", decidedBy: "admin1", receiptFile: "x.jpg", reference: "R1", createdAt: "x" });
  assert.equal(v.decisionNote, "no funds");
  assert.equal(v.decidedBy, undefined);
  assert.equal(v.hasReceipt, true);
  assert.equal(v.receiptFile, undefined);
  assert.equal(T.ownerView({ id: "t", status: "approved", decisionNote: "internal" }).decisionNote, null);
  assert.equal(T.walletTypeOf({ id: "legacy", driverId: "d" }), "driver");
});

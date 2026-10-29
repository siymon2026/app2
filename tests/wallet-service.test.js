"use strict";
/**
 * Wallet policy, transaction views and the append-only ledger — pure module tests.
 */
const test = require("node:test");
const assert = require("node:assert/strict");

const ws = require("../lib/wallet-service");
const ledger = require("../lib/wallet-ledger");

/* ------------------------------------------------------------------ policy */

test("the default policy is safe: enabled, real limits, no invented fees", () => {
  const p = ws.policyOf(null);
  assert.equal(p.enabled, true);
  assert.equal(p.minTopup, 10);
  assert.equal(p.maxTopup, 20000);
  assert.equal(p.feePercent, 0);
  assert.equal(p.feeFixed, 0);
  assert.deepEqual(p.presets, [50, 100, 200, 500]);
});

test("policy updates reject unknown / out-of-range values and version conflicts", () => {
  const base = ws.policyOf(null);
  assert.equal(ws.validatePolicy({ nope: 1 }, base).code, "UNKNOWN_SETTING");
  assert.equal(ws.validatePolicy({ minTopup: 0 }, base).code, "OUT_OF_RANGE");
  assert.equal(ws.validatePolicy({ maxTopup: 5, minTopup: 10 }, base).code, "BAD_RANGE");
  assert.equal(ws.validatePolicy({ feePercent: 50 }, base).code, "OUT_OF_RANGE");
  assert.equal(ws.validatePolicy({ presets: [50000, 100] }, base).code, "BAD_PRESETS");
  assert.equal(ws.validatePolicy({ expectedVersion: 7 }, base).code, "VERSION_CONFLICT");
  const ok = ws.validatePolicy({ minTopup: 20, maxTopup: 900, presets: [50, 100] }, base);
  assert.equal(ok.ok, true);
  assert.equal(ok.value.version, base.version + 1);
  assert.deepEqual(ok.value.presets, [50, 100]);
});

/* ------------------------------------------------------------------- quote */

test("a top-up quote enforces the supervisor limits (and the method limits when tighter)", () => {
  const policy = { minTopup: 10, maxTopup: 1000 };
  assert.equal(ws.quote({ amount: 5, policy }).code, "BELOW_MIN");
  assert.equal(ws.quote({ amount: 5000, policy }).code, "ABOVE_MAX");
  assert.equal(ws.quote({ amount: 0, policy }).code, "BAD_AMOUNT");
  assert.equal(ws.quote({ amount: 50, policy, method: { minAmount: 100 } }).code, "BELOW_MIN");
  assert.equal(ws.quote({ amount: 500, policy, method: { maxAmount: 200 } }).code, "ABOVE_MAX");
  const q = ws.quote({ amount: 100, policy });
  assert.equal(q.ok, true);
  assert.equal(q.creditAmount, 100);
});

test("fees are deducted from the credited amount, never invented on top", () => {
  const q = ws.quote({ amount: 100, policy: { feePercent: 2, feeFixed: 5 } });
  assert.equal(q.fee, 7);
  assert.equal(q.creditAmount, 93);
  const tooHigh = ws.quote({ amount: 5, policy: { minTopup: 1, feeFixed: 5 } });
  assert.equal(tooHigh.code, "FEE_TOO_HIGH");
  assert.equal(ws.quote({ amount: 10, policy: { feeFixed: 5 } }).creditAmount, 5);
});

/* -------------------------------------------------------------- views */

test("ledger entries become stable, typed transactions", () => {
  const out = ws.listTransactions([
    { id: "1", type: "topup", amount: 100, createdAt: "2026-01-01T00:00:00.000Z" },
    { id: "2", type: "order_payment", amount: -40, orderId: "ORD-1", createdAt: "2026-01-02T00:00:00.000Z" },
    { id: "3", type: "order_refund", amount: 40, orderId: "ORD-1", createdAt: "2026-01-03T00:00:00.000Z" },
    { id: "4", type: "loyalty_redeem", amount: 1, createdAt: "2026-01-04T00:00:00.000Z" },
    { id: "5", type: "manual_adjust", amount: -5, createdAt: "2026-01-05T00:00:00.000Z" },
    { id: "6", type: "something_else", amount: -2, createdAt: "2026-01-06T00:00:00.000Z" },
  ]);
  assert.deepEqual(out.map((t) => t.type), ["other", "adjust", "loyalty", "refund", "order_payment", "topup"]);
  const payment = out.find((t) => t.id === "2");
  assert.equal(payment.direction, "debit");
  assert.equal(payment.amount, 40); // shown as a positive number + a direction
  assert.equal(payment.signedAmount, -40);
});

test("only succeeded entries count in the wallet totals", () => {
  const totals = ws.summary([
    { type: "topup", amount: 300 },
    { type: "topup", amount: 500, status: "pending" }, // never counted as money
    { type: "topup", amount: 200, status: "failed" },
    { type: "order_payment", amount: -80 },
    { type: "order_refund", amount: 80 },
    { type: "loyalty_redeem", amount: 2 },
    { type: "manual_adjust", amount: 10 },
    { type: "manual_debit", amount: -8 },
  ]);
  assert.equal(totals.added, 300);
  assert.equal(totals.used, 80);
  assert.equal(totals.refunded, 80);
  assert.equal(totals.loyaltyAdded, 2);
  assert.equal(totals.adjustedIn, 10);
  assert.equal(totals.adjustedOut, 8);
  assert.equal(totals.net, 300 - 80 + 80 + 2 + 10 - 8);
});

test("reconcile() detects a balance that drifted from its ledger", () => {
  const ok = ws.reconcile({ walletBalance: 60, walletHistory: [{ amount: 100 }, { amount: -40 }] });
  assert.equal(ok.ok, true);
  assert.equal(ok.diff, 0);
  const drifted = ws.reconcile({ walletBalance: 61, walletHistory: [{ amount: 100 }, { amount: -40 }] });
  assert.equal(drifted.ok, false);
  assert.equal(drifted.diff, 1);
});

/* ------------------------------------------------------- idempotency keys */

test("idempotency keys are validated and scoped to the user", () => {
  assert.equal(ws.idempotencyKey({ headers: {} }), null);
  assert.equal(ws.idempotencyKey({ headers: { "idempotency-key": "short" } }), null);
  assert.equal(ws.idempotencyKey({ headers: { "idempotency-key": "abcd1234" } }), "abcd1234");
  assert.equal(ws.idempotencyKey({ body: { requestId: "req-12345678" } }), "req-12345678");
  assert.equal(ws.idempotencyKey({ body: { requestId: "bad key!!" } }), null);
  assert.equal(ws.scopedKey("order", "CUS-1", "abcd1234"), "order:CUS-1:abcd1234");
  assert.notEqual(ws.scopedKey("order", "CUS-1", "abcd1234"), ws.scopedKey("order", "CUS-2", "abcd1234"));
});

/* ------------------------------------------------------------------ ledger */

test("the ledger refuses a negative balance and a duplicate ref", () => {
  const customer = { walletBalance: 50, walletHistory: [] };
  const ok = ledger.applyEntry(customer, { ref: "topup:1", type: "topup", amount: 50 });
  assert.equal(ok.ok, true);
  assert.equal(customer.walletBalance, 100);
  const dup = ledger.applyEntry(customer, { ref: "topup:1", type: "topup", amount: 50 });
  assert.equal(dup.duplicate, true);
  assert.equal(customer.walletBalance, 100);
  const tooMuch = ledger.applyEntry(customer, { ref: "order:1:wallet", type: "order_payment", amount: -150 });
  assert.equal(tooMuch.ok, false);
  assert.equal(tooMuch.code, "INSUFFICIENT_FUNDS");
  assert.equal(customer.walletBalance, 100);
  assert.equal(customer.walletHistory.length, 1);
});

test("every ledger entry is append-only and reconcilable", () => {
  const customer = { walletBalance: 0, walletHistory: [] };
  ledger.applyEntry(customer, { ref: "a", type: "topup", amount: 100 });
  ledger.applyEntry(customer, { ref: "b", type: "order_payment", amount: -30 });
  ledger.applyEntry(customer, { ref: "c", type: "order_refund", amount: 30 });
  const r = ledger.reconcile(customer);
  assert.equal(r.ok, true);
  assert.equal(r.entries, 3);
  assert.equal(customer.walletHistory[0].ref, "c"); // newest first
  assert.equal(customer.walletHistory[0].balanceAfter, 100);
});

test("pending entries are recorded but never move the balance summary", () => {
  const customer = { walletBalance: 0, walletHistory: [] };
  ledger.applyEntry(customer, { ref: "p", type: "topup", amount: 100, status: "pending" });
  assert.equal(customer.walletBalance, 100); // the balance is the ledger sum…
  const s = ledger.summarize(customer);
  assert.equal(s.credits, 0); // …but a pending top-up is not counted as money added
});

"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const w = require("../lib/wallet-ledger");

test("credit and debit update balance and keep balanceAfter", () => {
  const d = {};
  const a = w.applyEntry(d, { ref: "topup:1", type: "topup", amount: 100 });
  assert.equal(a.ok, true);
  const b = w.applyEntry(d, { ref: "order:9:charge", type: "order_deduct", amount: -30.5 });
  assert.equal(b.entry.balanceAfter, 69.5);
  assert.equal(d.walletBalance, 69.5);
  assert.equal(d.walletHistory[0].ref, "order:9:charge"); // newest first
});

test("same ref twice is a no-op (idempotent)", () => {
  const d = { walletBalance: 0, walletHistory: [] };
  w.applyEntry(d, { ref: "topup:1", type: "topup", amount: 50 });
  const again = w.applyEntry(d, { ref: "topup:1", type: "topup", amount: 50 });
  assert.equal(again.duplicate, true);
  assert.equal(d.walletBalance, 50);
  assert.equal(d.walletHistory.length, 1);
});

test("negative balance refused unless explicitly allowed", () => {
  const d = { walletBalance: 10, walletHistory: [] };
  const r = w.applyEntry(d, { ref: "adj:1", type: "adjustment", amount: -11 });
  assert.equal(r.code, "INSUFFICIENT_FUNDS");
  assert.equal(d.walletBalance, 10);
  assert.equal(d.walletHistory.length, 0);
  assert.equal(w.applyEntry(d, { ref: "adj:2", type: "order_deduct", amount: -11, allowNegative: true }).ok, true);
  assert.equal(d.walletBalance, -1);
});

test("invalid amounts and missing ref rejected", () => {
  const d = {};
  for (const amount of [0, NaN, "abc", Infinity, 2e6, undefined]) {
    assert.equal(w.applyEntry(d, { ref: "x" + String(amount), amount }).code, "BAD_AMOUNT");
  }
  assert.equal(w.applyEntry(d, { amount: 5 }).code, "REF_REQUIRED");
  assert.equal(d.walletBalance, 0);
});

test("floating point amounts stay exact to 2 decimals", () => {
  const d = {};
  for (let i = 0; i < 10; i++) w.applyEntry(d, { ref: "c" + i, amount: 0.1 });
  assert.equal(d.walletBalance, 1);
  assert.equal(w.reconcile(d).ok, true);
});

test("reconcile detects tampering and reports legacy entries", () => {
  const d = {};
  w.applyEntry(d, { ref: "a", amount: 40 });
  assert.equal(w.reconcile(d).ok, true);
  d.walletBalance = 999; // out-of-band edit
  const r = w.reconcile(d);
  assert.equal(r.ok, false);
  assert.equal(r.diff, 959);
  d.walletHistory.push({ amount: 1, type: "old" });
  assert.equal(w.reconcile(d).legacyEntriesWithoutRef, 1);
});

test("actor and links are recorded as strings, secrets are not required", () => {
  const d = {};
  const r = w.applyEntry(d, { ref: "adj:z", type: "admin_adjust", amount: 5, actorType: "admin", actorId: 7, note: "gift" });
  assert.equal(r.entry.actorId, "7");
  assert.equal(r.entry.note, "gift");
});

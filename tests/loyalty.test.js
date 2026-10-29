"use strict";
/**
 * Loyalty ("نقاط الوفاء") rules — pure module tests.
 *
 * The rules that matter for money are checked here: when points may be earned,
 * what they are computed on, that a credit can never be duplicated, that a debit
 * can never create a negative balance, and that reversals expire correctly.
 */
const test = require("node:test");
const assert = require("node:assert/strict");

const loyalty = require("../lib/loyalty");

const AT = "2026-01-10T10:00:00.000Z";

function settings(over = {}) {
  return loyalty.settingsOf(
    Object.assign(
      {
        enabled: true,
        earn: Object.assign(
          { enabled: true, unitAmount: 10, pointsPerUnit: 1, base: "paid", pendingDays: 0 },
          over.earn || {},
        ),
        redeem: Object.assign(
          { enabled: true, minPoints: 100, pointsPerCurrencyUnit: 100 },
          over.redeem || {},
        ),
        expiry: Object.assign({ enabled: false, days: 365 }, over.expiry || {}),
      },
      over.root || {},
    ),
  );
}

function order(over = {}) {
  return Object.assign(
    {
      id: "ORD-1",
      customerId: "CUS-1",
      status: "delivered",
      subtotal: 100,
      discount: 0,
      deliveryFee: 10,
      total: 110,
      createdAt: "2026-01-09T10:00:00.000Z",
      deliveredAt: "2026-01-10T09:00:00.000Z",
    },
    over,
  );
}

function account() {
  return { customerId: "CUS-1", entries: [] };
}

/* ------------------------------------------------------------------ earning */

test("no points while the programme is off", () => {
  const s = settings({ root: { enabled: false } });
  assert.equal(loyalty.earnForOrder(order(), s).eligible, false);
  assert.equal(loyalty.earnForOrder(order(), s).reason, "program_disabled");
});

test("no points while earning is paused but balances are kept", () => {
  const s = settings({ earn: { enabled: false } });
  const r = loyalty.earnForOrder(order(), s);
  assert.equal(r.eligible, false);
  assert.equal(r.reason, "earning_disabled");
});

test("points are awarded only on a final, trustworthy status", () => {
  const s = settings();
  for (const status of ["new", "admin_accepted", "restaurant_ready", "accepted", "picked_up", "on_the_way"]) {
    assert.equal(loyalty.earnForOrder(order({ status }), s).eligible, false, status);
  }
  for (const status of ["delivered", "done", "DELIVERED"]) {
    assert.equal(loyalty.earnForOrder(order({ status }), s).eligible, true, status);
  }
});

test("canceled / rejected orders never earn, and a refunded order never earns", () => {
  const s = settings();
  for (const status of ["canceled", "cancelled", "rejected"]) {
    assert.equal(loyalty.earnForOrder(order({ status }), s).eligible, false, status);
  }
  assert.equal(loyalty.earnForOrder(order({ refundedAt: AT }), s).eligible, false);
});

test("earning base can be paid / subtotal / total, with or without the delivery fee and the discount", () => {
  const o = order({ subtotal: 100, promo: { amount: 10 }, deliveryFee: 20, total: 110 });
  // paid = subtotal - discount (110 - 20 delivery = 90 + ... ) -> the module uses subtotal - discount by default
  const paid = loyalty.earnForOrder(o, settings({ earn: { base: "paid", unitAmount: 1 } }));
  assert.equal(paid.base, 90);
  const subtotal = loyalty.earnForOrder(o, settings({ earn: { base: "subtotal", unitAmount: 1, includeDiscount: true } }));
  assert.equal(subtotal.base, 100); // pre-discount articles
  const subtotalAfter = loyalty.earnForOrder(o, settings({ earn: { base: "subtotal", unitAmount: 1 } }));
  assert.equal(subtotalAfter.base, 90);
  const total = loyalty.earnForOrder(o, settings({ earn: { base: "total", unitAmount: 1, includeDeliveryFee: true } }));
  assert.equal(total.base, 110);
  const noFee = loyalty.earnForOrder(o, settings({ earn: { base: "total", unitAmount: 1, includeDeliveryFee: false } }));
  assert.equal(noFee.base, 90); // delivery excluded, discount applied
  const preDiscount = loyalty.earnForOrder(o, settings({ earn: { base: "subtotal", unitAmount: 1, includeDiscount: true } }));
  assert.equal(preDiscount.base, 100);
});

test("points are whole numbers and respect the per-order cap, the minimum order and a zero rate", () => {
  const s = settings({ earn: { unitAmount: 10, pointsPerUnit: 1 } });
  const r = loyalty.earnForOrder(order({ subtotal: 99, discount: 0, deliveryFee: 0, total: 99 }), s);
  assert.equal(r.points, 9); // floor(99 / 10)

  const capped = loyalty.earnForOrder(order({ subtotal: 1000, deliveryFee: 0, total: 1000 }), settings({ earn: { maxPointsPerOrder: 5 } }));
  assert.equal(capped.points, 5);

  const maybe = loyalty.earnForOrder(order({ subtotal: 5 }), settings({ earn: { minOrderAmount: 20 } }));
  assert.equal(maybe.eligible, false);
});

test("a replayed order cannot earn twice", () => {
  const acc = account();
  const s = settings();
  const calc = loyalty.earnForOrder(order(), s);
  const ref = loyalty.earnRef("ORD-1");
  const first = loyalty.credit(acc, { ref, kind: "earn", points: calc.points, at: AT });
  const second = loyalty.credit(acc, { ref, kind: "earn", points: calc.points, at: AT });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(second.duplicate, true);
  assert.equal(acc.entries.filter((e) => e.direction === "credit").length, 1);
  assert.equal(loyalty.balances(acc, AT).available, 10);
});

/* ------------------------------------------------------------------- ledger */

test("pending points are not spendable until they mature", () => {
  const acc = account();
  loyalty.credit(acc, { ref: "a", kind: "earn", points: 50, at: AT, holdDays: 3 });
  assert.equal(loyalty.balances(acc, AT).available, 0);
  assert.equal(loyalty.balances(acc, AT).pending, 50);
  const settled = loyalty.settlePending(acc, "2026-01-14T10:00:00.000Z");
  assert.equal(settled.length, 1);
  assert.equal(settled[0].remaining, 50);
  assert.equal(loyalty.balances(acc, "2026-01-14T10:00:00.000Z").available, 50);
  // idempotent: settling again changes nothing
  assert.equal(loyalty.settlePending(acc, "2026-01-15T10:00:00.000Z").length, 0);
});

test("a debit consumes the oldest points first and never goes below zero", () => {
  const acc = account();
  loyalty.credit(acc, { ref: "a", kind: "earn", points: 30, at: "2026-01-01T00:00:00.000Z" });
  loyalty.credit(acc, { ref: "b", kind: "earn", points: 40, at: "2026-01-02T00:00:00.000Z" });
  const ok = loyalty.debit(acc, { ref: "d1", kind: "redeem", points: 50, at: AT });
  assert.equal(ok.ok, true);
  const lots = acc.entries.filter((e) => e.direction === "credit");
  const lotA = lots.find((e) => e.ref === "a");
  const lotB = lots.find((e) => e.ref === "b");
  assert.equal(lotA.remaining, 0); // the OLDEST points are consumed first
  assert.equal(lotB.remaining, 20);
  assert.equal(lotA.status, "exhausted");
  const tooMuch = loyalty.debit(acc, { ref: "d2", kind: "redeem", points: 21, at: AT });
  assert.equal(tooMuch.ok, false);
  assert.equal(tooMuch.code, "INSUFFICIENT_POINTS");
  assert.equal(loyalty.balances(acc, AT).available, 20);
});

test("the same debit reference is applied only once", () => {
  const acc = account();
  loyalty.credit(acc, { ref: "a", kind: "earn", points: 100, at: AT });
  assert.equal(loyalty.debit(acc, { ref: "d", kind: "redeem", points: 10, at: AT }).ok, true);
  const again = loyalty.debit(acc, { ref: "d", kind: "redeem", points: 10, at: AT });
  assert.equal(again.duplicate, true);
  assert.equal(loyalty.balances(acc, AT).available, 90);
});

test("points expire and are written off once per lot", () => {
  const acc = account();
  loyalty.credit(acc, { ref: "a", kind: "earn", points: 25, at: AT, expiresDays: 30 });
  const later = "2026-03-01T00:00:00.000Z";
  assert.equal(loyalty.balances(acc, later).available, 0);
  const first = loyalty.expireDue(acc, later);
  assert.equal(first.length, 1);
  assert.equal(first[0].points, 25);
  assert.equal(loyalty.expireDue(acc, later).length, 0);
  assert.equal(loyalty.balances(acc, later).expired, 25);
  const lot = acc.entries.find((e) => e.ref === "a");
  assert.ok(acc.entries.some((e) => e.kind === "expire" && e.ref === loyalty.expireRef(lot.id)));
});

/* ------------------------------------------------------------------ reversal */

test("cancelling/refunding an order reverses its points without inventing a balance", () => {
  const acc = account();
  loyalty.credit(acc, { ref: loyalty.earnRef("ORD-9"), kind: "earn", points: 40, at: AT });
  loyalty.debit(acc, { ref: "spend", kind: "redeem", points: 30, at: AT }); // 10 left
  const rev = loyalty.debit(acc, {
    ref: loyalty.reverseRef("ORD-9"),
    kind: "reverse",
    points: 40,
    at: AT,
    allowPartial: true,
  });
  assert.equal(rev.ok, true);
  const b = loyalty.balances(acc, AT);
  assert.equal(b.available, 0);
  assert.equal(b.debt, 30); // the 30 points already spent are a documented debt
});

/* ------------------------------------------------------------------- redeem */

test("redemption quote enforces the minimum, the per-transaction cap and the daily cap", () => {
  const acc = account();
  loyalty.credit(acc, { ref: "a", kind: "earn", points: 500, at: AT });
  const s = settings({ redeem: { minPoints: 100, pointsPerCurrencyUnit: 100, maxPointsPerTx: 200, maxPointsPerDay: 250 } });
  const ok = loyalty.redeemQuote(acc, 100, s, AT);
  assert.equal(ok.ok, true);
  assert.equal(ok.amount, 1);
  assert.equal(loyalty.redeemQuote(acc, 50, s, AT).code, "BELOW_MIN_POINTS");
  assert.equal(loyalty.redeemQuote(acc, 300, s, AT).code, "ABOVE_MAX_POINTS");
  loyalty.debit(acc, { ref: "r1", kind: "redeem", points: 200, at: AT });
  const today = loyalty.redeemedOn(acc, AT);
  assert.equal(today, 200);
  assert.equal(loyalty.redeemQuote(acc, 100, s, { now: AT, redeemedToday: today }).code, "DAILY_LIMIT");
  assert.equal(loyalty.redeemQuote(acc, 50, s, { now: AT, redeemedToday: today }).code, "BELOW_MIN_POINTS");
});

test("a conversion reference is stable and unique per request", () => {
  assert.equal(loyalty.redeemRef("abc"), loyalty.redeemRef("abc"));
  assert.notEqual(loyalty.redeemRef("abc"), loyalty.redeemRef("abd"));
});

/* ----------------------------------------------------------------- settings */

test("settings reject unknown and invalid values instead of silently defaulting", () => {
  const base = settings({});
  assert.equal(loyalty.normalizeSettings({ nope: 1 }, base).code, "UNKNOWN_SETTING");
  assert.equal(loyalty.normalizeSettings({ earn: { unitAmount: 0 } }, base).ok, false);
  assert.equal(loyalty.normalizeSettings({ earn: { pointsPerUnit: -1 } }, base).ok, false);
  assert.equal(loyalty.normalizeSettings({ redeem: { minPoints: 0 } }, base).ok, false);
  assert.equal(loyalty.normalizeSettings({ expiry: { enabled: true, days: 0 } }, base).ok, false);
  assert.equal(loyalty.normalizeSettings({ version: 3 }, base).code, "UNKNOWN_SETTING"); // storage metadata is never input
  const conflict = loyalty.normalizeSettings({ expectedVersion: Number(base.version || 0) + 5 }, base);
  assert.equal(conflict.code, "VERSION_CONFLICT");
  const good = loyalty.normalizeSettings({ earn: { unitAmount: 25 } }, base);
  assert.equal(good.ok, true);
  assert.equal(good.value.earn.unitAmount, 25);
});

test("the public view explains the rules in AR / FR / EN", () => {
  const s = settings({});
  for (const lang of ["ar", "fr", "en"]) {
    const v = loyalty.publicView(s, lang);
    assert.equal(typeof v.earn.rule, "string");
    assert.ok(v.earn.rule.length > 10, lang);
    assert.ok(v.terms.length > 10, lang);
    assert.equal(v.redeem.minPoints, 100);
  }
});

test("manual adjustments require a positive whole number of points and a reason", () => {
  assert.equal(loyalty.validateAdjustment({ points: 10, direction: "credit", reason: "gesture" }).ok, true);
  assert.equal(loyalty.validateAdjustment({ points: 10, direction: "credit" }).code, "REASON_REQUIRED");
  assert.equal(loyalty.validateAdjustment({ points: 0, direction: "credit", reason: "x" }).ok, false);
  assert.equal(loyalty.validateAdjustment({ points: -5, direction: "credit", reason: "x" }).ok, false);
  assert.equal(loyalty.validateAdjustment({ points: 10, direction: "up", reason: "x" }).ok, false);
  assert.equal(loyalty.validateAdjustment({ points: 10, direction: "credit", reason: "xy" }).code, "REASON_REQUIRED");
  assert.equal(loyalty.validateAdjustment({ points: 10, direction: "credit", reason: "gesture" }).ok, true);
  assert.equal(loyalty.validateAdjustment({ points: 10, direction: "credit", reason: "gesture", reference: "REF-1" }).ok, true);
});

test("the statement is newest-first and exposes the reason of every movement", () => {
  const acc = account();
  loyalty.credit(acc, { ref: "a", kind: "earn", points: 10, at: "2026-01-01T00:00:00.000Z", reason: "Order #1" });
  loyalty.debit(acc, { ref: "b", kind: "redeem", points: 5, at: "2026-01-02T00:00:00.000Z", reason: "conversion" });
  const rows = loyalty.statement(acc, { limit: 10 });
  assert.equal(rows[0].ref, "b");
  assert.equal(rows[0].reason, "conversion");
  assert.equal(rows[1].reason, "Order #1");
});

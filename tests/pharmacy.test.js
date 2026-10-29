"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../lib/pharmacy");

const cust = { name: "Ali", phone: "0611111111", addr: "Rabat", lat: 34.02, lng: -6.84 };
const mk = (over = {}) => {
  const v = P.validateCreate({ storeId: "p1", text: "Doliprane 1000", customer: cust, ...over });
  assert.ok(v.ok, JSON.stringify(v));
  return P.create({ id: "PH-AAAA1111", storeId: "p1", customerId: "c1", value: v.value, now: new Date("2026-10-26T10:00:00Z") });
};

test("ids: unique-looking, valid format", () => {
  const ids = new Set(Array.from({ length: 500 }, () => P.newRequestId()));
  assert.ok(ids.size > 480);
  for (const id of ids) assert.ok(P.isRequestId(id), id);
  assert.equal(P.isRequestId("../etc/passwd"), false);
});

test("create validation: needs text or prescription, and customer fields", () => {
  assert.equal(P.validateCreate({ customer: cust }).code, "EMPTY_REQUEST");
  assert.equal(P.validateCreate({ customer: cust }, { hasPrescription: true }).ok, true);
  assert.equal(P.validateCreate({ text: "x", customer: { name: "a" } }).code, "MISSING_CUSTOMER");
  const v = P.validateCreate({ text: "<b>x</b>", customer: { ...cust, lat: 0, lng: 0 }, clientId: "bad id!" });
  assert.equal(v.value.text, "bx/b");           // angle brackets stripped
  assert.equal(v.value.customer.lat, undefined); // 0,0 is not a pin
  assert.equal(v.value.clientId, null);
});

test("quote validation: lines, prices, unavailable needs a reason, validity bounds", () => {
  const now = new Date("2026-10-26T10:00:00Z");
  assert.equal(P.validateQuote({ available: true, lines: [] }, now).code, "LINES_REQUIRED");
  assert.equal(P.validateQuote({ lines: [{ name: "A", qty: 1, price: 0 }] }, now).code, "LINE_PRICE");
  assert.equal(P.validateQuote({ lines: [{ name: "A", qty: 0, price: 5 }] }, now).code, "LINE_QTY");
  assert.equal(P.validateQuote({ lines: [{ name: "", qty: 1, price: 5 }] }, now).code, "LINE_NAME");
  assert.equal(P.validateQuote({ available: false }, now).code, "REASON_REQUIRED");
  const u = P.validateQuote({ available: false, reason: "Rupture de stock" }, now);
  assert.equal(u.value.available, false);
  const q = P.validateQuote({ lines: [{ name: "Doliprane", qty: 2, price: 12.345 }, { name: "Vit C", qty: 1, price: 30 }], validMinutes: 9999 }, now);
  assert.equal(q.value.medicinesTotal, 54.7); // 2*12.35 + 30 (prices rounded to cents)
  assert.equal(q.value.validMinutes, 240);
  assert.equal(q.value.expiresAt, "2026-10-26T14:00:00.000Z");
});

test("lifecycle: pending -> quoted -> accepted; driver-facing order only after acceptance", () => {
  const r = mk();
  const t0 = new Date("2026-10-26T10:05:00Z");
  assert.equal(P.canAccept(r, { total: 50, now: t0 }).code, "NO_OFFER"); // nothing to accept yet
  assert.equal(P.applyQuote(r, P.validateQuote({ lines: [{ name: "Doliprane", qty: 1, price: 20 }], validMinutes: 30 }, t0).value, { actorId: "u1", now: t0 }).ok, true);
  assert.equal(r.status, "quoted");
  const now = t0.getTime() + 60000;
  assert.equal(P.canAccept(r, { total: 30, expectTotal: 25, now }).code, "PRICE_CHANGED");
  assert.equal(P.canAccept(r, { total: 30, expectTotal: 30, now }).ok, true);
  P.markAccepted(r, { orderId: "ord1", total: 30, now: new Date(now) });
  assert.equal(r.status, "accepted");
  assert.equal(P.canAccept(r, { total: 30, now }).already, true); // idempotent
  assert.equal(P.cancel(r, { now: new Date(now) }).code, "REQUEST_CLOSED");
  assert.equal(P.applyQuote(r, P.validateQuote({ lines: [{ name: "x", qty: 1, price: 1 }] }).value, { now: new Date(now) }).code, "REQUEST_CLOSED");
  assert.deepEqual(r.events.map((e) => e.to), ["pending", "quoted", "accepted"]);
});

test("expiry: unanswered after 24h, quote after its validity; accepting an expired offer is refused", () => {
  const r = mk();
  assert.equal(P.effectiveStatus(r, Date.parse("2026-10-27T09:59:00Z")), "pending");
  assert.equal(P.effectiveStatus(r, Date.parse("2026-10-27T10:01:00Z")), "expired");
  const r2 = mk();
  const t0 = new Date("2026-10-26T10:05:00Z");
  P.applyQuote(r2, P.validateQuote({ lines: [{ name: "A", qty: 1, price: 10 }], validMinutes: 10 }, t0).value, { now: t0 });
  assert.equal(P.canAccept(r2, { total: 10, now: t0.getTime() + 11 * 60000 }).code, "OFFER_EXPIRED");
  assert.equal(P.applyExpiry(r2, t0.getTime() + 11 * 60000), true);
  assert.equal(r2.status, "expired");
  assert.equal(P.applyQuote(r2, P.validateQuote({ lines: [{ name: "A", qty: 1, price: 10 }] }).value).code, "REQUEST_CLOSED");
});

test("decline / cancel / re-quote while quoted", () => {
  const r = mk();
  const t0 = new Date("2026-10-26T10:05:00Z");
  const q1 = P.validateQuote({ lines: [{ name: "A", qty: 1, price: 10 }] }, t0).value;
  P.applyQuote(r, q1, { now: t0 });
  P.applyQuote(r, P.validateQuote({ lines: [{ name: "A", qty: 1, price: 12 }] }, t0).value, { now: t0 }); // pharmacist corrects the price
  assert.equal(r.quote.medicinesTotal, 12);
  assert.equal(P.decline(r, { reason: "trop cher", now: t0 }).ok, true);
  assert.equal(r.status, "declined");
  assert.equal(P.decline(r, { now: t0 }).code, "NO_OFFER");
  const r2 = mk();
  assert.equal(P.cancel(r2, { now: t0 }).ok, true);
  assert.equal(r2.status, "canceled");
});

test("views: customer sees price + delivery total; store sees masked phone; prescription file never leaks", () => {
  const r = mk({ prescription: true });
  r.prescription = { file: "secret-name.jpg", mime: "image/jpeg" };
  const t0 = new Date("2026-10-26T10:05:00Z");
  P.applyQuote(r, P.validateQuote({ lines: [{ name: "A", qty: 2, price: 10 }] }, t0).value, { actorId: "u1", now: t0 });
  const cv = P.customerView(r, { store: { name: "Pharma" }, delivery: { fee: 8, km: 2.1 }, now: t0.getTime() });
  assert.equal(cv.total, 28);
  assert.equal(cv.canAccept, true);
  assert.equal(cv.hasPrescription, true);
  assert.equal(JSON.stringify(cv).includes("secret-name"), false);
  assert.equal(cv.quote.quotedBy, undefined);
  const sv = P.storeView(r, { canContact: false, maskPhone: () => "••••1111", now: t0.getTime() });
  assert.equal(sv.customer.phone, "••••1111");
  assert.equal(JSON.stringify(sv).includes("secret-name"), false);
  assert.equal(sv.customer.lat, undefined);
});

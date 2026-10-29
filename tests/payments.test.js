"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const p = require("../lib/payments");

test("COD is accepted (explicit, alias, and legacy missing method)", () => {
  for (const v of ["cod", "COD", " cash_on_delivery ", "cash", undefined, null, ""]) {
    const r = p.resolvePaymentMethod(v);
    assert.equal(r.ok, true, String(v));
    assert.equal(r.method, "cod");
  }
});
test("online methods are rejected until enabled", () => {
  for (const v of ["card", "visa", "mastercard", "paypal", "stripe", "Visa"]) {
    const r = p.resolvePaymentMethod(v);
    assert.equal(r.ok, false, v);
    assert.equal(r.code, "PAYMENT_METHOD_NOT_AVAILABLE");
  }
});
test("garbage input is rejected, not coerced to COD", () => {
  assert.equal(p.resolvePaymentMethod("x".repeat(500)).ok, false);
  assert.equal(p.resolvePaymentMethod({}).ok, false);
});
test("only COD is enabled; all UI online methods are known", () => {
  assert.deepEqual(p.ENABLED_METHODS, ["cod"]);
  for (const m of ["card", "visa", "mastercard", "paypal"]) assert.ok(p.KNOWN_ONLINE_METHODS.includes(m));
});

test("registry-driven order payment: COD ok, TPE only when enabled, transfers/stripe refused for orders", () => {
  const P = require("../lib/payment-methods");
  let list = P.withDefaults([]);
  assert.equal(p.resolveOrderPayment("cod", list).ok, true);
  assert.equal(p.resolveOrderPayment(undefined, list).method, "cod"); // legacy client
  assert.equal(p.resolveOrderPayment("tpe", list).ok, false);
  list = list.map((m) => (m.id === "tpe" ? P.applyUpdate(m, { enabled: true }).value : m));
  assert.deepEqual(p.resolveOrderPayment("tpe", list), { ok: true, method: "tpe", kind: "tpe" });
  for (const id of ["stripe", "cih", "wafacash", "visa", "nope"]) assert.equal(p.resolveOrderPayment(id, list).code, "PAYMENT_METHOD_NOT_AVAILABLE", id);
  // supervisor switches COD off -> orders with COD refused
  list = list.map((m) => (m.id === "cod" ? P.applyUpdate(m, { enabled: false }).value : m));
  assert.equal(p.resolveOrderPayment("cod", list).ok, false);
});

"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../lib/payment-methods");
const byId = (list, id) => list.find((x) => x.id === id);
const fresh = () => P.withDefaults([]);

test("fresh install lists exactly the 9 methods; only COD is enabled; nothing invented", () => {
  const l = fresh();
  assert.deepEqual(l.map((x) => x.id), ["stripe", "cod", "tpe", "cih", "credit_agricole", "cashplus", "wafacash", "attijariwafa", "barid"]);
  assert.deepEqual(l.filter((x) => x.enabled).map((x) => x.id), ["cod"]);
  for (const m of l.filter((x) => x.kind === "transfer")) {
    assert.equal(P.hasAccount(m.details.default), false, m.id);
    assert.equal(m.details.default.rib, "");
  }
});

test("Stripe is never available, with the exact label, even if a supervisor enables it", () => {
  const s = byId(fresh(), "stripe");
  const a = P.availability(s, "checkout");
  assert.equal(a.available, false);
  assert.equal(a.label, "غير متوفر حاليا");
  const r = P.applyUpdate(s, { enabled: true });
  assert.equal(r.ok, true);
  assert.equal(P.availability(r.value, "checkout").available, false);
  assert.equal(P.publicView(r.value, "checkout").statusLabel, "غير متوفر حاليا");
});

test("COD available at checkout only; TPE off until enabled; neither can be a wallet context", () => {
  const l = fresh();
  assert.equal(P.availability(byId(l, "cod"), "checkout").available, true);
  assert.equal(P.availability(byId(l, "cod"), "customerTopup").available, false);
  assert.equal(P.availability(byId(l, "tpe"), "checkout").reason, "disabled");
  const t = P.applyUpdate(byId(l, "tpe"), { enabled: true, contexts: { customerTopup: true, driverTopup: true } }).value;
  assert.equal(P.availability(t, "checkout").available, true);
  assert.equal(t.contexts.customerTopup, false);
  assert.equal(t.contexts.driverTopup, false);
  assert.equal(P.availability(t, "driverTopup").available, false);
});

test("a transfer method cannot be enabled without real account details", () => {
  const cih = byId(fresh(), "cih");
  const r = P.applyUpdate(cih, { enabled: true });
  assert.equal(r.code, "ACCOUNT_REQUIRED");
  const ok = P.applyUpdate(cih, { enabled: true, details: { default: { holderName: "SIYMON SARL", rib: "000 000 0000000000000000 00" } } });
  assert.equal(ok.ok, true);
  assert.equal(P.availability(ok.value, "customerTopup").available, true);
  assert.equal(cih.enabled, false, "input untouched");
});

test("different accounts for customer and driver top-ups; overrides fall back to default", () => {
  let m = byId(fresh(), "cashplus");
  m = P.applyUpdate(m, { details: { default: { holderName: "SIYMON", paymentIdentifier: "DEFAULT-1", instructions: { ar: "عام" } } } }).value;
  m = P.applyUpdate(m, { details: { driver: { paymentIdentifier: "DRIVER-9", instructions: { ar: "للسائق" } } }, enabled: true }).value;
  assert.equal(P.detailsFor(m, "customer").paymentIdentifier, "DEFAULT-1");
  assert.equal(P.detailsFor(m, "driver").paymentIdentifier, "DRIVER-9");
  assert.equal(P.detailsFor(m, "driver").holderName, "SIYMON"); // inherited
  assert.equal(P.detailsFor(m, "driver").instructions.ar, "للسائق");
  assert.equal(P.detailsFor(m, "customer").instructions.ar, "عام");
  const pubC = P.publicView(m, "customerTopup", { includeAccount: true });
  const pubD = P.publicView(m, "driverTopup", { includeAccount: true });
  assert.equal(pubC.account.paymentIdentifier, "DEFAULT-1");
  assert.equal(pubD.account.paymentIdentifier, "DRIVER-9");
});

test("public view hides account details unless asked, and never for checkout lists by default", () => {
  let m = byId(fresh(), "barid");
  m = P.applyUpdate(m, { enabled: true, details: { default: { holderName: "X", rib: "123" } } }).value;
  assert.equal(P.publicView(m, "customerTopup").account, undefined);
  assert.equal(P.publicView(m, "customerTopup", { includeAccount: true }).account.rib, "123");
  assert.equal(P.publicView(m, "customerTopup").available, true);
});

test("validation: image url, amounts, range, sort order; verification is always manual for transfers", () => {
  const m = byId(fresh(), "wafacash");
  assert.equal(P.applyUpdate(m, { qrImage: "javascript:alert(1)" }).code, "BAD_IMAGE");
  assert.equal(P.applyUpdate(m, { qrImage: "/uploads/pay/qr.png" }).ok, true);
  assert.equal(P.applyUpdate(m, { minAmount: -1 }).code, "BAD_AMOUNT");
  assert.equal(P.applyUpdate(m, { minAmount: 50, maxAmount: 10 }).code, "BAD_RANGE");
  assert.equal(P.applyUpdate(m, { sortOrder: "x" }).code, "BAD_SORT");
  assert.equal(P.applyUpdate(m, { requireVerification: false }).value.requireVerification, true);
  assert.equal(P.applyUpdate(m, { name: { ar: "<b>وافا</b>" } }).value.name.ar, "bوافا/b");
});

test("amount limits", () => {
  const m = P.applyUpdate(byId(fresh(), "wafacash"), { minAmount: 50, maxAmount: 2000 }).value;
  assert.equal(P.checkAmount(m, 49).code, "BELOW_MIN");
  assert.equal(P.checkAmount(m, 2001).code, "ABOVE_MAX");
  assert.equal(P.checkAmount(m, 100).ok, true);
  assert.equal(P.checkAmount(m, 0).code, "BAD_AMOUNT");
  assert.equal(P.checkAmount(m, "abc").code, "BAD_AMOUNT");
});

test("audit summary masks account numbers and never contains full values", () => {
  const before = byId(fresh(), "cih");
  const after = P.applyUpdate(before, { details: { default: { holderName: "SIYMON", rib: "230780000012345678901234" } } }).value;
  const s = P.changeSummary(before, after);
  const rib = s.find((x) => x.field === "details.default.rib");
  assert.equal(rib.to, "•••1234");
  assert.ok(!JSON.stringify(s).includes("230780000012345678901234"));
  assert.ok(s.some((x) => x.field === "details.default.holderName"));
});

test("stored records keep working; missing built-ins are added without touching stored ones", () => {
  const stored = fresh().filter((x) => x.id !== "barid");
  stored.find((x) => x.id === "cod").enabled = false;
  const l = P.withDefaults(stored);
  assert.equal(l.length, 9);
  assert.equal(byId(l, "cod").enabled, false);
});

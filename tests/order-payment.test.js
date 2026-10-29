"use strict";
const test = require("node:test");
const assert = require("node:assert");
const op = require("../lib/order-payment");
const promo = require("../lib/promo");
const ledger = require("../lib/wallet-ledger");
const topups = require("../lib/topups");
const fs = require("node:fs");
const path = require("node:path");

test("walletShare: covers goods only, never above balance", () => {
  assert.deepStrictEqual(op.walletShare({ balance: 100, subtotal: 60, discount: 10, requested: true }), { ok: true, amount: 50 });
  assert.deepStrictEqual(op.walletShare({ balance: 20, subtotal: 60, requested: true }), { ok: true, amount: 20 });
  assert.deepStrictEqual(op.walletShare({ balance: 20, subtotal: 60, requested: false }), { ok: true, amount: 0 });
});
test("walletShare: empty wallet / too large explicit amount / bad amount rejected", () => {
  assert.strictEqual(op.walletShare({ balance: 0, subtotal: 60, requested: true }).code, "WALLET_EMPTY");
  assert.strictEqual(op.walletShare({ balance: 10, subtotal: 60, requested: 30 }).code, "WALLET_INSUFFICIENT");
  assert.strictEqual(op.walletShare({ balance: 10, subtotal: 60, requested: -5 }).code, "BAD_WALLET_AMOUNT");
  assert.strictEqual(op.walletShare({ balance: 100, subtotal: 60, requested: 25 }).amount, 25);
});
test("snapshot: delivery fee always due on delivery; reference only when wallet used", () => {
  const a = op.snapshot({ total: 75, deliveryFee: 15, walletAmount: 60, method: "cod", ledgerRef: "order:1:wallet", at: "t" });
  assert.strictEqual(a.amountDueOnDelivery, 15);
  assert.strictEqual(a.status, "partially_paid_wallet");
  assert.strictEqual(a.reference, "order:1:wallet");
  const b = op.snapshot({ total: 75, deliveryFee: 15, walletAmount: 0, method: "cod", ledgerRef: "x", at: "t" });
  assert.strictEqual(b.amountDueOnDelivery, 75);
  assert.strictEqual(b.reference, null);
});
test("driver goods charge drops by the wallet part; legacy orders unchanged", () => {
  assert.strictEqual(promo.goodsDue({ subtotal: 60 }), 60);
  assert.strictEqual(promo.goodsDue({ subtotal: 60, payment: { walletAmount: 0 } }), 60);
  assert.strictEqual(promo.goodsDue({ subtotal: 60, payment: { walletAmount: 25 } }), 35);
  assert.strictEqual(promo.goodsDue({ subtotal: 60, promo: { amount: 10 }, payment: { walletAmount: 50 } }), 0);
});
test("wallet payment then cancel refund: balance consistent and idempotent", () => {
  const c = { id: "c1", walletBalance: 0, walletHistory: [] };
  ledger.applyEntry(c, { ref: "topup:t1", type: "topup", amount: 100 });
  assert.ok(ledger.applyEntry(c, { ref: op.walletPayRef("o1"), type: "order_payment", amount: -60 }).ok);
  assert.strictEqual(c.walletBalance, 40);
  const overspend = ledger.applyEntry(c, { ref: op.walletPayRef("o2"), type: "order_payment", amount: -50 });
  assert.strictEqual(overspend.code, "INSUFFICIENT_FUNDS");
  assert.strictEqual(c.walletBalance, 40);
  const order = { id: "o1", status: "canceled", payment: { walletAmount: 60 } };
  assert.ok(op.needsRefund(order));
  for (let i = 0; i < 3; i++) ledger.applyEntry(c, { ref: op.walletRefundRef("o1"), type: "order_refund", amount: 60 });
  assert.strictEqual(c.walletBalance, 100);
  assert.ok(ledger.reconcile(c).ok);
  assert.ok(!op.needsRefund({ ...order, payment: { walletAmount: 60, walletRefundedAt: "x" } }));
  assert.ok(!op.needsRefund({ id: "o3", status: "delivered", payment: { walletAmount: 60 } }));
});
test("customer and driver wallets are separate objects/ledgers (same topup id cannot cross)", () => {
  const cust = { walletBalance: 0, walletHistory: [] };
  const drv = { walletBalance: 0, walletHistory: [] };
  ledger.applyEntry(cust, { ref: topups.ledgerRef({ id: "T1" }), type: "topup", amount: 50 });
  assert.strictEqual(drv.walletBalance, 0);
  assert.strictEqual(topups.walletTypeOf({ walletType: "customer" }), "customer");
  assert.strictEqual(topups.walletTypeOf({}), "driver"); // legacy driver records
});
test("review flow: approve credits once, second approval/reject refused, reject credits nothing", () => {
  const cust = { id: "c1", walletBalance: 0, walletHistory: [] };
  const t = { id: "T9", walletType: "customer", customerId: "c1", amount: 80, status: "pending" };
  const r1 = topups.decide(t, { to: "approved", by: "a1" });
  assert.ok(r1.ok && r1.credit);
  ledger.applyEntry(cust, { ref: topups.ledgerRef(t), type: "topup", amount: t.amount });
  const r2 = topups.decide(t, { to: "approved", by: "a2" });
  assert.strictEqual(r2.status, 409);
  assert.strictEqual(topups.decide(t, { to: "rejected", by: "a2", reason: "x" }).status, 409);
  assert.strictEqual(cust.walletBalance, 80);
  const u = { id: "T10", walletType: "customer", customerId: "c1", amount: 5, status: "pending" };
  assert.ok(!topups.decide(u, { to: "rejected", by: "a1" }).ok, "reason mandatory");
  const rj = topups.decide(u, { to: "rejected", by: "a1", reason: "not received" });
  assert.ok(rj.ok && !rj.credit);
});

/* ---- wiring checks on the real server source (routes cannot be run without npm install) ---- */
const SRC = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
test("server wiring: receipts private, review uses decide + ledger, customer routes authenticated", () => {
  assert.match(SRC, /app\.use\(`\$\{UPLOADS_PUBLIC_PATH\}\/topups`/, "legacy public receipt path is blocked");
  assert.match(SRC, /app\.get\("\/api\/admin\/topups\/:id\/receipt", requireAdmin/);
  assert.match(SRC, /app\.get\("\/api\/driver\/topups\/:id\/receipt", requireDriver/);
  assert.match(SRC, /app\.get\("\/api\/customer\/wallet\/topups\/:id\/receipt", requireCustomer/);
  assert.match(SRC, /app\.post\("\/api\/customer\/wallet\/topups", requireCustomer/);
  assert.match(SRC, /app\.get\("\/api\/customer\/wallet", requireCustomer/);
  const patch = SRC.slice(SRC.indexOf('app.patch("/api/admin/topups/:id"'), SRC.indexOf("// ---- customer wallet"));
  assert.match(patch, /topupsLib\.decide\(/);
  assert.match(patch, /walletLedger\.applyEntry\(owner/);
  assert.doesNotMatch(patch, /await /, "review must stay synchronous (atomic on the event loop)");
  // Wallet refund + loyalty settlement now run in ONE transactional, idempotent
  // path: settleOrderEffects() must be wired into every cancellation exit
  // (customer, driver, admin, store-rejection) instead of ad-hoc calls.
  assert.match(SRC, /function settleOrderEffects\(orderId, meta = \{\}\)/);
  assert.match(SRC, /function refundWalletInTx\(store, order, meta = \{\}\)/);
  assert.ok((SRC.match(/settleOrderEffects\(/g) || []).length >= 5, "customer cancel, driver, admin, store review and the wrapper");
  const storeRoutes = fs.readFileSync(path.join(__dirname, "..", "lib", "store-routes.js"), "utf8");
  assert.match(storeRoutes, /onOrderSettled\(o\.id/, "a store rejection must refund the wallet and withdraw the points");
  // the legacy helper stays as a thin wrapper (no second implementation)
  assert.match(SRC, /function refundOrderWallet\(order, meta\) \{[\s\S]{0,200}settleOrderEffects\(order\.id/);
});
test("admin-roles: topup receipt needs topups.review; payment config needs payments.manage", () => {
  const roles = require("../lib/admin-roles");
  assert.strictEqual(roles.permissionFor("GET", "/api/admin/topups/abc/receipt"), "topups.review");
  assert.strictEqual(roles.permissionFor("PATCH", "/api/admin/topups/abc"), "topups.review");
  assert.strictEqual(roles.permissionFor("PUT", "/api/admin/payment-methods/cih"), "payments.manage");
  assert.strictEqual(roles.can("finance", "payments.manage"), false);
});

"use strict";
/**
 * Wallet top-up requests for manual transfers (pure rules, no I/O).
 *
 * A request is only a CLAIM: submitting a reference or a receipt never credits a
 * wallet. Only an authorised supervisor decision (approve) does, through the
 * ledger, idempotently by ref `topup:<id>`.
 *
 * Statuses: pending -> approved | rejected | failed (terminal; no reopening).
 * walletType: "driver" | "customer" (separate ledgers, never mixed).
 */
const pm = require("./payment-methods");
const walletService = require("./wallet-service");

const WALLET_TYPES = Object.freeze(["driver", "customer"]);
const STATUSES = Object.freeze(["pending", "approved", "rejected", "failed"]);
const MAX_PENDING_PER_OWNER = 3;
const MAX_AMOUNT = 100000;
const money = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/** Reference identity: letters/digits only, upper-case ("ab-12 34" == "AB1234"). */
const refKey = (ref) => String(ref == null ? "" : ref).toUpperCase().replace(/[^A-Z0-9]/g, "");
const cleanRef = (ref) => String(ref == null ? "" : ref).replace(/[<>]/g, "").trim().slice(0, 60);

const contextOf = (walletType) => (walletType === "driver" ? "driverTopup" : "customerTopup");
const ownerIdOf = (t) => String(t.walletType === "customer" ? t.customerId : t.driverId || "");
/** Legacy driver top-ups were stored without walletType. */
const walletTypeOf = (t) => (t && t.walletType === "customer" ? "customer" : "driver");

/**
 * Validate a wallet-funding request.
 *
 * A payment method is only usable when the SERVER says it is available for this
 * context (supervisor configuration + a real integration). Online providers that
 * are not integrated (e.g. Stripe) are never "available": the caller gets
 * METHOD_UNAVAILABLE / PROVIDER_NOT_CONFIGURED and must not credit anything.
 *
 * @param {{walletType:string, ownerId:string, methodId:string, amount:any, reference:any,
 *          hasReceipt:boolean, methods:object[], topups:object[], policy?:object,
 *          clientRequestId?:string}} p
 * @returns {{ok:true,value:object}|{ok:false,status:number,code:string,error:string}}
 */
function validateRequest(p) {
  if (!WALLET_TYPES.includes(p.walletType)) return { ok: false, status: 400, code: "BAD_WALLET", error: "Invalid wallet" };
  const context = contextOf(p.walletType);
  const method = (p.methods || []).find((m) => m.id === String(p.methodId || ""));
  const all = p.topups || [];

  // Replay of the same client request: answer with the SAME pending request, never a second one.
  const cid = String(p.clientRequestId || "").trim().slice(0, 160);
  if (cid) {
    const prior = all.find((t) => t.clientRequestId === cid && walletTypeOf(t) === p.walletType && ownerIdOf(t) === String(p.ownerId));
    if (prior) return { ok: true, duplicate: true, value: { existing: prior } };
  }

  if (!method) return { ok: false, status: 409, code: "METHOD_UNAVAILABLE", error: "Payment method not available" };
  if (method.kind === "stripe" || method.kind === "paypal") {
    // No provider integration exists: an honest "unavailable", never a fake success.
    return { ok: false, status: 409, code: "METHOD_UNAVAILABLE", reason: "not_integrated", error: "This online provider is not integrated yet: wallet top-ups cannot be credited" };
  }
  if (!pm.availability(method, context).available || method.kind !== "transfer") {
    return { ok: false, status: 409, code: "METHOD_UNAVAILABLE", error: "Payment method not available" };
  }
  const amount = money(p.amount);
  if (!(amount > 0) || amount > MAX_AMOUNT) return { ok: false, status: 400, code: "BAD_AMOUNT", error: "Invalid amount" };
  const range = pm.checkAmount(method, amount);
  if (!range.ok) return { ok: false, status: 400, code: range.code, error: range.error, ...(range.min != null ? { min: range.min } : {}), ...(range.max != null ? { max: range.max } : {}) };
  // Supervisor wallet policy (limits + fees). Applied to CUSTOMERS only, drivers keep their own legacy flow.
  let money0 = { amount, fee: 0, creditAmount: amount };
  if (p.policy && p.walletType === "customer") {
    const q = walletService.quote({ amount, policy: p.policy, method });
    if (!q.ok) return { ok: false, status: q.status || 400, code: q.code, error: q.error, ...(q.min != null ? { min: q.min } : {}), ...(q.max != null ? { max: q.max } : {}) };
    money0 = { amount: q.amount, fee: q.fee, creditAmount: q.creditAmount };
  }
  const reference = cleanRef(p.reference);
  const key = refKey(reference);
  if (key.length < 4) return { ok: false, status: 400, code: "REFERENCE_REQUIRED", error: "A transfer reference is required (at least 4 letters/digits)" };
  if (method.requireReceipt && !p.hasReceipt) return { ok: false, status: 400, code: "RECEIPT_REQUIRED", error: "A receipt image is required" };
  // a reference identifies ONE transfer: never reusable (any wallet, any status except a system-marked failure)
  if (all.some((t) => t.methodId === method.id && t.refKey === key && t.status !== "failed")) {
    return { ok: false, status: 409, code: "DUPLICATE_REFERENCE", error: "This transfer reference was already submitted" };
  }
  const pending = all.filter((t) => t.status === "pending" && walletTypeOf(t) === p.walletType && ownerIdOf(t) === String(p.ownerId)).length;
  if (pending >= MAX_PENDING_PER_OWNER) return { ok: false, status: 429, code: "TOO_MANY_PENDING", error: "Too many pending requests; wait for review" };
  return {
    ok: true,
    duplicate: false,
    value: {
      methodId: method.id,
      amount: money0.amount,
      fee: money0.fee,
      creditAmount: money0.creditAmount,
      reference,
      refKey: key,
      requireVerification: true,
      context,
      ...(cid ? { clientRequestId: cid } : {}),
    },
  };
}

/**
 * Supervisor decision. Mutates `t` only on success.
 * @returns {{ok:true,topup:object,credit:boolean}|{ok:false,status:number,code:string,error:string}}
 */
function decide(t, { to, by, reason, confirmedReference, now = new Date() }) {
  if (!t) return { ok: false, status: 404, code: "NOT_FOUND", error: "Not found" };
  const target = String(to || "").toLowerCase();
  if (!["approved", "rejected", "failed"].includes(target)) return { ok: false, status: 400, code: "BAD_STATUS", error: "Invalid status" };
  if (t.status !== "pending") return { ok: false, status: 409, code: "ALREADY_DECIDED", error: "Already decided" };
  if (!by) return { ok: false, status: 400, code: "REVIEWER_REQUIRED", error: "Reviewer required" };
  if (String(by) === ownerIdOf(t)) return { ok: false, status: 403, code: "SELF_REVIEW", error: "You cannot review your own request" };
  const why = String(reason || "").replace(/[<>]/g, "").trim().slice(0, 300);
  if (target !== "approved" && why.length < 3) return { ok: false, status: 400, code: "REASON_REQUIRED", error: "A reason is required" };
  const at = now.toISOString();
  t.status = target;
  t.decidedAt = at;
  t.decidedBy = String(by);
  t.decisionNote = why || null;
  if (target === "approved" && confirmedReference) t.confirmedReference = cleanRef(confirmedReference);
  if (target === "approved") {
    // The credited amount is frozen in the record: a fee is never applied twice and
    // a later policy change cannot rewrite the amount of an approved request.
    t.creditAmount = creditAmountOf(t);
    t.creditedAt = at;
  }
  return { ok: true, topup: t, credit: target === "approved" };
}

/**
 * Amount actually credited to the wallet: the transferred amount minus the
 * supervisor-configured fee. Legacy requests (no creditAmount) credit the full amount.
 */
function creditAmountOf(t) {
  if (!t) return 0;
  if (t.creditAmount !== undefined && t.creditAmount !== null && Number.isFinite(Number(t.creditAmount))) return money(t.creditAmount);
  return money(t.amount);
}

const feeOf = (t) => money(Math.max(0, Number(t && t.amount) || 0) - creditAmountOf(t));

/** Provider / method metadata stored with the request (kept for the permanent financial record). */
function providerOf(t) {
  return {
    methodId: t.methodId || null,
    provider: t.methodId ? String(t.methodId) : null,
    providerRef: t.confirmedReference || null,
    submittedReference: t.reference || null,
    status: t.status || null,
    decidedAt: t.decidedAt || null,
  };
}

/** Ledger reference: identical for the same request however many times it is approved. */
const ledgerRef = (t) => `topup:${t.id}`;

/** What the owner may see (no internal review data beyond status/reason). */
function ownerView(t) {
  return {
    id: t.id, walletType: walletTypeOf(t), methodId: t.methodId || null, amount: t.amount,
    fee: feeOf(t), creditAmount: creditAmountOf(t), currency: t.currency || "MAD",
    expiresAt: t.expiresAt || null, verifiedAt: t.creditedAt || null,
    reference: t.reference || null, confirmedReference: t.confirmedReference || null, status: t.status,
    createdAt: t.createdAt, decidedAt: t.decidedAt || null, decisionNote: t.status === "approved" ? null : t.decisionNote || null,
    hasReceipt: !!(t.receiptFile || t.receiptUrl), note: t.note || "",
  };
}

module.exports = { WALLET_TYPES, STATUSES, MAX_PENDING_PER_OWNER, MAX_AMOUNT, refKey, cleanRef, contextOf, ownerIdOf, walletTypeOf, validateRequest, decide, ledgerRef, creditAmountOf, feeOf, providerOf, ownerView };

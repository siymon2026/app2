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
 * @param {{walletType:string, ownerId:string, methodId:string, amount:any, reference:any,
 *          hasReceipt:boolean, methods:object[], topups:object[]}} p
 * @returns {{ok:true,value:object}|{ok:false,status:number,code:string,error:string}}
 */
function validateRequest(p) {
  if (!WALLET_TYPES.includes(p.walletType)) return { ok: false, status: 400, code: "BAD_WALLET", error: "Invalid wallet" };
  const context = contextOf(p.walletType);
  const method = (p.methods || []).find((m) => m.id === String(p.methodId || ""));
  if (!method || !pm.availability(method, context).available || method.kind !== "transfer") {
    return { ok: false, status: 409, code: "METHOD_UNAVAILABLE", error: "Payment method not available" };
  }
  const amount = money(p.amount);
  if (!(amount > 0) || amount > MAX_AMOUNT) return { ok: false, status: 400, code: "BAD_AMOUNT", error: "Invalid amount" };
  const range = pm.checkAmount(method, amount);
  if (!range.ok) return { ok: false, status: 400, code: range.code, error: range.error, ...(range.min != null ? { min: range.min } : {}), ...(range.max != null ? { max: range.max } : {}) };
  const reference = cleanRef(p.reference);
  const key = refKey(reference);
  if (key.length < 4) return { ok: false, status: 400, code: "REFERENCE_REQUIRED", error: "A transfer reference is required (at least 4 letters/digits)" };
  if (method.requireReceipt && !p.hasReceipt) return { ok: false, status: 400, code: "RECEIPT_REQUIRED", error: "A receipt image is required" };
  const all = p.topups || [];
  // a reference identifies ONE transfer: never reusable (any wallet, any status except a system-marked failure)
  if (all.some((t) => t.methodId === method.id && t.refKey === key && t.status !== "failed")) {
    return { ok: false, status: 409, code: "DUPLICATE_REFERENCE", error: "This transfer reference was already submitted" };
  }
  const pending = all.filter((t) => t.status === "pending" && walletTypeOf(t) === p.walletType && ownerIdOf(t) === String(p.ownerId)).length;
  if (pending >= MAX_PENDING_PER_OWNER) return { ok: false, status: 429, code: "TOO_MANY_PENDING", error: "Too many pending requests; wait for review" };
  return { ok: true, value: { methodId: method.id, amount, reference, refKey: key, requireVerification: true, context } };
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
  return { ok: true, topup: t, credit: target === "approved" };
}

/** Ledger reference: identical for the same request however many times it is approved. */
const ledgerRef = (t) => `topup:${t.id}`;

/** What the owner may see (no internal review data beyond status/reason). */
function ownerView(t) {
  return {
    id: t.id, walletType: walletTypeOf(t), methodId: t.methodId || null, amount: t.amount, currency: t.currency || "MAD",
    reference: t.reference || null, confirmedReference: t.confirmedReference || null, status: t.status,
    createdAt: t.createdAt, decidedAt: t.decidedAt || null, decisionNote: t.status === "approved" ? null : t.decisionNote || null,
    hasReceipt: !!(t.receiptFile || t.receiptUrl), note: t.note || "",
  };
}

module.exports = { WALLET_TYPES, STATUSES, MAX_PENDING_PER_OWNER, refKey, cleanRef, contextOf, ownerIdOf, walletTypeOf, validateRequest, decide, ledgerRef, ownerView };

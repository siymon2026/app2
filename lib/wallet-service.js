"use strict";
/**
 * Customer wallet — presentation rules and policy (pure, no I/O).
 *
 * The ledger itself lives on the customer record (`walletBalance` +
 * `walletHistory[]`, see lib/wallet-ledger.js) so no existing data has to be
 * migrated. This module turns those raw entries into a professional
 * transaction history with stable statuses and totals, and validates the
 * supervisor's top-up policy (limits, fees).
 */

const STATUSES = Object.freeze(["succeeded", "pending", "failed", "canceled", "reversed"]);
const MAX_AMOUNT = 100000;

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const clean = (v, max) =>
  String(v == null ? "" : v)
    .replace(/[<>\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

/* ------------------------------- policy ------------------------------- */

function defaultPolicy() {
  return {
    enabled: true,
    currency: "MAD",
    minTopup: 10,
    maxTopup: 20000,
    feePercent: 0,
    feeFixed: 0,
    presets: [50, 100, 200, 500],
    version: 0,
    updatedAt: null,
    updatedBy: null,
  };
}

function policyOf(raw) {
  const d = defaultPolicy();
  if (!raw || typeof raw !== "object") return d;
  const out = { ...d };
  if (typeof raw.enabled === "boolean") out.enabled = raw.enabled;
  for (const k of ["minTopup", "maxTopup", "feePercent", "feeFixed"]) {
    const n = Number(raw[k]);
    if (Number.isFinite(n) && n >= 0 && n <= (k === "maxTopup" ? MAX_AMOUNT : 1000)) out[k] = r2(n);
  }
  if (out.maxTopup < out.minTopup) out.maxTopup = out.minTopup;
  if (Array.isArray(raw.presets)) {
    const p = raw.presets.map(Number).filter((n) => Number.isFinite(n) && n > 0 && n <= MAX_AMOUNT);
    out.presets = [...new Set(p)].slice(0, 8);
    if (!out.presets.length) out.presets = d.presets;
  }
  out.version = Number(raw.version) || 0;
  out.updatedAt = raw.updatedAt || null;
  out.updatedBy = raw.updatedBy || null;
  return out;
}

/** Strict update (unknown keys and out-of-range values are refused). */
function validatePolicy(input, prev) {
  const base = policyOf(prev);
  const b = input && typeof input === "object" ? input : {};
  const allowed = ["enabled", "minTopup", "maxTopup", "feePercent", "feeFixed", "presets", "expectedVersion"];
  const unk = Object.keys(b).filter((k) => !allowed.includes(k));
  if (unk.length) return { ok: false, status: 400, code: "UNKNOWN_SETTING", error: "Unknown setting: " + unk[0].slice(0, 40) };
  const next = { ...base };
  if (b.expectedVersion !== undefined && Number(b.expectedVersion) !== Number(base.version)) {
    return { ok: false, status: 409, code: "VERSION_CONFLICT", error: "The wallet settings were changed by someone else. Reload." };
  }
  if (b.enabled !== undefined) {
    if (typeof b.enabled !== "boolean") return { ok: false, status: 400, code: "INVALID_SETTING", error: "enabled must be true or false" };
    next.enabled = b.enabled;
  }
  const num = (k, lo, hi) => {
    if (b[k] === undefined) return true;
    const n = Number(b[k]);
    if (!Number.isFinite(n) || n < lo || n > hi) return false;
    next[k] = r2(n);
    return true;
  };
  if (!num("minTopup", 1, MAX_AMOUNT)) return { ok: false, status: 400, code: "OUT_OF_RANGE", error: "minTopup must be between 1 and 100000" };
  if (!num("maxTopup", 1, MAX_AMOUNT)) return { ok: false, status: 400, code: "OUT_OF_RANGE", error: "maxTopup must be between 1 and 100000" };
  if (!num("feePercent", 0, 20)) return { ok: false, status: 400, code: "OUT_OF_RANGE", error: "feePercent must be between 0 and 20" };
  if (!num("feeFixed", 0, 500)) return { ok: false, status: 400, code: "OUT_OF_RANGE", error: "feeFixed must be between 0 and 500" };
  if (next.maxTopup < next.minTopup) return { ok: false, status: 400, code: "BAD_RANGE", error: "maxTopup must be >= minTopup" };
  if (b.presets !== undefined) {
    if (!Array.isArray(b.presets) || b.presets.length > 8) return { ok: false, status: 400, code: "BAD_PRESETS", error: "presets must be a list of at most 8 amounts" };
    const p = b.presets.map(Number);
    if (p.some((n) => !Number.isFinite(n) || n < next.minTopup || n > next.maxTopup)) {
      return { ok: false, status: 400, code: "BAD_PRESETS", error: "every preset must be between minTopup and maxTopup" };
    }
    next.presets = [...new Set(p.map(r2))];
  }
  next.version = Number(base.version || 0) + 1;
  return { ok: true, value: next };
}

/** Fee + credited amount for a top-up. Never invents a fee: 0 by default. */
function quote({ amount, policy, method, currency = "MAD" }) {
  const p = policyOf(policy);
  const a = r2(amount);
  const m = method || null;
  const min = Math.max(p.minTopup, m && m.minAmount != null ? Number(m.minAmount) : 0, 1);
  const max = Math.min(p.maxTopup, m && m.maxAmount != null && Number(m.maxAmount) > 0 ? Number(m.maxAmount) : p.maxTopup);
  if (!Number.isFinite(a) || a <= 0) return { ok: false, status: 400, code: "BAD_AMOUNT", error: "Invalid amount", min, max, currency };
  if (a < min) return { ok: false, status: 400, code: "BELOW_MIN", error: `The minimum top-up is ${min} ${currency}`, min, max, currency };
  if (a > max) return { ok: false, status: 400, code: "ABOVE_MAX", error: `The maximum top-up is ${max} ${currency}`, min, max, currency };
  const fee = r2(Math.min(a, Math.max(0, Number(p.feeFixed) || 0) + (a * Math.max(0, Number(p.feePercent) || 0)) / 100));
  const creditAmount = r2(a - fee);
  if (!(creditAmount > 0)) return { ok: false, status: 400, code: "FEE_TOO_HIGH", error: "The fee is higher than the amount", min, max, currency };
  return { ok: true, amount: a, fee, creditAmount, currency, min, max };
}

/* ---------------------------- transactions ---------------------------- */

/** Canonical transaction type of a stored wallet-ledger entry. */
function typeOf(entry) {
  const t = String((entry && entry.type) || "").toLowerCase();
  if (t === "topup") return "topup";
  if (t === "order_payment" || t === "order_deduct") return "order_payment";
  if (t === "order_refund" || /refund/.test(t)) return "refund";
  if (t === "loyalty_redeem" || /loyalty/.test(t)) return "loyalty";
  if (t === "cashback") return "cashback";
  if (/adjust|credit|debit|manual/.test(t)) return "adjust";
  return "other";
}

function statusOf(entry) {
  const s = String((entry && entry.status) || "").toLowerCase();
  return STATUSES.includes(s) ? s : "succeeded";
}

/** One transaction as the customer sees it (never exposes internal actor ids). */
function viewEntry(entry, { currency = "MAD" } = {}) {
  const amount = r2(entry && entry.amount);
  const type = typeOf(entry);
  return {
    id: String((entry && entry.id) || ""),
    ref: String((entry && entry.ref) || ""),
    type,
    direction: amount >= 0 ? "credit" : "debit",
    amount: Math.abs(amount),
    signedAmount: amount,
    currency: (entry && entry.currency) || currency,
    status: statusOf(entry),
    at: (entry && (entry.createdAt || entry.at)) || null,
    orderId: (entry && entry.orderId) || null,
    topupId: (entry && entry.topupId) || null,
    methodId: (entry && entry.methodId) || null,
    reference: (entry && entry.reference) || null,
    note: clean((entry && entry.note) || "", 200),
    source: (entry && entry.actorType) || "system",
  };
}

/** Totals the wallet card shows: added / used / refunded / adjusted. */
function summary(entries) {
  const out = { added: 0, used: 0, refunded: 0, loyaltyAdded: 0, adjustedIn: 0, adjustedOut: 0, net: 0 };
  for (const e of Array.isArray(entries) ? entries : []) {
    const amount = r2(e && e.amount);
    if (!Number.isFinite(amount) || !amount) continue;
    const type = typeOf(e);
    if (statusOf(e) !== "succeeded") continue;
    out.net = r2(out.net + amount);
    if (type === "topup" && amount > 0) out.added = r2(out.added + amount);
    else if (type === "refund" && amount > 0) out.refunded = r2(out.refunded + amount);
    else if (type === "loyalty" && amount > 0) out.loyaltyAdded = r2(out.loyaltyAdded + amount);
    else if (type === "cashback" && amount > 0) out.added = r2(out.added + amount);
    else if (amount < 0 && (type === "order_payment" || type === "other")) out.used = r2(out.used + Math.abs(amount));
    else if (type === "adjust" && amount > 0) out.adjustedIn = r2(out.adjustedIn + amount);
    else if (type === "adjust" && amount < 0) out.adjustedOut = r2(out.adjustedOut + Math.abs(amount));
    else if (amount < 0) out.used = r2(out.used + Math.abs(amount));
  }
  out.totalIn = r2(out.added + out.refunded + out.loyaltyAdded + out.adjustedIn);
  out.totalOut = r2(out.used + out.adjustedOut);
  return out;
}

/** Newest first, optionally filtered. */
function listTransactions(entries, { limit = 100, type = "", status = "" } = {}) {
  return (Array.isArray(entries) ? entries : [])
    .slice()
    .sort((a, b) => String((b && (b.createdAt || b.at)) || "").localeCompare(String((a && (a.createdAt || a.at)) || "")))
    .map((e) => viewEntry(e))
    .filter((t) => (!type || t.type === type) && (!status || t.status === status))
    .slice(0, Math.max(1, Math.min(500, Number(limit) || 100)));
}

/** Does the stored balance still equal the sum of the ledger? */
function reconcile(customer) {
  const entries = Array.isArray(customer && customer.walletHistory) ? customer.walletHistory : [];
  const sum = r2(entries.reduce((s, e) => s + (Number(e && e.amount) || 0), 0));
  const balance = r2(Number(customer && customer.walletBalance) || 0);
  return { ok: sum === balance, balance, ledgerSum: sum, diff: r2(balance - sum), entries: entries.length };
}

/* --------------------------- idempotency --------------------------- */

const KEY_RE = /^[A-Za-z0-9_-]{8,80}$/;

/** Client-supplied idempotency key (header or body). Invalid keys are ignored. */
function idempotencyKey({ headers, body } = {}) {
  const raw = (headers && (headers["idempotency-key"] || headers["Idempotency-Key"])) || (body && (body.requestId || body.idempotencyKey));
  const key = String(raw == null ? "" : raw).trim();
  return KEY_RE.test(key) ? key : null;
}

/** A key the CLIENT cannot guess or replay across users. */
function scopedKey(scope, userId, key) {
  return key ? `${scope}:${userId}:${key}`.slice(0, 160) : null;
}

module.exports = {
  STATUSES,
  MAX_AMOUNT,
  defaultPolicy,
  policyOf,
  validatePolicy,
  quote,
  typeOf,
  statusOf,
  viewEntry,
  summary,
  listTransactions,
  reconcile,
  idempotencyKey,
  scopedKey,
  r2,
  clean,
};

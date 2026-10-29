"use strict";
/**
 * Auditable driver-wallet ledger on top of the existing storage shape
 * (driver.walletBalance + driver.walletHistory[]), so no data migration is needed.
 *
 * - Every change is an entry with a UNIQUE `ref` (e.g. "topup:<id>",
 *   "order:<id>:charge"). Re-applying the same ref is a harmless no-op, which
 *   makes retries / double clicks / crashes between two file writes safe.
 * - Entries are never edited or removed; corrections are new entries.
 * - Negative balances are refused unless the caller explicitly allows it.
 * - reconcile() compares the stored balance with the sum of the entries.
 *
 * NOTE: atomicity across processes is NOT provided (JSON storage, single
 * process by design). A PostgreSQL migration should turn `ref` into a UNIQUE
 * column and run applyEntry inside a transaction.
 */
const crypto = require("crypto");

const MAX_ABS_AMOUNT = 1000000;

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function ensure(driver) {
  if (!Number.isFinite(Number(driver.walletBalance))) driver.walletBalance = 0;
  if (!Array.isArray(driver.walletHistory)) driver.walletHistory = [];
  return driver;
}

/**
 * @param {object} driver  mutated in place; caller must persist it
 * @param {{ref:string,type:string,amount:number,note?:string,orderId?:string,
 *          topupId?:string,actorType?:string,actorId?:string,allowNegative?:boolean,
 *          at?:string}} e
 * @returns {{ok:true,duplicate:boolean,entry:object}|{ok:false,code:string,error:string}}
 */
function applyEntry(driver, e) {
  ensure(driver);
  const ref = String(e?.ref || "").trim();
  if (!ref) return { ok: false, code: "REF_REQUIRED", error: "ref is required" };
  const dup = driver.walletHistory.find((h) => h.ref === ref);
  if (dup) return { ok: true, duplicate: true, entry: dup };

  const amount = round2(e.amount);
  if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > MAX_ABS_AMOUNT) {
    return { ok: false, code: "BAD_AMOUNT", error: "Invalid amount" };
  }
  const before = round2(driver.walletBalance);
  const after = round2(before + amount);
  if (after < 0 && !e.allowNegative) {
    return { ok: false, code: "INSUFFICIENT_FUNDS", error: "Balance cannot go negative" };
  }
  const STATUSES = ["succeeded", "pending", "failed", "canceled", "reversed"];
  const status = STATUSES.includes(String(e.status || "")) ? String(e.status) : "succeeded";
  const entry = {
    id: crypto.randomBytes(8).toString("hex"),
    ref,
    type: String(e.type || "adjustment"),
    amount,
    balanceAfter: after,
    status,
    createdAt: e.at || new Date().toISOString(),
    note: String(e.note || "").slice(0, 300),
  };
  for (const k of ["orderId", "topupId", "actorType", "actorId", "methodId", "reference", "topupReference", "currency"]) {
    if (e[k] !== undefined && e[k] !== null) entry[k] = String(e[k]).slice(0, 120);
  }
  if (e.meta && typeof e.meta === "object") entry.meta = e.meta;
  driver.walletBalance = after;
  driver.walletHistory.unshift(entry); // newest first (existing convention)
  return { ok: true, duplicate: false, entry };
}

/**
 * Sum of the ledger, split the way the wallet card shows it.
 * Entries in a non-final status (pending/failed/canceled) never count as money moved.
 */
function summarize(driver) {
  ensure(driver);
  const out = { credits: 0, debits: 0, refunds: 0, count: driver.walletHistory.length };
  for (const h of driver.walletHistory) {
    if (h.status && h.status !== "succeeded") continue;
    const a = Number(h.amount) || 0;
    if (a > 0) out.credits = round2(out.credits + a);
    else out.debits = round2(out.debits + Math.abs(a));
    if (/refund/.test(String(h.type || ""))) out.refunds = round2(out.refunds + Math.abs(a));
  }
  return out;
}

/** Does the stored balance equal the sum of the ledger entries? */
function reconcile(driver) {
  ensure(driver);
  const sum = round2(driver.walletHistory.reduce((s, h) => s + (Number(h.amount) || 0), 0));
  const balance = round2(driver.walletBalance);
  const refless = driver.walletHistory.filter((h) => !h.ref).length;
  return {
    ok: sum === balance,
    balance,
    ledgerSum: sum,
    diff: round2(balance - sum),
    entries: driver.walletHistory.length,
    legacyEntriesWithoutRef: refless,
  };
}

module.exports = { applyEntry, reconcile, summarize, round2, MAX_ABS_AMOUNT };

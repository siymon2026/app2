"use strict";
/**
 * Discount codes (pure rules, no I/O).
 *
 * - A code is created by the platform admin: percent or fixed amount, optional
 *   max discount, minimum basket, validity window, global and per-customer use
 *   limits, optional list of stores it is valid in.
 * - The discount applies to the GOODS subtotal only (never the delivery fee) and
 *   can never exceed it. It is computed on the server and snapshotted on the
 *   order (order.promo); the client never sends an amount.
 * - Funded by the platform: the store's commission base and net are unchanged,
 *   the customer pays less, and the driver's wallet charge is reduced by the same
 *   amount (the driver only collects what the customer really pays), see goodsDue().
 * - Optional rules: firstOrderOnly (customer has no earlier non-cancelled order) and
 *   categories (discount computed only on goods of those menu categories).
 * - Usage is counted from orders (not cancelled ones), so a cancelled order
 *   automatically gives the use back and there is no second counter to drift.
 */

const TYPES = Object.freeze(["percent", "fixed"]);
const money = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const normalizeCode = (c) => String(c || "").trim().toUpperCase().replace(/\s+/g, "");
const CODE_RE = /^[A-Z0-9_-]{3,24}$/;

function validateDefinition(input, { partial = false } = {}) {
  const b = input || {};
  const out = {};
  if (!partial || b.code !== undefined) {
    const code = normalizeCode(b.code);
    if (!CODE_RE.test(code)) return { ok: false, code: "BAD_CODE", error: "Code must be 3-24 letters, digits, - or _" };
    out.code = code;
  }
  if (!partial || b.type !== undefined) {
    const type = String(b.type || "").toLowerCase();
    if (!TYPES.includes(type)) return { ok: false, code: "BAD_TYPE", error: "type must be percent or fixed" };
    out.type = type;
  }
  if (!partial || b.value !== undefined) {
    const v = Number(b.value);
    const type = out.type || String(b.type || "").toLowerCase();
    if (!Number.isFinite(v) || v <= 0) return { ok: false, code: "BAD_VALUE", error: "value must be positive" };
    if (type === "percent" && v > 100) return { ok: false, code: "BAD_VALUE", error: "percent cannot exceed 100" };
    if (type === "fixed" && v > 10000) return { ok: false, code: "BAD_VALUE", error: "fixed amount too large" };
    out.value = money(v);
  }
  const optNum = (k, lo, hi, int) => {
    if (b[k] === undefined) return null;
    if (b[k] === null || b[k] === "") { out[k] = null; return null; }
    const n = Number(b[k]);
    if (!Number.isFinite(n) || n < lo || n > hi || (int && !Number.isInteger(n))) return { ok: false, code: "BAD_" + k.toUpperCase(), error: `${k} is invalid` };
    out[k] = int ? n : money(n);
    return null;
  };
  for (const e of [optNum("maxDiscount", 0.01, 10000), optNum("minSubtotal", 0, 100000), optNum("maxUses", 1, 1e6, true), optNum("maxUsesPerCustomer", 1, 1000, true)]) if (e) return e;
  for (const k of ["startsAt", "endsAt"]) {
    if (b[k] === undefined) continue;
    if (b[k] === null || b[k] === "") { out[k] = null; continue; }
    const t = Date.parse(b[k]);
    if (!Number.isFinite(t)) return { ok: false, code: "BAD_" + k.toUpperCase(), error: `${k} is invalid` };
    out[k] = new Date(t).toISOString();
  }
  if (out.startsAt && out.endsAt && out.endsAt <= out.startsAt) return { ok: false, code: "BAD_WINDOW", error: "endsAt must be after startsAt" };
  if (b.storeIds !== undefined) {
    out.storeIds = (Array.isArray(b.storeIds) ? b.storeIds : []).map((x) => String(x).trim()).filter(Boolean).slice(0, 100);
  }
  if (b.categories !== undefined) {
    out.categories = (Array.isArray(b.categories) ? b.categories : []).map((x) => String(x).trim().slice(0, 60)).filter(Boolean).slice(0, 50);
  }
  if (b.firstOrderOnly !== undefined) out.firstOrderOnly = b.firstOrderOnly === true;
  if (b.isActive !== undefined) out.isActive = b.isActive !== false;
  return { ok: true, value: out };
}

/** Uses so far, from orders (cancelled orders do not count). */
function usage(promoId, orders, customerId) {
  let total = 0, mine = 0, discountTotal = 0;
  for (const o of orders || []) {
    if (!o || !o.promo || String(o.promo.id) !== String(promoId)) continue;
    if (String(o.status || "") === "canceled") continue;
    total += 1;
    discountTotal += Number(o.promo.amount) || 0;
    if (customerId && String(o.customerId || "") === String(customerId)) mine += 1;
  }
  return { total, mine, discountTotal: money(discountTotal) };
}

/** Goods value that a code may discount: the whole basket, or only its categories. */
function eligibleSubtotal(items, byId, categories) {
  const cats = Array.isArray(categories) ? categories : [];
  let sum = 0;
  for (const it of items || []) {
    const src = byId && byId.get(String(it.id));
    if (cats.length && !(src && cats.includes(String(src.cat || "")))) continue;
    sum += (Number(it.qty) || 0) * (Number(it.price) || 0);
  }
  return money(sum);
}

/** Has this customer already got a (non-cancelled) order? */
function hasEarlierOrder(customerId, orders) {
  return (orders || []).some((o) => o && String(o.customerId || "") === String(customerId) && String(o.status || "") !== "canceled");
}

/**
 * @returns {{ok:true,amount:number,snapshot:object}|{ok:false,status:number,code:string,error:string}}
 */
function evaluate({ promo, subtotal, eligibleSubtotal: eligible, customerId, storeId, orders, now = new Date() }) {
  if (!promo || promo.isActive === false) return { ok: false, status: 404, code: "PROMO_INVALID", error: "Invalid code" };
  const t = now.getTime();
  if (promo.startsAt && t < Date.parse(promo.startsAt)) return { ok: false, status: 409, code: "PROMO_NOT_STARTED", error: "Code not active yet" };
  if (promo.endsAt && t > Date.parse(promo.endsAt)) return { ok: false, status: 409, code: "PROMO_EXPIRED", error: "Code expired" };
  if (Array.isArray(promo.storeIds) && promo.storeIds.length && !promo.storeIds.includes(String(storeId))) {
    return { ok: false, status: 409, code: "PROMO_STORE", error: "Code not valid for this store" };
  }
  if (!customerId) return { ok: false, status: 401, code: "LOGIN_REQUIRED", error: "Sign in to use a discount code" };
  const sub = money(subtotal);
  if (promo.minSubtotal && sub < promo.minSubtotal) return { ok: false, status: 409, code: "PROMO_MIN", error: "Basket below the minimum for this code", minSubtotal: promo.minSubtotal };
  if (promo.firstOrderOnly && hasEarlierOrder(customerId, orders)) return { ok: false, status: 409, code: "PROMO_FIRST_ONLY", error: "Only for a first order" };
  const base = eligible == null ? sub : Math.min(sub, money(eligible));
  if (Array.isArray(promo.categories) && promo.categories.length && !(base > 0)) return { ok: false, status: 409, code: "PROMO_CATEGORY", error: "No eligible items in the basket" };
  const u = usage(promo.id, orders, customerId);
  if (promo.maxUses && u.total >= promo.maxUses) return { ok: false, status: 409, code: "PROMO_EXHAUSTED", error: "Code fully used" };
  if (promo.maxUsesPerCustomer && u.mine >= promo.maxUsesPerCustomer) return { ok: false, status: 409, code: "PROMO_USED", error: "You already used this code" };
  let amount = promo.type === "percent" ? money((base * promo.value) / 100) : money(promo.value);
  if (promo.maxDiscount) amount = Math.min(amount, promo.maxDiscount);
  amount = Math.min(amount, base);
  if (!(amount > 0)) return { ok: false, status: 409, code: "PROMO_ZERO", error: "No discount for this basket" };
  return { ok: true, amount, snapshot: { id: promo.id, code: promo.code, type: promo.type, value: promo.value, amount, fundedBy: "platform", at: now.toISOString() } };
}

/** Discount actually granted on an order (never more than the goods subtotal). */
function discountOf(order) {
  const a = Number(order && order.promo && order.promo.amount);
  if (!Number.isFinite(a) || a <= 0) return 0;
  return Math.min(money(a), money(Number(order.subtotal) || 0));
}

/** What the customer pays for an order. */
const totalOf = (order) => money((Number(order.subtotal) || 0) + (Number(order.deliveryFee) || 0) - discountOf(order));

/** Goods amount the driver collects in cash and is charged for from the wallet. */
const goodsDue = (order) => {
  const wallet = Number(order && order.payment && order.payment.walletAmount) || 0; // paid up-front from the customer wallet: the driver does not collect it
  return money(Math.max(0, (Number(order.subtotal) || 0) - discountOf(order) - (wallet > 0 ? wallet : 0)));
};

module.exports = { TYPES, normalizeCode, validateDefinition, usage, eligibleSubtotal, hasEarlierOrder, evaluate, discountOf, totalOf, goodsDue };

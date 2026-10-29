"use strict";
/**
 * Per-order financial snapshot, store commission and manual settlements.
 *
 * - Commission is configured per store: {type:"percent"|"fixed"|"none", value}.
 *   It is charged on the GOODS subtotal (never on the delivery fee) and capped
 *   at the subtotal.
 * - The applied commission setting AND the resulting amounts are snapshotted on
 *   the order at creation (order.financials); later setting changes never
 *   rewrite history. Legacy orders have no snapshot and are reported as such.
 * - Settlements are entered manually by an authorised user, are append-only
 *   (voiding adds a reason, nothing is deleted) and have a unique reference.
 */

const COMMISSION_TYPES = Object.freeze(["none", "percent", "fixed"]);
const BOUNDS = Object.freeze({ percent: [0, 50], fixed: [0, 1000] });
const MAX_SETTLEMENT = 10000000;

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function normalizeCommission(c) {
  if (!c || !COMMISSION_TYPES.includes(c.type) || c.type === "none") return { type: "none", value: 0 };
  const b = BOUNDS[c.type];
  const v = Number(c.value);
  return { type: c.type, value: Number.isFinite(v) ? r2(Math.min(b[1], Math.max(b[0], v))) : 0 };
}

/** Strict validation for admin input: out-of-range is rejected, not clamped. */
function validateCommission(input) {
  const type = String(input && input.type);
  if (!COMMISSION_TYPES.includes(type)) return { ok: false, error: "type must be none, percent or fixed" };
  if (type === "none") return { ok: true, value: { type: "none", value: 0 } };
  const v = Number(input.value);
  const b = BOUNDS[type];
  if (input.value === "" || input.value === null || !Number.isFinite(v) || v < b[0] || v > b[1]) {
    return { ok: false, error: `value must be between ${b[0]} and ${b[1]} for ${type}` };
  }
  return { ok: true, value: { type, value: r2(v) } };
}

function commissionAmount(subtotal, commission) {
  const c = normalizeCommission(commission);
  const sub = Math.max(0, Number(subtotal) || 0);
  let amt = 0;
  if (c.type === "percent") amt = (sub * c.value) / 100;
  else if (c.type === "fixed") amt = c.value;
  return r2(Math.min(sub, amt));
}

/** Snapshot stored on the order at creation. */
function orderFinancials({ order, store, driverEarning, now = new Date() }) {
  const commission = normalizeCommission(store && store.commission);
  const subtotal = r2(order.subtotal);
  const deliveryFee = r2(order.deliveryFee);
  const commissionAmt = commissionAmount(subtotal, commission);
  const earn = r2(driverEarning);
  return {
    status: "open", // open -> final (delivered) | void (cancelled)
    paymentMethod: String(order.paymentMethod || ""),
    commission, // setting applied (snapshot)
    subtotal,
    deliveryFee,
    total: r2(order.total),
    promoDiscount: r2(order.promo && order.promo.amount ? Math.min(Number(order.promo.amount), subtotal) : 0), // platform-funded; store net unchanged
    commissionAmount: commissionAmt,
    businessNet: r2(subtotal - commissionAmt), // goods value owed to the business
    driverEarning: earn,
    platformDeliveryMargin: r2(deliveryFee - earn), // may be negative
    snapshotAt: now.toISOString(),
  };
}

/**
 * Recompute amounts after a pre-delivery receipt edit (items / fee), keeping
 * the commission SETTING that was snapshotted at creation. Only open records.
 */
function refresh(order, driverEarning, now = new Date()) {
  const f = order && order.financials;
  if (!f || f.status !== "open") return false;
  const fresh = orderFinancials({
    order,
    store: { commission: f.commission },
    driverEarning,
    now,
  });
  Object.assign(f, fresh, { status: "open", snapshotAt: f.snapshotAt, updatedAt: now.toISOString() });
  return true;
}

/** Idempotently close the financial record. Returns true when it changed. */
function finalize(order, now = new Date()) {
  const f = order && order.financials;
  if (!f) return false; // legacy order: nothing to finalize
  const st = String(order.status || "");
  const next = ["delivered", "done"].includes(st) ? "final" : ["canceled", "cancelled"].includes(st) ? "void" : null;
  if (!next || f.status === next) return false;
  if (f.status === "final") return false; // a closed record is never reopened or voided
  f.status = next;
  f.finalizedAt = now.toISOString();
  return true;
}

/* ------------------------------ settlements ------------------------------ */

function validateSettlement(input, existing = [], now = new Date()) {
  const storeId = String(input.storeId || "").trim();
  if (!storeId) return { ok: false, error: "storeId required" };
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_SETTLEMENT) return { ok: false, error: "Invalid amount" };
  const reference = String(input.reference || "").trim();
  if (reference.length < 3 || reference.length > 60) return { ok: false, error: "reference must be 3-60 characters" };
  const direction = String(input.direction || "to_store");
  if (!["to_store", "from_store"].includes(direction)) return { ok: false, error: "direction must be to_store or from_store" };
  const date = String(input.date || "").trim();
  const t = Date.parse(date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(t) || t > now.getTime() + 86400000) {
    return { ok: false, error: "date must be YYYY-MM-DD and not in the future" };
  }
  const dup = existing.find((s) => String(s.storeId) === storeId && String(s.reference).toLowerCase() === reference.toLowerCase());
  if (dup) return { ok: false, status: 409, error: "Duplicate reference for this store" };
  return {
    ok: true,
    value: { storeId, amount: r2(amount), reference, direction, date, note: String(input.note || "").trim().slice(0, 300) },
  };
}

/** Statement for one store: range totals + all-time balance owed to the store. */
function statement({ orders, settlements, storeId, from, to }) {
  const sid = String(storeId);
  const delivered = (orders || []).filter(
    (o) => String(o.restaurantId || "") === sid && ["delivered", "done"].includes(String(o.status || "")),
  );
  const when = (o) => Date.parse(o.deliveredAt || o.createdAt);
  const inRange = (t) => (!from || t >= from) && (!to || t <= to);
  const net = (o) => (o.financials ? o.financials.businessNet : r2(o.subtotal));
  const comm = (o) => (o.financials ? o.financials.commissionAmount : 0);
  const sumBy = (arr, f) => r2(arr.reduce((s, o) => s + (Number(f(o)) || 0), 0));
  const range = delivered.filter((o) => inRange(when(o)));
  const mine = (settlements || []).filter((s) => String(s.storeId) === sid && s.status !== "void");
  const paid = (arr) => r2(arr.filter((s) => s.direction !== "from_store").reduce((a, s) => a + s.amount, 0) - arr.filter((s) => s.direction === "from_store").reduce((a, s) => a + s.amount, 0));
  const rangeSettl = mine.filter((s) => inRange(Date.parse(s.date)));
  return {
    range: {
      orders: range.length,
      goods: sumBy(range, (o) => o.subtotal),
      commission: sumBy(range, comm),
      net: sumBy(range, net),
      deliveryFees: sumBy(range, (o) => o.deliveryFee),
      cashOrders: range.filter((o) => String(o.paymentMethod || "cod") === "cod").length,
      legacyOrdersWithoutSnapshot: range.filter((o) => !o.financials).length,
      settlementsNet: paid(rangeSettl),
    },
    allTime: {
      netEntitlement: sumBy(delivered, net),
      settledNet: paid(mine),
      balanceOwedToStore: r2(sumBy(delivered, net) - paid(mine)),
    },
  };
}

module.exports = {
  COMMISSION_TYPES, BOUNDS, MAX_SETTLEMENT,
  normalizeCommission, validateCommission, commissionAmount,
  orderFinancials, refresh, finalize, validateSettlement, statement,
};

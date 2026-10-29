"use strict";
/**
 * Reports & analytics (section 17) — PURE report builders. No express, no file I/O.
 *
 * Every number comes from authoritative records handed in by the caller:
 *   orders (+ their per-order financial snapshot `order.financials`), stores, drivers, customers
 *   (wallet ledgers), settlements, top-ups and exception cases. Nothing is estimated or invented.
 *
 * Definitions (stated once, used everywhere):
 *   - "delivered" = status delivered | done, dated by deliveredAt (fallback createdAt) — the same basis as
 *     lib/finance.js statement(), so the store statement and these reports always agree.
 *   - "canceled/rejected" are dated by canceledAt (fallback updatedAt / createdAt).
 *   - goods = order.subtotal, delivery fee = order.deliveryFee, total = order.total (what the customer is billed).
 *   - commission / business net / driver earning come from the snapshot taken at order time; legacy orders
 *     without a snapshot fall back exactly like statement(): commission 0, business net = subtotal,
 *     driver earning = driverEarnings.earningOf(order). They are counted and flagged (meta.legacyOrders).
 *   - platform net = commission + (delivery fee − driver earning) − platform-funded discount.
 *   - Money is summed in integer cents, so a column never drifts from the sum of its rows.
 *
 * Isolation: a "store" scope only ever sees orders whose restaurantId is its own; the scope's storeId is set by the
 * server from the authenticated membership, never from the query string. A "driver" scope only sees its own orders.
 * Columns flagged `fin` need finance.read; columns flagged `platform` are never shown to a store or a driver.
 */
const finance = require("./finance");
const driverEarnings = require("./driver-earnings");
const walletLedger = require("./wallet-ledger");
const orderPayment = require("./order-payment");

const DEFAULT_TZ = "Africa/Casablanca";
const MAX_RANGE_DAYS = 366;
const DEFAULT_RANGE_DAYS = 30;
const GRANULARITIES = Object.freeze(["day", "week", "month"]);
const DONE = Object.freeze(["delivered", "done"]);
const CANCELED = Object.freeze(["canceled", "cancelled"]);
const DEFAULT_PREP_DELAY_MIN = 15; // same default as lib/exceptions.js

const cents = (n) => Math.round((Number(n) + Number.EPSILON) * 100) || 0;
const fromCents = (c) => Math.round(c) / 100;
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const ts = (v) => {
  const n = Date.parse(v);
  return Number.isFinite(n) ? n : null;
};
const st = (o) => String((o && o.status) || "new").toLowerCase();
const isDone = (o) => DONE.includes(st(o));
const isCanceled = (o) => CANCELED.includes(st(o));
const clip = (s, n) =>
  String(s == null ? "" : s)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, n);

/* ------------------------------------------------------------------ *
 * Time helpers (calendar days are the platform's local days, not UTC)
 * ------------------------------------------------------------------ */

const dtfCache = new Map();
function dtf(tz) {
  let f = dtfCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    dtfCache.set(tz, f);
  }
  return f;
}
function validTz(tz) {
  try {
    dtf(tz).format(0);
    return true;
  } catch (_e) {
    return false;
  }
}
function parts(ms, tz) {
  const o = {};
  for (const p of dtf(tz).formatToParts(new Date(ms))) if (p.type !== "literal") o[p.type] = Number(p.value);
  return o;
}
/** local - UTC, in ms, at instant `ms` */
function tzOffsetMs(ms, tz) {
  const p = parts(ms, tz);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
}
const pad = (n) => String(n).padStart(2, "0");
function dayKey(ms, tz) {
  const p = parts(ms, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}
function validKey(k) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(k))) return false;
  const [y, m, d] = k.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
function addDays(key, n) {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}
function daysBetween(a, b) {
  const t = (k) => {
    const [y, m, d] = k.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((t(b) - t(a)) / 86400000);
}
function startOfDay(key, tz) {
  const [y, m, d] = key.split("-").map(Number);
  const base = Date.UTC(y, m - 1, d);
  const first = base - tzOffsetMs(base, tz);
  return base - tzOffsetMs(first, tz);
}
function weekStart(key) {
  const [y, m, d] = key.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return addDays(key, -((dow + 6) % 7)); // weeks start on Monday
}
function bucketOf(ms, gran, tz) {
  const k = dayKey(ms, tz);
  return gran === "month" ? k.slice(0, 7) : gran === "week" ? weekStart(k) : k;
}
function bucketKeys(range, gran) {
  const out = [];
  const seen = new Set();
  const n = daysBetween(range.fromKey, range.toKey);
  for (let i = 0; i <= n; i++) {
    const k = addDays(range.fromKey, i);
    const b = gran === "month" ? k.slice(0, 7) : gran === "week" ? weekStart(k) : k;
    if (!seen.has(b)) {
      seen.add(b);
      out.push(b);
    }
  }
  return out;
}

/**
 * Validates the date filter. Dates are YYYY-MM-DD in the platform timezone; the range is inclusive on both ends.
 * @returns {{ok:true,range:object}|{ok:false,code:string,error:string}}
 */
function parseRange(q = {}, { now = Date.now(), tz = DEFAULT_TZ } = {}) {
  if (!validTz(tz)) tz = DEFAULT_TZ;
  const today = dayKey(now, tz);
  let fromKey = q.from ? String(q.from).trim() : "";
  let toKey = q.to ? String(q.to).trim() : "";
  const preset = String(q.preset || "").trim();
  if (preset && !fromKey && !toKey) {
    if (preset === "today") fromKey = toKey = today;
    else if (preset === "yesterday") fromKey = toKey = addDays(today, -1);
    else if (preset === "7d") [fromKey, toKey] = [addDays(today, -6), today];
    else if (preset === "30d") [fromKey, toKey] = [addDays(today, -29), today];
    else if (preset === "this_month") [fromKey, toKey] = [today.slice(0, 8) + "01", today];
    else if (preset === "last_month") {
      const firstThis = today.slice(0, 8) + "01";
      const lastPrev = addDays(firstThis, -1);
      [fromKey, toKey] = [lastPrev.slice(0, 8) + "01", lastPrev];
    } else return { ok: false, code: "BAD_PRESET", error: "Unknown preset" };
  }
  if (fromKey && !validKey(fromKey)) return { ok: false, code: "BAD_DATE", error: "from must be YYYY-MM-DD" };
  if (toKey && !validKey(toKey)) return { ok: false, code: "BAD_DATE", error: "to must be YYYY-MM-DD" };
  if (!toKey) toKey = fromKey && fromKey > today ? fromKey : today;
  if (!fromKey) fromKey = addDays(toKey, -(DEFAULT_RANGE_DAYS - 1));
  if (fromKey > toKey) return { ok: false, code: "BAD_RANGE", error: "from must not be after to" };
  if (daysBetween(fromKey, toKey) + 1 > MAX_RANGE_DAYS) return { ok: false, code: "RANGE_TOO_LONG", error: `Range is limited to ${MAX_RANGE_DAYS} days` };
  return {
    ok: true,
    range: { fromKey, toKey, from: startOfDay(fromKey, tz), to: startOfDay(addDays(toKey, 1), tz) - 1, tz },
  };
}

const inRange = (t, range) => t != null && t >= range.from && t <= range.to;

/* ------------------------------------------------------------------ *
 * Per-order normalised amounts (single source for every report)
 * ------------------------------------------------------------------ */

const deliveredAtMs = (o) => ts(o.deliveredAt) || ts(o.createdAt); // same basis as finance.statement()
const canceledAtMs = (o) => ts(o.canceledAt) || ts(o.updatedAt) || ts(o.createdAt);

function amounts(o) {
  const f = o && o.financials && typeof o.financials === "object" ? o.financials : null;
  const subtotal = r2(o.subtotal);
  const deliveryFee = r2(o.deliveryFee);
  const total = r2(o.total);
  const promoRaw = f ? f.promoDiscount : o.promo && o.promo.amount ? Math.min(Number(o.promo.amount), subtotal) : 0;
  const driverEarning = f ? r2(f.driverEarning) : r2(driverEarnings.earningOf(o));
  const commission = f ? r2(f.commissionAmount) : 0;
  const businessNet = f ? r2(f.businessNet) : subtotal; // identical fallback to finance.statement()
  const margin = f ? r2(f.platformDeliveryMargin) : r2(deliveryFee - driverEarning);
  const pay = o.payment && typeof o.payment === "object" ? o.payment : {};
  const walletPaid = r2(pay.walletAmount || 0);
  const cashDue = Number.isFinite(Number(pay.amountDueOnDelivery)) ? r2(pay.amountDueOnDelivery) : total;
  const discount = r2(promoRaw);
  return {
    subtotal, deliveryFee, total, discount, commission, businessNet, driverEarning, margin,
    platformNet: r2(commission + margin - discount),
    walletPaid, cashDue,
    legacy: !f,
    finStatus: f ? String(f.status || "") : "",
    method: String(o.paymentMethod || pay.method || "cod").toLowerCase(),
  };
}

/** Whole-minute difference, only when both ends exist and the span is sane (0 .. 7 days). */
function minutesBetween(a, b) {
  const x = ts(a), y = ts(b);
  if (x == null || y == null) return null;
  const m = (y - x) / 60000;
  return m >= 0 && m <= 7 * 1440 ? m : null;
}

const nameIn = (v, lang) => {
  if (v && typeof v === "object") return clip(v[lang] || v.en || v.fr || v.ar || Object.values(v).find((x) => typeof x === "string") || "", 120);
  return clip(v, 120);
};

/* ------------------------------------------------------------------ *
 * Scope + table helpers
 * ------------------------------------------------------------------ */

function scopedOrders(D, ctx) {
  let list = Array.isArray(D.orders) ? D.orders.filter((o) => o && typeof o === "object") : [];
  if (ctx.scope === "store") {
    const sid = String(ctx.storeId || "");
    if (!sid) return []; // a store scope without a store id sees nothing, never everything
    // same visibility rule as the store dashboard: an order is the store's only after the platform released it
    list = list.filter((o) => String(o.restaurantId || "") === sid && st(o) !== "new");
  } else if (ctx.scope === "driver") {
    const did = String(ctx.driverId || "");
    if (!did) return [];
    list = list.filter((o) => String(o.driverId || "") === did);
  } else {
    if (ctx.storeId) list = list.filter((o) => String(o.restaurantId || "") === String(ctx.storeId));
    if (ctx.driverId) list = list.filter((o) => String(o.driverId || "") === String(ctx.driverId));
  }
  return list;
}

function scopedStores(D, ctx) {
  const all = Array.isArray(D.stores) ? D.stores.filter((s) => s && typeof s === "object") : [];
  if (ctx.scope === "store") return all.filter((s) => String(s.id) === String(ctx.storeId));
  if (ctx.storeId) return all.filter((s) => String(s.id) === String(ctx.storeId));
  return all;
}

const col = (key, type, extra) => ({ key, type, ...(extra || {}) });
const M = (key, extra) => col(key, "money", extra);
const I = (key, extra) => col(key, "int", extra);
const P = (key, extra) => col(key, "pct", extra);
const MIN = (key, extra) => col(key, "minutes", extra);
const T = (key, extra) => col(key, "text", extra);

function table(id, columns, rows, totals) {
  return { id, columns, rows, totals: totals || null };
}

/** Totals row from cent accumulators ({key: cents|count}) + the table's money columns. */
function totalsFrom(acc, columns) {
  const out = {};
  for (const c of columns) {
    if (!(c.key in acc)) continue;
    out[c.key] = c.type === "money" ? fromCents(acc[c.key]) : acc[c.key];
  }
  return out;
}

const avg = (sum, n, digits = 1) => (n > 0 ? Math.round((sum / n) * 10 ** digits) / 10 ** digits : null);

/* ------------------------------------------------------------------ *
 * 1. Sales / orders / revenue — daily, weekly, monthly
 * ------------------------------------------------------------------ */

function buildSales(D, p, ctx) {
  const orders = scopedOrders(D, ctx);
  const keys = bucketKeys(p.range, p.gran);
  const zero = () => ({ placed: 0, delivered: 0, canceled: 0, goods: 0, deliveryFees: 0, discounts: 0, total: 0, commission: 0, businessNet: 0, driverEarnings: 0, platformNet: 0 });
  const rows = new Map(keys.map((k) => [k, zero()]));
  const tot = zero();
  let legacy = 0;
  const add = (b, f) => {
    f(rows.get(b));
    f(tot);
  };
  for (const o of orders) {
    const created = ts(o.createdAt);
    if (inRange(created, p.range)) add(bucketOf(created, p.gran, p.range.tz), (r) => (r.placed += 1));
    if (isDone(o)) {
      const t = deliveredAtMs(o);
      if (!inRange(t, p.range)) continue;
      const a = amounts(o);
      if (a.legacy) legacy++;
      add(bucketOf(t, p.gran, p.range.tz), (r) => {
        r.delivered += 1;
        r.goods += cents(a.subtotal);
        r.deliveryFees += cents(a.deliveryFee);
        r.discounts += cents(a.discount);
        r.total += cents(a.total);
        r.commission += cents(a.commission);
        r.businessNet += cents(a.businessNet);
        r.driverEarnings += cents(a.driverEarning);
        r.platformNet += cents(a.platformNet);
      });
    } else if (isCanceled(o)) {
      const t = canceledAtMs(o);
      if (inRange(t, p.range)) add(bucketOf(t, p.gran, p.range.tz), (r) => (r.canceled += 1));
    }
  }
  const columns = [
    T("period"), I("placed"), I("delivered"), I("canceled"), M("goods"), M("deliveryFees"), M("discounts"), M("total"), M("avgOrder"),
    M("commission", { fin: true }), M("businessNet", { fin: true }),
    M("driverEarnings", { fin: true, platform: true }), M("platformNet", { fin: true, platform: true }),
  ];
  const fin = (r) => ({
    placed: r.placed, delivered: r.delivered, canceled: r.canceled,
    goods: fromCents(r.goods), deliveryFees: fromCents(r.deliveryFees), discounts: fromCents(r.discounts), total: fromCents(r.total),
    avgOrder: r.delivered ? fromCents(Math.round(r.total / r.delivered)) : 0,
    commission: fromCents(r.commission), businessNet: fromCents(r.businessNet),
    driverEarnings: fromCents(r.driverEarnings), platformNet: fromCents(r.platformNet),
  });
  const outRows = keys.map((k) => ({ period: k, ...fin(rows.get(k)) }));
  return { tables: [table("sales", columns, outRows, { period: null, ...fin(tot) })], legacyOrders: legacy };
}

/* ------------------------------------------------------------------ *
 * 2. Per-order financial breakdown
 * ------------------------------------------------------------------ */

function buildOrderFinancials(D, p, ctx) {
  const want = p.status === "canceled" ? "canceled" : "delivered";
  const storeName = new Map((D.stores || []).map((s) => [String(s.id), nameIn(s.name, p.lang)]));
  const orders = scopedOrders(D, ctx);
  const rows = [];
  const acc = { subtotal: 0, deliveryFee: 0, discount: 0, total: 0, walletPaid: 0, cashDue: 0, commission: 0, businessNet: 0, driverEarning: 0, margin: 0, platformNet: 0 };
  let legacy = 0;
  for (const o of orders) {
    const t = want === "delivered" ? (isDone(o) ? deliveredAtMs(o) : null) : isCanceled(o) ? canceledAtMs(o) : null;
    if (!inRange(t, p.range)) continue;
    const a = amounts(o);
    if (a.legacy) legacy++;
    rows.push({
      orderId: String(o.id), date: new Date(t).toISOString(), store: storeName.get(String(o.restaurantId || "")) || String(o.restaurantId || ""),
      status: st(o), paymentMethod: a.method,
      subtotal: a.subtotal, deliveryFee: a.deliveryFee, discount: a.discount, total: a.total,
      walletPaid: a.walletPaid, cashDue: a.cashDue,
      commission: a.commission, businessNet: a.businessNet, driverEarning: a.driverEarning, margin: a.margin, platformNet: a.platformNet,
      basis: a.legacy ? "legacy" : "snapshot", finStatus: a.finStatus,
    });
    for (const k of Object.keys(acc)) acc[k] += cents(a[k]);
  }
  rows.sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : String(x.orderId).localeCompare(String(y.orderId))));
  const columns = [
    T("orderId"), col("date", "datetime"), T("store", { platform: true }), col("status", "enum", { enum: "status", platform: true }), col("paymentMethod", "enum", { enum: "method" }),
    M("subtotal"), M("deliveryFee"), M("discount"), M("total"),
    M("walletPaid", { platform: true }), M("cashDue", { platform: true }),
    M("commission", { fin: true }), M("businessNet", { fin: true }),
    M("driverEarning", { fin: true, platform: true }), M("margin", { fin: true, platform: true }), M("platformNet", { fin: true, platform: true }),
    col("basis", "enum", { enum: "basis" }), col("finStatus", "enum", { enum: "finStatus" }),
  ];
  return { tables: [table("orders", columns, rows, totalsFrom(acc, columns))], legacyOrders: legacy };
}

/* ------------------------------------------------------------------ *
 * 3. Commissions & settlements (per business)
 * ------------------------------------------------------------------ */

function commissionRule(store) {
  const c = finance.normalizeCommission(store && store.commission);
  return c.type === "percent" ? `${c.value}%` : c.type === "fixed" ? `${c.value.toFixed(2)} fixed` : "—";
}

function buildCommissions(D, p, ctx) {
  const stores = scopedStores(D, ctx);
  const orders = Array.isArray(D.orders) ? D.orders : [];
  const settlements = Array.isArray(D.settlements) ? D.settlements : [];
  const rows = [];
  const acc = { orders: 0, goods: 0, deliveryFees: 0, commission: 0, businessNet: 0, cashOrders: 0, settled: 0, balance: 0 };
  let legacy = 0;
  for (const s of stores) {
    // statement() is the same routine the store statement endpoint uses -> identical numbers by construction
    const stmt = finance.statement({ orders, settlements, storeId: String(s.id), from: p.range.from, to: p.range.to });
    const r = stmt.range;
    const row = {
      store: nameIn(s.name, p.lang) || String(s.id), storeId: String(s.id), rule: commissionRule(s),
      orders: r.orders, goods: r.goods, deliveryFees: r.deliveryFees, commission: r.commission, businessNet: r.net, cashOrders: r.cashOrders,
      settled: r.settlementsNet, balance: stmt.allTime.balanceOwedToStore, legacyOrders: r.legacyOrdersWithoutSnapshot,
    };
    if (!row.orders && !row.settled && !row.balance) continue; // nothing happened for this business
    legacy += r.legacyOrdersWithoutSnapshot;
    rows.push(row);
    for (const k of Object.keys(acc)) acc[k] += k === "orders" || k === "cashOrders" ? row[k] : cents(row[k]);
  }
  rows.sort((a, b) => b.goods - a.goods || a.store.localeCompare(b.store));
  const columns = [
    T("store", { hideInStore: true }), T("rule"), I("orders"), M("goods"), M("deliveryFees"), M("commission"), M("businessNet"), I("cashOrders"),
    M("settled"), M("balance"), I("legacyOrders"),
  ];
  return { tables: [table("commissions", columns, rows, totalsFrom(acc, columns))], legacyOrders: legacy };
}

function buildSettlements(D, p, ctx) {
  const allowed = new Set(scopedStores(D, ctx).map((s) => String(s.id)));
  const name = new Map((D.stores || []).map((s) => [String(s.id), nameIn(s.name, p.lang)]));
  const rows = [];
  let net = 0;
  for (const s of Array.isArray(D.settlements) ? D.settlements : []) {
    if (!s || !allowed.has(String(s.storeId))) continue;
    const day = String(s.date || "");
    if (day < p.range.fromKey || day > p.range.toKey) continue;
    const void_ = s.status === "void";
    rows.push({
      reference: clip(s.reference, 60), date: day, store: name.get(String(s.storeId)) || String(s.storeId),
      direction: s.direction === "from_store" ? "from_store" : "to_store", amount: r2(s.amount), status: void_ ? "void" : "recorded",
      voidReason: void_ ? clip(s.voidReason, 300) : "", note: clip(s.note, 300),
    });
    if (!void_) net += (s.direction === "from_store" ? -1 : 1) * cents(s.amount);
  }
  rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.reference.localeCompare(b.reference)));
  const columns = [T("reference"), col("date", "date"), T("store", { hideInStore: true }), col("direction", "enum", { enum: "direction" }), M("amount"), col("status", "enum", { enum: "settlementStatus" }), T("voidReason"), T("note")];
  // net paid = to_store − from_store, void entries excluded (same rule as statement())
  return { tables: [table("settlements", columns, rows, { amount: fromCents(net) })], legacyOrders: 0 };
}

/* ------------------------------------------------------------------ *
 * 4. Cash, electronic (transfer top-ups), wallet, refunds
 * ------------------------------------------------------------------ */

const walletsOf = (D) => [
  ...(Array.isArray(D.customers) ? D.customers : []).map((w) => ({ walletType: "customer", w })),
  ...(Array.isArray(D.drivers) ? D.drivers : []).map((w) => ({ walletType: "driver", w })),
];

function buildPayments(D, p, ctx) {
  const orders = scopedOrders(D, ctx);
  // a) delivered orders by payment method
  const byM = new Map();
  for (const o of orders) {
    if (!isDone(o) || !inRange(deliveredAtMs(o), p.range)) continue;
    const a = amounts(o);
    const r = byM.get(a.method) || { method: a.method, orders: 0, total: 0, walletPaid: 0, cashDue: 0 };
    r.orders += 1;
    r.total += cents(a.total);
    r.walletPaid += cents(a.walletPaid);
    r.cashDue += cents(a.cashDue);
    byM.set(a.method, r);
  }
  const mRows = [...byM.values()].sort((x, y) => y.total - x.total).map((r) => ({ ...r, total: fromCents(r.total), walletPaid: fromCents(r.walletPaid), cashDue: fromCents(r.cashDue) }));
  const mAcc = mRows.reduce((s, r) => ({ orders: s.orders + r.orders, total: s.total + cents(r.total), walletPaid: s.walletPaid + cents(r.walletPaid), cashDue: s.cashDue + cents(r.cashDue) }), { orders: 0, total: 0, walletPaid: 0, cashDue: 0 });
  const mCols = [col("method", "enum", { enum: "method" }), I("orders"), M("total"), M("walletPaid"), M("cashDue")];

  // b) wallet ledger movements (real entries, dated by entry time)
  const mv = new Map();
  for (const { walletType, w } of walletsOf(D)) {
    for (const h of Array.isArray(w.walletHistory) ? w.walletHistory : []) {
      if (!inRange(ts(h.createdAt), p.range)) continue;
      const key = walletType + "|" + String(h.type || "adjustment");
      const r = mv.get(key) || { walletType, type: String(h.type || "adjustment"), entries: 0, credits: 0, debits: 0 };
      r.entries += 1;
      if (Number(h.amount) >= 0) r.credits += cents(h.amount);
      else r.debits += cents(-Number(h.amount));
      mv.set(key, r);
    }
  }
  const wRows = [...mv.values()]
    .sort((a, b) => a.walletType.localeCompare(b.walletType) || a.type.localeCompare(b.type))
    .map((r) => ({ walletType: r.walletType, type: r.type, entries: r.entries, credits: fromCents(r.credits), debits: fromCents(r.debits), net: fromCents(r.credits - r.debits) }));
  const wAcc = wRows.reduce((s, r) => ({ entries: s.entries + r.entries, credits: s.credits + cents(r.credits), debits: s.debits + cents(r.debits), net: s.net + cents(r.net) }), { entries: 0, credits: 0, debits: 0, net: 0 });
  const wCols = [col("walletType", "enum", { enum: "walletType" }), col("type", "enum", { enum: "entry" }), I("entries"), M("credits"), M("debits"), M("net")];

  // c) manual-transfer top-up requests ("electronic" money in): by status
  const tp = new Map();
  for (const t of Array.isArray(D.topups) ? D.topups : []) {
    if (!inRange(ts(t.createdAt), p.range)) continue;
    const walletType = t.walletType === "customer" ? "customer" : "driver";
    const key = walletType + "|" + String(t.status || "pending");
    const r = tp.get(key) || { walletType, status: String(t.status || "pending"), requests: 0, amount: 0 };
    r.requests += 1;
    r.amount += cents(t.amount);
    tp.set(key, r);
  }
  const tRows = [...tp.values()].sort((a, b) => a.walletType.localeCompare(b.walletType) || a.status.localeCompare(b.status)).map((r) => ({ ...r, amount: fromCents(r.amount) }));
  const tAcc = tRows.reduce((s, r) => ({ requests: s.requests + r.requests, amount: s.amount + cents(r.amount) }), { requests: 0, amount: 0 });
  const tCols = [col("walletType", "enum", { enum: "walletType" }), col("status", "enum", { enum: "topupStatus" }), I("requests"), M("amount")];

  // d) refunds: completed (ledger) vs still owed (canceled orders whose wallet part was not returned yet)
  let done = { count: 0, amount: 0 };
  for (const c of Array.isArray(D.customers) ? D.customers : []) {
    for (const h of Array.isArray(c.walletHistory) ? c.walletHistory : []) {
      if (h.type === "order_refund" && inRange(ts(h.createdAt), p.range)) {
        done.count += 1;
        done.amount += cents(h.amount);
      }
    }
  }
  let owed = { count: 0, amount: 0 };
  for (const o of orders) {
    if (orderPayment.needsRefund(o)) {
      owed.count += 1;
      owed.amount += cents(o.payment.walletAmount);
    }
  }
  const fRows = [
    { kind: "completed", count: done.count, amount: fromCents(done.amount) },
    { kind: "pending", count: owed.count, amount: fromCents(owed.amount) },
  ];
  const fCols = [col("kind", "enum", { enum: "refundKind" }), I("count"), M("amount")];

  // e) is every stored balance equal to the sum of its ledger entries?
  const cons = new Map();
  for (const { walletType, w } of walletsOf(D)) {
    const rc = walletLedger.reconcile({ walletBalance: w.walletBalance, walletHistory: Array.isArray(w.walletHistory) ? w.walletHistory.slice() : [] });
    const r = cons.get(walletType) || { walletType, wallets: 0, mismatched: 0, diff: 0 };
    r.wallets += 1;
    if (!rc.ok) {
      r.mismatched += 1;
      r.diff += cents(Math.abs(rc.diff));
    }
    cons.set(walletType, r);
  }
  const cRows = [...cons.values()].sort((a, b) => a.walletType.localeCompare(b.walletType)).map((r) => ({ ...r, diff: fromCents(r.diff) }));
  const cCols = [col("walletType", "enum", { enum: "walletType" }), I("wallets"), I("mismatched"), M("diff")];

  return {
    tables: [
      table("byMethod", mCols, mRows, totalsFrom(mAcc, mCols)),
      table("walletMovements", wCols, wRows, totalsFrom(wAcc, wCols)),
      table("topups", tCols, tRows, totalsFrom(tAcc, tCols)),
      table("refunds", fCols, fRows, null),
      table("consistency", cCols, cRows, null),
    ],
    legacyOrders: 0,
  };
}

/* ------------------------------------------------------------------ *
 * 5. Drivers: earnings, deliveries, performance
 * ------------------------------------------------------------------ */

function driverStats(D, p, ctx) {
  const orders = scopedOrders(D, ctx);
  const by = new Map();
  const get = (id) => {
    let r = by.get(id);
    if (!r) by.set(id, (r = { driverId: id, delivered: 0, canceled: 0, km: 0, earnings: 0, cash: 0, mins: 0, minsN: 0, stars: 0, rated: 0 }));
    return r;
  };
  for (const o of orders) {
    const id = String(o.driverId || "");
    if (!id) continue;
    if (isDone(o) && inRange(deliveredAtMs(o), p.range)) {
      const r = get(id);
      const a = amounts(o);
      r.delivered += 1;
      r.earnings += cents(a.driverEarning);
      r.cash += a.method === "cod" || a.cashDue > 0 ? cents(a.cashDue) : 0;
      const km = Number(o.deliveryPricing && o.deliveryPricing.km);
      if (Number.isFinite(km) && km > 0) r.km += km;
      const m = minutesBetween(o.assignedAt || o.acceptedAt, o.deliveredAt);
      if (m != null) {
        r.mins += m;
        r.minsN += 1;
      }
    } else if (isCanceled(o) && inRange(canceledAtMs(o), p.range)) {
      get(id).canceled += 1;
    }
    const rt = o.driverRating;
    if (rt && Number(rt.stars) >= 1 && Number(rt.stars) <= 5 && inRange(ts(rt.createdAt) || deliveredAtMs(o), p.range)) {
      const r = get(id);
      r.stars += Number(rt.stars);
      r.rated += 1;
    }
  }
  return by;
}

function buildDrivers(D, p, ctx) {
  const by = driverStats(D, p, ctx);
  const info = new Map((D.drivers || []).map((d) => [String(d.id), d]));
  const rows = [];
  const acc = { delivered: 0, canceled: 0, km: 0, earnings: 0, cash: 0 };
  for (const r of by.values()) {
    const d = info.get(r.driverId) || {};
    rows.push({
      driver: clip(d.name || d.fullName || r.driverId, 80), driverId: r.driverId, driverStatus: String(d.status || ""),
      delivered: r.delivered, canceled: r.canceled, km: Math.round(r.km * 10) / 10, avgDeliveryMin: avg(r.mins, r.minsN),
      avgRating: avg(r.stars, r.rated), ratings: r.rated, earnings: fromCents(r.earnings), cash: fromCents(r.cash), walletBalance: r2(d.walletBalance || 0),
    });
    acc.delivered += r.delivered; acc.canceled += r.canceled; acc.km += r.km; acc.earnings += r.earnings; acc.cash += r.cash;
  }
  rows.sort((a, b) => b.delivered - a.delivered || a.driver.localeCompare(b.driver));
  rows.forEach((r, i) => (r.rank = i + 1));
  const columns = [
    I("rank"), T("driver"), col("driverStatus", "enum", { enum: "driverStatus" }), I("delivered"), I("canceled"), col("km", "number"), MIN("avgDeliveryMin"),
    col("avgRating", "number"), I("ratings"), M("earnings", { fin: true }), M("cash", { fin: true }), M("walletBalance", { fin: true }),
  ];
  const totals = { delivered: acc.delivered, canceled: acc.canceled, km: Math.round(acc.km * 10) / 10, earnings: fromCents(acc.earnings), cash: fromCents(acc.cash) };
  return { tables: [table("drivers", columns, rows, totals)], legacyOrders: 0 };
}

function buildDriverEarnings(D, p, ctx) {
  const orders = scopedOrders(D, ctx);
  const keys = bucketKeys(p.range, p.gran);
  const zero = () => ({ deliveries: 0, km: 0, earnings: 0, cash: 0 });
  const rows = new Map(keys.map((k) => [k, zero()]));
  const tot = zero();
  for (const o of orders) {
    if (!o.driverId || !isDone(o)) continue;
    const t = deliveredAtMs(o);
    if (!inRange(t, p.range)) continue;
    const a = amounts(o);
    const km = Number(o.deliveryPricing && o.deliveryPricing.km);
    for (const r of [rows.get(bucketOf(t, p.gran, p.range.tz)), tot]) {
      r.deliveries += 1;
      r.earnings += cents(a.driverEarning);
      r.cash += cents(a.cashDue);
      if (Number.isFinite(km) && km > 0) r.km += km;
    }
  }
  const out = (r) => ({ deliveries: r.deliveries, km: Math.round(r.km * 10) / 10, earnings: fromCents(r.earnings), avgEarning: r.deliveries ? fromCents(Math.round(r.earnings / r.deliveries)) : 0, cash: fromCents(r.cash) });
  const columns = [T("period"), I("deliveries"), col("km", "number"), M("earnings"), M("avgEarning"), M("cash")];
  return { tables: [table("driverEarnings", columns, keys.map((k) => ({ period: k, ...out(rows.get(k)) })), { period: null, ...out(tot) })], legacyOrders: 0 };
}

/* ------------------------------------------------------------------ *
 * 6. Cancelled / rejected / delayed / failed orders with reasons
 * ------------------------------------------------------------------ */

function exceptionEvents(D, p, ctx) {
  const prepDelay = Math.min(240, Math.max(3, Number(D.exSettings && D.exSettings.prepDelayMin) || DEFAULT_PREP_DELAY_MIN));
  const now = Number.isFinite(D.now) ? D.now : Date.now();
  const storeName = new Map((D.stores || []).map((s) => [String(s.id), nameIn(s.name, p.lang)]));
  const driverName = new Map((D.drivers || []).map((d) => [String(d.id), clip(d.name || d.fullName || d.id, 60)]));
  const ev = [];
  for (const o of scopedOrders(D, ctx)) {
    const base = {
      orderId: String(o.id), store: storeName.get(String(o.restaurantId || "")) || String(o.restaurantId || ""),
      driver: o.driverId ? driverName.get(String(o.driverId)) || String(o.driverId) : "", total: r2(o.total),
    };
    if (isCanceled(o)) {
      const t = canceledAtMs(o);
      if (inRange(t, p.range)) {
        const by = String(o.canceledBy || o.cancelledBy || "").toLowerCase();
        const category = by === "store" ? "rejected_store" : by === "customer" ? "canceled_customer" : by === "admin" ? "canceled_admin" : by === "driver" ? "canceled_driver" : "canceled_other";
        ev.push({ ...base, date: new Date(t).toISOString(), category, reason: clip(o.cancelReason || o.rejectReason, 300), detail: "" });
      }
    }
    // delayed preparation (same rule as lib/exceptions.js): accepted by the store, "ready" later than expected + tolerance
    const acc = ts(o.storeAcceptedAt);
    if (acc != null && inRange(acc, p.range) && !isCanceled(o)) {
      const ready = ts(o.restaurantReadyAt);
      const end = ready != null ? ready : st(o) === "admin_accepted" ? now : null; // still preparing counts while it is late
      if (end != null) {
        const spent = Math.round((end - acc) / 60000);
        const expected = Number(o.prepMinutes) > 0 ? Number(o.prepMinutes) : 0;
        const limit = expected ? expected + prepDelay : prepDelay;
        if (spent > limit) ev.push({ ...base, date: new Date(acc).toISOString(), category: "delayed_preparation", reason: "", detail: `${spent} / ${limit} min` });
      }
    }
    if (st(o) === "failed_delivery" || o.deliveryFailedAt || o.failedDelivery) {
      const t = ts(o.deliveryFailedAt) || ts(o.updatedAt) || ts(o.createdAt);
      if (inRange(t, p.range)) {
        ev.push({ ...base, date: new Date(t).toISOString(), category: "failed_delivery", reason: clip((o.failedDelivery && o.failedDelivery.reason) || o.deliveryFailReason, 300), detail: "" });
      }
    }
  }
  return ev;
}

function buildExceptions(D, p, ctx) {
  const ev = exceptionEvents(D, p, ctx);
  const cat = new Map();
  const rs = new Map();
  for (const e of ev) {
    cat.set(e.category, (cat.get(e.category) || 0) + 1);
    const k = e.category + "|" + e.reason;
    const r = rs.get(k) || { category: e.category, reason: e.reason, count: 0 };
    r.count += 1;
    rs.set(k, r);
  }
  const total = ev.length;
  const catRows = [...cat.entries()].sort((a, b) => b[1] - a[1]).map(([category, count]) => ({ category, count, share: total ? Math.round((count / total) * 1000) / 10 : 0 }));
  const reasonRows = [...rs.values()].sort((a, b) => b.count - a.count || a.category.localeCompare(b.category)).slice(0, 100);
  const detail = ev.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.orderId.localeCompare(b.orderId)));
  const tables = [
    table("byCategory", [col("category", "enum", { enum: "category" }), I("count"), P("share")], catRows, { count: total }),
    table("byReason", [col("category", "enum", { enum: "category" }), T("reason"), I("count")], reasonRows, null),
    table("exceptionOrders", [T("orderId"), col("date", "datetime"), col("category", "enum", { enum: "category" }), T("reason"), T("detail"), T("store", { platform: true }), T("driver", { platform: true }), M("total")], detail, null),
  ];
  if (ctx.scope === "admin" && Array.isArray(D.cases)) {
    const cs = new Map();
    for (const c of D.cases) {
      if (!c || !inRange(ts(c.createdAt), p.range)) continue;
      const k = String(c.type) + "|" + String(c.status);
      const r = cs.get(k) || { caseType: String(c.type), caseStatus: String(c.status), count: 0 };
      r.count += 1;
      cs.set(k, r);
    }
    tables.push(table("cases", [col("caseType", "enum", { enum: "caseType" }), col("caseStatus", "enum", { enum: "caseStatus" }), I("count")], [...cs.values()].sort((a, b) => a.caseType.localeCompare(b.caseType) || a.caseStatus.localeCompare(b.caseStatus)), null));
  }
  return { tables, legacyOrders: 0 };
}

/* ------------------------------------------------------------------ *
 * 7. Comparisons between restaurants / stores / drivers
 * ------------------------------------------------------------------ */

function buildComparison(D, p, ctx) {
  const stores = scopedStores(D, ctx);
  const orders = scopedOrders(D, ctx);
  const info = new Map(stores.map((s) => [String(s.id), s]));
  const by = new Map();
  const get = (id) => {
    let r = by.get(id);
    if (!r) by.set(id, (r = { id, placed: 0, delivered: 0, canceled: 0, goods: 0, commission: 0, prepM: 0, prepN: 0, delM: 0, delN: 0 }));
    return r;
  };
  for (const o of orders) {
    const id = String(o.restaurantId || "");
    if (!id) continue;
    if (inRange(ts(o.createdAt), p.range)) get(id).placed += 1;
    if (isDone(o) && inRange(deliveredAtMs(o), p.range)) {
      const r = get(id), a = amounts(o);
      r.delivered += 1; r.goods += cents(a.subtotal); r.commission += cents(a.commission);
      const pm = minutesBetween(o.storeAcceptedAt || o.adminAcceptedAt, o.restaurantReadyAt);
      if (pm != null) { r.prepM += pm; r.prepN += 1; }
      const dm = minutesBetween(o.assignedAt || o.acceptedAt, o.deliveredAt);
      if (dm != null) { r.delM += dm; r.delN += 1; }
    } else if (isCanceled(o) && inRange(canceledAtMs(o), p.range)) get(id).canceled += 1;
  }
  const rows = [...by.values()].map((r) => {
    const s = info.get(r.id) || {};
    const closed = r.delivered + r.canceled;
    return {
      store: nameIn(s.name, p.lang) || r.id, storeType: String(s.type || "restaurant"), placed: r.placed, delivered: r.delivered, canceled: r.canceled,
      cancelRate: closed ? Math.round((r.canceled / closed) * 1000) / 10 : 0, goods: fromCents(r.goods), avgOrder: r.delivered ? fromCents(Math.round(r.goods / r.delivered)) : 0,
      commission: fromCents(r.commission), avgPrepMin: avg(r.prepM, r.prepN), avgDeliveryMin: avg(r.delM, r.delN),
    };
  }).sort((a, b) => b.goods - a.goods || b.delivered - a.delivered || a.store.localeCompare(b.store));
  rows.forEach((r, i) => (r.rank = i + 1));
  const sCols = [
    I("rank"), T("store"), col("storeType", "enum", { enum: "storeType" }), I("placed"), I("delivered"), I("canceled"), P("cancelRate"),
    M("goods"), M("avgOrder"), M("commission", { fin: true }), MIN("avgPrepMin"), MIN("avgDeliveryMin"),
  ];
  const sTot = rows.reduce((s, r) => ({ placed: s.placed + r.placed, delivered: s.delivered + r.delivered, canceled: s.canceled + r.canceled, goods: s.goods + cents(r.goods), commission: s.commission + cents(r.commission) }), { placed: 0, delivered: 0, canceled: 0, goods: 0, commission: 0 });
  const types = new Map();
  for (const r of rows) {
    const t = types.get(r.storeType) || { storeType: r.storeType, stores: 0, delivered: 0, goods: 0 };
    t.stores += 1; t.delivered += r.delivered; t.goods += cents(r.goods);
    types.set(r.storeType, t);
  }
  const tRows = [...types.values()].sort((a, b) => b.goods - a.goods).map((t) => ({ ...t, goods: fromCents(t.goods) }));
  const drv = buildDrivers(D, p, ctx).tables[0];
  drv.id = "driversComparison";
  return {
    tables: [
      table("storesComparison", sCols, rows, { placed: sTot.placed, delivered: sTot.delivered, canceled: sTot.canceled, goods: fromCents(sTot.goods), commission: fromCents(sTot.commission) }),
      table("byStoreType", [col("storeType", "enum", { enum: "storeType" }), I("stores"), I("delivered"), M("goods")], tRows, null),
      drv,
    ],
    legacyOrders: 0,
  };
}

/* ------------------------------------------------------------------ *
 * 8. Reconciliation: do the reports agree with the order + ledger records?
 * ------------------------------------------------------------------ */

const near = (a, b) => Math.abs(cents(a) - cents(b)) <= 1;

function buildReconcile(D, p, ctx) {
  const checks = [];
  const issues = [];
  const addIssue = (kind, ref, expected, actual, detail) => {
    if (issues.length < 500) issues.push({ kind, ref: String(ref), expected: expected == null ? "" : String(expected), actual: actual == null ? "" : String(actual), detail: clip(detail, 200) });
  };
  const check = (id, ok, expected, actual, count) => checks.push({ check: id, status: ok ? "ok" : "fail", expected, actual, diff: typeof expected === "number" && typeof actual === "number" ? r2(actual - expected) : null, count: count || 0 });

  const orders = scopedOrders(D, ctx);
  const delivered = orders.filter((o) => isDone(o) && inRange(deliveredAtMs(o), p.range));

  // 1) three independent aggregation paths over the same delivered orders must agree
  const sumOrders = fromCents(delivered.reduce((s, o) => s + cents(o.total), 0));
  const perOrder = buildOrderFinancials(D, { ...p, status: "delivered" }, ctx).tables[0];
  const perPeriod = buildSales(D, { ...p, gran: "day" }, ctx).tables[0];
  const perStore = buildCommissions(D, p, ctx).tables[0];
  check("totalVsPerOrder", near(sumOrders, perOrder.totals.total), sumOrders, perOrder.totals.total, delivered.length);
  check("totalVsPeriods", near(sumOrders, perPeriod.totals.total), sumOrders, perPeriod.totals.total, delivered.length);
  const goodsOrders = fromCents(delivered.reduce((s, o) => s + cents(o.subtotal), 0));
  check("goodsVsStores", near(goodsOrders, perStore.totals.goods), goodsOrders, perStore.totals.goods, perStore.rows.length);
  const commOrders = fromCents(delivered.reduce((s, o) => s + cents(amounts(o).commission), 0));
  check("commissionVsStores", near(commOrders, perStore.totals.commission), commOrders, perStore.totals.commission, perStore.rows.length);

  // 2) internal consistency of each delivered order and its snapshot
  let badOrders = 0;
  for (const o of delivered) {
    const a = amounts(o);
    const f = o.financials;
    const expectedTotal = r2(a.subtotal + a.deliveryFee - a.discount);
    const problems = [];
    if (!near(o.total, expectedTotal)) problems.push(["total_mismatch", expectedTotal, r2(o.total)]);
    if (f) {
      if (!near(f.subtotal, o.subtotal)) problems.push(["snapshot_subtotal", r2(o.subtotal), r2(f.subtotal)]);
      if (!near(f.deliveryFee, o.deliveryFee)) problems.push(["snapshot_fee", r2(o.deliveryFee), r2(f.deliveryFee)]);
      if (!near(f.total, o.total)) problems.push(["snapshot_total", r2(o.total), r2(f.total)]);
      if (!near(r2(f.businessNet + f.commissionAmount), f.subtotal)) problems.push(["net_plus_commission", r2(f.subtotal), r2(f.businessNet + f.commissionAmount)]);
      if (f.status !== "final") problems.push(["snapshot_not_final", "final", f.status]);
    }
    if (problems.length) {
      badOrders++;
      for (const [k, e, ac] of problems) addIssue(k, o.id, e, ac, "delivered order");
    }
  }
  check("orderIntegrity", badOrders === 0, 0, badOrders, delivered.length);

  // 3) wallet payments / refunds / driver charges must exist in the ledgers (admin-wide scope only)
  if (ctx.scope === "admin") {
    const custById = new Map((D.customers || []).map((c) => [String(c.id), c]));
    const drvById = new Map((D.drivers || []).map((d) => [String(d.id), d]));
    const entry = (w, ref) => (w && Array.isArray(w.walletHistory) ? w.walletHistory.find((h) => h.ref === ref) : null);
    let wBad = 0, wCount = 0, refundPending = 0;
    for (const o of orders) {
      const pay = o.payment || {};
      if (inRange(ts(o.createdAt), p.range) && Number(pay.walletAmount) > 0 && o.customerId) {
        wCount++;
        const e = entry(custById.get(String(o.customerId)), orderPayment.walletPayRef(o.id));
        if (!e) { wBad++; addIssue("wallet_payment_missing", o.id, -r2(pay.walletAmount), "", "no ledger entry for the wallet part"); }
        else if (!near(e.amount, -Number(pay.walletAmount))) { wBad++; addIssue("wallet_payment_amount", o.id, -r2(pay.walletAmount), r2(e.amount), "ledger differs from order"); }
      }
      if (isCanceled(o) && Number(pay.walletAmount) > 0 && o.customerId && inRange(canceledAtMs(o), p.range)) {
        if (pay.walletRefundedAt) {
          wCount++;
          const e = entry(custById.get(String(o.customerId)), orderPayment.walletRefundRef(o.id));
          if (!e) { wBad++; addIssue("wallet_refund_missing", o.id, r2(pay.walletAmount), "", "refund marked done but no ledger entry"); }
        } else refundPending++;
      }
      if (o.walletChargedAt && o.driverId && inRange(deliveredAtMs(o) || ts(o.createdAt), p.range)) {
        wCount++;
        if (!entry(drvById.get(String(o.driverId)), `order:${o.id}:charge`)) { wBad++; addIssue("driver_charge_missing", o.id, -r2(o.walletChargeAmount), "", "order charged but no ledger entry"); }
      }
    }
    check("walletVsOrders", wBad === 0, 0, wBad, wCount);
    checks.push({ check: "refundsPending", status: refundPending ? "warn" : "ok", expected: 0, actual: refundPending, diff: refundPending, count: refundPending });

    // 4) stored balance == sum of its entries, for every wallet
    let mism = 0, wallets = 0;
    for (const { walletType, w } of walletsOf(D)) {
      wallets++;
      const rc = walletLedger.reconcile({ walletBalance: w.walletBalance, walletHistory: Array.isArray(w.walletHistory) ? w.walletHistory.slice() : [] });
      if (!rc.ok) { mism++; addIssue("wallet_balance", `${walletType}:${w.id}`, rc.ledgerSum, rc.balance, "stored balance differs from ledger sum"); }
    }
    check("walletBalances", mism === 0, 0, mism, wallets);
  }

  const columns = [col("check", "enum", { enum: "check" }), col("status", "enum", { enum: "checkStatus" }), col("expected", "number"), col("actual", "number"), col("diff", "number"), I("count")];
  const iCols = [col("kind", "enum", { enum: "issue" }), T("ref"), T("expected"), T("actual"), T("detail")];
  const ok = checks.every((c) => c.status !== "fail");
  return { tables: [table("checks", columns, checks, null), table("issues", iCols, issues, null)], legacyOrders: 0, ok };
}

/* ------------------------------------------------------------------ *
 * Registry, access rules, dispatcher
 * ------------------------------------------------------------------ */

/**
 * admin: permission (lib/admin-roles.js) needed to open the report in the back office.
 * store: reachable by a business (own data only; also needs the store's `reports.read`).
 * driver: reachable by a driver for their own deliveries.
 * needs: data sources the report reads (a scope never loads sources it does not need — e.g. a store never touches wallets).
 */
const REPORTS = Object.freeze({
  sales: { admin: "reports.read", store: true, driver: false, fin: false, gran: true, needs: ["orders", "stores"], build: buildSales },
  "order-financials": { admin: "finance.read", store: true, driver: false, fin: true, gran: false, needs: ["orders", "stores"], build: buildOrderFinancials },
  commissions: { admin: "finance.read", store: true, driver: false, fin: true, gran: false, needs: ["orders", "stores", "settlements"], build: buildCommissions },
  settlements: { admin: "finance.read", store: true, driver: false, fin: true, gran: false, needs: ["stores", "settlements"], build: buildSettlements },
  payments: { admin: "finance.read", store: false, driver: false, fin: true, gran: false, needs: ["orders", "customers", "drivers", "topups"], build: buildPayments },
  drivers: { admin: "drivers.read", store: false, driver: false, fin: false, gran: false, needs: ["orders", "drivers"], build: buildDrivers },
  "driver-earnings": { admin: "finance.read", store: false, driver: true, fin: true, gran: true, needs: ["orders"], build: buildDriverEarnings },
  exceptions: { admin: "exceptions.read", store: true, driver: false, fin: false, gran: false, needs: ["orders", "stores", "drivers", "exSettings", "cases"], build: buildExceptions },
  comparison: { admin: "reports.read", store: false, driver: false, fin: false, gran: false, needs: ["orders", "stores", "drivers"], build: buildComparison },
  reconcile: { admin: "finance.read", store: false, driver: false, fin: true, gran: false, needs: ["orders", "stores", "settlements", "customers", "drivers"], build: buildReconcile },
});
const TYPE_IDS = Object.freeze(Object.keys(REPORTS));

/** Which report types a scope may open. `can(perm)` is the caller's permission test (admin scope only). */
function availableTypes(scope, can) {
  return TYPE_IDS.filter((id) => {
    const d = REPORTS[id];
    if (scope === "store") return d.store;
    if (scope === "driver") return d.driver;
    return typeof can === "function" ? !!can(d.admin) : false;
  });
}

/**
 * Validates query parameters. storeId / driverId filters are honoured only for the admin scope — for a store or a
 * driver the server sets them from the authenticated identity (see ctx), so a client can never widen its own view.
 */
function parseParams(query = {}, { now = Date.now(), tz = DEFAULT_TZ } = {}) {
  const rg = parseRange(query, { now, tz });
  if (!rg.ok) return rg;
  const gran = query.granularity === undefined || query.granularity === "" ? "day" : String(query.granularity);
  if (!GRANULARITIES.includes(gran)) return { ok: false, code: "BAD_GRANULARITY", error: "granularity must be day, week or month" };
  const lang = ["ar", "fr", "en"].includes(String(query.lang)) ? String(query.lang) : "en";
  const status = query.status === undefined || query.status === "" ? "delivered" : String(query.status);
  if (!["delivered", "canceled"].includes(status)) return { ok: false, code: "BAD_STATUS", error: "status must be delivered or canceled" };
  return { ok: true, params: { range: rg.range, gran, lang, status } };
}

/** Drops columns the caller may not see (finance / platform-internal), from columns, rows and totals. */
function applyVisibility(report, ctx) {
  const hidden = (c) => (c.fin && !ctx.finance) || (c.platform && ctx.scope !== "admin") || (c.hideInStore && ctx.scope === "store");
  for (const t of report.tables) {
    const drop = new Set(t.columns.filter(hidden).map((c) => c.key));
    if (!drop.size) continue;
    t.columns = t.columns.filter((c) => !drop.has(c.key));
    t.rows = t.rows.map((r) => {
      const o = {};
      for (const k of Object.keys(r)) if (!drop.has(k)) o[k] = r[k];
      return o;
    });
    if (t.totals) for (const k of drop) delete t.totals[k];
  }
  return report;
}

/**
 * @param {string} type
 * @param {object} D   data sources (already loaded by the caller, only what REPORTS[type].needs)
 * @param {object} p   output of parseParams().params
 * @param {{scope:'admin'|'store'|'driver',finance:boolean,storeId?:string,driverId?:string}} ctx
 */
function generate(type, D, p, ctx) {
  const def = REPORTS[type];
  if (!def) return { ok: false, status: 404, code: "UNKNOWN_REPORT", error: "Unknown report" };
  if (ctx.scope === "store" && !def.store) return { ok: false, status: 404, code: "UNKNOWN_REPORT", error: "Unknown report" };
  if (ctx.scope === "driver" && !def.driver) return { ok: false, status: 404, code: "UNKNOWN_REPORT", error: "Unknown report" };
  if (ctx.scope === "store" && !ctx.storeId) return { ok: false, status: 403, code: "NO_STORE", error: "Forbidden" };
  if (ctx.scope === "driver" && !ctx.driverId) return { ok: false, status: 403, code: "NO_DRIVER", error: "Forbidden" };
  if (def.fin && !ctx.finance && ctx.scope === "admin") return { ok: false, status: 403, code: "FORBIDDEN", error: "Forbidden" };
  const built = def.build(D, p, ctx);
  const report = {
    type,
    meta: {
      fromKey: p.range.fromKey, toKey: p.range.toKey, tz: p.range.tz, granularity: def.gran ? p.gran : null,
      status: type === "order-financials" ? p.status : null, scope: ctx.scope, currency: String(D.currency || "MAD"),
      generatedAt: new Date(Number.isFinite(D.now) ? D.now : Date.now()).toISOString(),
      legacyOrders: built.legacyOrders || 0,
      ...(typeof built.ok === "boolean" ? { ok: built.ok } : {}),
    },
    tables: built.tables,
  };
  return { ok: true, report: applyVisibility(report, ctx) };
}

module.exports = {
  DEFAULT_TZ, MAX_RANGE_DAYS, GRANULARITIES, REPORTS, TYPE_IDS,
  parseRange, parseParams, availableTypes, generate, applyVisibility,
  // exposed for tests / reuse
  amounts, bucketKeys, bucketOf, dayKey, startOfDay, weekStart, addDays, validTz, nameIn, exceptionEvents,
};

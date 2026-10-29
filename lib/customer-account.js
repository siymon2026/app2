"use strict";
/**
 * Customer account helpers (spec section 15). Pure functions, no I/O.
 *
 * Privacy rule: knowing a phone number must never grant access to private
 * order details. Ownership is therefore decided by `order.customerId`, and a
 * phone match is honoured ONLY when the account's phone was verified
 * (`phoneVerifiedAt`) AND the order was placed as a guest (no customerId).
 * Until an SMS provider exists nothing sets `phoneVerifiedAt`, so phone-only
 * matching is effectively off — which is the safe default.
 */
const crypto = require("crypto");

const TERMINAL = new Set(["done", "canceled", "cancelled"]);
const MAX_FAVORITES = 100;
const digits = (v) => String(v == null ? "" : v).replace(/\D/g, "");
const strip = (v, n) =>
  String(v == null ? "" : v).replace(/[<>\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
const money = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/* ------------------------------ ownership ------------------------------ */

function ownsOrder(order, customer) {
  if (!order || !customer) return false;
  const oc = String(order.customerId || "");
  if (oc) return oc === String(customer.id);
  // Guest order: only a VERIFIED phone may claim it.
  if (!customer.phoneVerifiedAt) return false;
  const cp = digits(customer.phone);
  const op = digits(order.customer && order.customer.phone);
  return !!cp && cp === op;
}

function ordersOf(orders, customer) {
  return (Array.isArray(orders) ? orders : []).filter((o) => ownsOrder(o, customer));
}

/* ------------------------------- profile ------------------------------- */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate a profile edit. Returns only the fields that were supplied.
 * Changing the phone drops its verified flag (the new number is unproven).
 */
function sanitizeProfile(body, current) {
  const b = body && typeof body === "object" ? body : {};
  const patch = {};
  if ("firstName" in b) {
    const v = strip(b.firstName, 60);
    if (!v) return { ok: false, error: "Missing firstName", code: "INVALID_FIRST_NAME" };
    patch.firstName = v;
  }
  if ("lastName" in b) {
    const v = strip(b.lastName, 60);
    if (!v) return { ok: false, error: "Missing lastName", code: "INVALID_LAST_NAME" };
    patch.lastName = v;
  }
  if ("email" in b) {
    const v = strip(b.email, 120).toLowerCase();
    if (!EMAIL_RE.test(v)) return { ok: false, error: "Invalid email", code: "INVALID_EMAIL" };
    patch.email = v;
  }
  if ("phone" in b) {
    const v = digits(b.phone);
    if (v && (v.length < 8 || v.length > 15)) return { ok: false, error: "Invalid phone", code: "INVALID_PHONE" };
    patch.phone = v || null;
  }
  if (!Object.keys(patch).length) return { ok: false, error: "Nothing to update", code: "EMPTY_PATCH" };
  const cur = current || {};
  const phoneChanged = "phone" in patch && digits(patch.phone) !== digits(cur.phone);
  const emailChanged = "email" in patch && String(patch.email) !== String(cur.email || "").toLowerCase();
  if (phoneChanged) patch.phoneVerifiedAt = null;
  return { ok: true, patch, phoneChanged, emailChanged };
}

/** Phone/email that another account already uses. */
function findConflict(customers, selfId, patch) {
  for (const c of customers || []) {
    if (String(c.id) === String(selfId)) continue;
    if (patch.email && String(c.email || "").toLowerCase() === patch.email) return "email";
    if (patch.phone && digits(c.phone) === digits(patch.phone)) return "phone";
  }
  return null;
}

/* ------------------------------ favorites ------------------------------ */

function sanitizeFavorites(list) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    if (!raw || typeof raw !== "object") continue;
    const type = raw.type === "item" ? "item" : raw.type === "store" ? "store" : null;
    const id = strip(raw.id, 80).replace(/[^A-Za-z0-9_.:-]/g, "");
    if (!type || !id) continue;
    const storeId = type === "item" ? strip(raw.storeId, 80).replace(/[^A-Za-z0-9_.:-]/g, "") : "";
    if (type === "item" && !storeId) continue;
    const key = `${type}:${storeId}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(type === "item" ? { type, id, storeId } : { type, id });
    if (out.length >= MAX_FAVORITES) break;
  }
  return out;
}

/* ------------------------------- reorder ------------------------------- */

/**
 * Rebuild a cart from a past order against the CURRENT catalogue. Nothing from
 * the old order's prices is trusted: each line is re-priced and re-checked.
 * `itemOrderable`/`unitPrice` are injected so this stays free of catalogue I/O.
 * @returns {{ok, storeId, lines:[{id,name,qty,price,oldPrice,priceChanged}],
 *            unavailable:[{id,name,reason}], subtotal}}
 */
function buildReorder({ order, byId, nameOf, itemOrderable, unitPrice }) {
  const lines = [];
  const unavailable = [];
  for (const it of (order && order.items) || []) {
    const id = String(it.id || "");
    const src = byId.get(id);
    const name = (src && nameOf ? nameOf(src) : "") || String(it.name || id);
    if (!src) { unavailable.push({ id, name, reason: "removed" }); continue; }
    if (!itemOrderable(src)) { unavailable.push({ id, name, reason: "unavailable" }); continue; }
    let qty = Math.min(99, Math.max(1, Math.floor(Number(it.qty) || 1)));
    if (src.stock !== undefined && src.stock !== null) {
      const stock = Math.floor(Number(src.stock));
      if (!(stock > 0)) { unavailable.push({ id, name, reason: "out_of_stock" }); continue; }
      if (qty > stock) qty = stock;
    }
    const price = money(unitPrice(src));
    const oldPrice = money(it.price);
    lines.push({ id, name, qty, price, oldPrice, priceChanged: price !== oldPrice, qtyReduced: qty < Math.floor(Number(it.qty) || 1) });
  }
  return {
    ok: lines.length > 0,
    storeId: String((order && order.restaurantId) || ""),
    lines,
    unavailable,
    subtotal: money(lines.reduce((s, l) => s + l.qty * l.price, 0)),
  };
}

/* ------------------------------- receipt ------------------------------- */

const RECEIPT_STATUSES = new Set(["delivered", "done"]);

/**
 * Customer-facing receipt. Whitelist only: never verify codes, driver phone,
 * internal financials (commission) or event history.
 */
function receiptOf(order, { storeName = "", currency = "MAD" } = {}) {
  if (!order || !RECEIPT_STATUSES.has(String(order.status))) return null;
  const discount = order.promo && Number(order.promo.amount) > 0 ? money(order.promo.amount) : 0;
  return {
    number: String(order.id),
    issuedAt: order.deliveredAt || order.updatedAt || order.createdAt || null,
    placedAt: order.createdAt || null,
    store: String(storeName || ""),
    currency: String(order.currency || currency),
    customer: { name: String((order.customer && order.customer.name) || ""), addr: String((order.customer && order.customer.addr) || "") },
    items: (order.items || []).map((i) => ({
      name: String(i.name || i.id || ""),
      qty: Number(i.qty) || 0,
      price: money(i.price),
      lineTotal: money((Number(i.qty) || 0) * Number(i.price || 0)),
    })),
    subtotal: money(order.subtotal),
    deliveryFee: money(order.deliveryFee),
    discount,
    promoCode: order.promo && order.promo.code ? String(order.promo.code) : "",
    total: money(order.total),
    paymentMethod: String(order.paymentMethod || ""),
    paidFromWallet: money(order.payment && order.payment.walletAmount),
  };
}

/* ----------------------------- secure tracking ----------------------------- */

/** A random capability token, returned once; only its SHA-256 is stored. */
function newTrackingToken() {
  const token = crypto.randomBytes(24).toString("base64url");
  return { token, hash: hashToken(token) };
}
function hashToken(t) {
  return crypto.createHash("sha256").update(String(t || "")).digest("hex");
}
function checkTrackingToken(order, token) {
  if (!order || !order.trackHash || !token) return false;
  const a = Buffer.from(hashToken(token), "hex");
  const b = Buffer.from(String(order.trackHash), "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** What a tracking-link holder may see (no phone numbers, no codes). */
function trackingView(order, { storeName = "" } = {}) {
  if (!order) return null;
  return {
    id: String(order.id),
    status: String(order.status || "new"),
    store: String(storeName || ""),
    createdAt: order.createdAt || null,
    updatedAt: order.updatedAt || null,
    deliveredAt: order.deliveredAt || null,
    items: (order.items || []).map((i) => ({ name: String(i.name || ""), qty: Number(i.qty) || 0 })),
    total: money(order.total),
    currency: String(order.currency || ""),
    driverAssigned: !!order.driverId,
  };
}

/* ------------------------- account deletion / hiding ------------------------- */

function activeOrders(orders, customer) {
  return ordersOf(orders, customer).filter((o) => !TERMINAL.has(String(o.status)));
}

/**
 * Scrub personal data from the account record but keep a tombstone with the id
 * (orders/ledger entries still reference it). Credentials are destroyed so the
 * account can never log in again.
 */
function anonymizeCustomer(c, nowIso) {
  const id = String(c.id);
  return {
    id,
    deleted: true,
    deletedAt: nowIso,
    firstName: "",
    lastName: "",
    email: null,
    phone: null,
    password: null,
    googleSub: null,
    googleEmailVerified: null,
    googlePicture: null,
    addresses: [],
    favorites: [],
    walletBalance: Number(c.walletBalance || 0),
    walletHistory: Array.isArray(c.walletHistory) ? c.walletHistory : [],
    createdAt: c.createdAt || null,
    updatedAt: nowIso,
  };
}

/**
 * Hide personal fields on a customer's CLOSED orders; keep what accounting
 * needs (id, dates, items, amounts, payment, financials).
 */
function anonymizeOrderPII(order) {
  if (!order || !order.customer) return order;
  order.customer = { name: "", phone: "", addr: "", notes: "" }; // coordinates dropped too
  order.piiHiddenAt = order.piiHiddenAt || new Date().toISOString();
  delete order.trackHash;
  return order;
}

module.exports = {
  ownsOrder,
  ordersOf,
  sanitizeProfile,
  findConflict,
  sanitizeFavorites,
  MAX_FAVORITES,
  buildReorder,
  receiptOf,
  newTrackingToken,
  hashToken,
  checkTrackingToken,
  trackingView,
  activeOrders,
  anonymizeCustomer,
  anonymizeOrderPII,
  TERMINAL,
};

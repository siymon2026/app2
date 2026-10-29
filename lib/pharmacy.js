"use strict";
/**
 * Pharmacy requests (pure logic, no I/O) — unit-testable.
 *
 * A customer who is looking for a medicine writes its name and/or uploads a prescription photo. That creates a
 * REQUEST (unique number "PH-XXXXXXXX"), which is NOT an order and is never visible to drivers. The pharmacist
 * answers with availability + prices (a quote). Only when the customer accepts the quote is a real order created
 * (by the caller) and handed to the existing order / driver-dispatch flow.
 *
 *   pending ──quote(available)──▶ quoted ──accept──▶ accepted (orderId)
 *      │  ╲                         │  ╲
 *      │   ╲quote(unavailable)▶ unavailable      ╲decline▶ declined
 *      │cancel▶ canceled             │cancel▶ canceled   ╲expiry▶ expired
 *
 * Every transition is validated here; nothing trusts the client.
 */

const STATUSES = Object.freeze(["pending", "quoted", "unavailable", "accepted", "declined", "canceled", "expired"]);
const OPEN = Object.freeze(["pending", "quoted"]);
const FINAL = Object.freeze(["unavailable", "accepted", "declined", "canceled", "expired"]);

const LIMITS = Object.freeze({
  text: 1000,
  note: 500,
  lineName: 120,
  lines: 30,
  maxQty: 20,
  maxPrice: 100000,
  pendingTtlMs: 24 * 3600 * 1000, // an unanswered request closes after 24 h
  quoteMinMin: 5,
  quoteMaxMin: 240,
  quoteDefaultMin: 30,
  maxOpenPerCustomer: 5,
});

const str = (v, max) => String(v == null ? "" : v).replace(/[<>]/g, "").trim().slice(0, max);
const money = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function newRequestId(rand = Math.random, now = Date.now) {
  // PH- + 8 chars of time/random base36 (unique enough; the caller also checks for a clash)
  const t = now().toString(36).slice(-4);
  const r = Math.floor(rand() * 36 ** 4).toString(36).padStart(4, "0");
  return ("PH-" + t + r).toUpperCase();
}
const isRequestId = (id) => /^PH-[A-Z0-9]{8}$/.test(String(id || ""));

/** Validate what the customer sent. -> {ok, value} | {ok:false, error, code} */
function validateCreate(b, { hasPrescription = false } = {}) {
  b = b || {};
  const text = str(b.text, LIMITS.text);
  if (!text && !hasPrescription) return { ok: false, error: "Write the medicine name or attach a prescription photo", code: "EMPTY_REQUEST" };
  const c = b.customer || {};
  const name = str(c.name, 80), phone = str(c.phone, 25), addr = str(c.addr, 300);
  if (!name || !phone || !addr) return { ok: false, error: "Missing customer fields", code: "MISSING_CUSTOMER" };
  const lat = Number(c.lat), lng = Number(c.lng);
  const okLL = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
  return {
    ok: true,
    value: {
      storeId: str(b.storeId, 80),
      text,
      note: str(b.note, LIMITS.note),
      customer: { name, phone, addr, ...(okLL ? { lat, lng } : {}) },
      clientId: /^[A-Za-z0-9_.:-]{6,64}$/.test(String(b.clientId || "")) ? String(b.clientId) : null,
    },
  };
}

/** Validate the pharmacist's answer. */
function validateQuote(b, now = new Date()) {
  b = b || {};
  const available = b.available !== false && b.available !== "false";
  const note = str(b.note, LIMITS.note);
  if (!available) {
    const reason = str(b.reason || b.note, LIMITS.note);
    if (reason.length < 2) return { ok: false, error: "Say why it is unavailable", code: "REASON_REQUIRED" };
    return { ok: true, value: { available: false, reason, lines: [], medicinesTotal: 0 } };
  }
  const src = Array.isArray(b.lines) ? b.lines : [];
  if (!src.length) return { ok: false, error: "Add at least one medicine with its price", code: "LINES_REQUIRED" };
  if (src.length > LIMITS.lines) return { ok: false, error: "Too many lines", code: "TOO_MANY_LINES" };
  const lines = [];
  for (const l of src) {
    const name = str(l && l.name, LIMITS.lineName);
    const qty = Math.floor(Number(l && l.qty));
    const price = Number(l && l.price);
    if (!name) return { ok: false, error: "Medicine name required", code: "LINE_NAME" };
    if (!(qty >= 1 && qty <= LIMITS.maxQty)) return { ok: false, error: "Invalid quantity", code: "LINE_QTY" };
    if (!Number.isFinite(price) || price <= 0 || price > LIMITS.maxPrice) return { ok: false, error: "Invalid price", code: "LINE_PRICE" };
    lines.push({ name, qty, price: money(price), note: str(l && l.note, 200) });
  }
  const mins = Math.min(LIMITS.quoteMaxMin, Math.max(LIMITS.quoteMinMin, Math.round(Number(b.validMinutes) || LIMITS.quoteDefaultMin)));
  const medicinesTotal = money(lines.reduce((s, l) => s + l.qty * l.price, 0));
  return { ok: true, value: { available: true, lines, medicinesTotal, note, validMinutes: mins, expiresAt: new Date(now.getTime() + mins * 60000).toISOString() } };
}

/** Status after applying time-based expiry (never mutates). */
function effectiveStatus(r, now = Date.now()) {
  if (!r) return null;
  if (r.status === "pending" && now - Date.parse(r.createdAt) > LIMITS.pendingTtlMs) return "expired";
  if (r.status === "quoted" && r.quote && r.quote.expiresAt && now > Date.parse(r.quote.expiresAt)) return "expired";
  return r.status;
}

function addEvent(r, ev) {
  r.events = Array.isArray(r.events) ? r.events : [];
  r.events.push(ev);
  if (r.events.length > 100) r.events = r.events.slice(-100);
}

/** Persist a lazily-detected expiry. -> true if changed */
function applyExpiry(r, now = Date.now()) {
  const eff = effectiveStatus(r, now);
  if (eff === "expired" && r.status !== "expired") {
    addEvent(r, { at: new Date(now).toISOString(), from: r.status, to: "expired", actor: "system" });
    r.status = "expired";
    r.updatedAt = new Date(now).toISOString();
    return true;
  }
  return false;
}

function create({ id, storeId, customerId, value, prescription = null, now = new Date() }) {
  const at = now.toISOString();
  return {
    id,
    storeId: String(storeId),
    customerId: String(customerId),
    status: "pending",
    text: value.text,
    note: value.note,
    customer: value.customer,
    clientId: value.clientId,
    prescription: prescription ? { file: prescription.file, mime: prescription.mime } : null, // private file reference only
    quote: null,
    orderId: null,
    createdAt: at,
    updatedAt: at,
    events: [{ at, from: null, to: "pending", actor: "customer" }],
  };
}

/** Pharmacist answers. Allowed while pending, and again while quoted (correcting a price before the customer accepts). */
function applyQuote(r, v, { actorId, now = new Date() } = {}) {
  const eff = effectiveStatus(r, now.getTime());
  if (!["pending", "quoted"].includes(eff)) return { ok: false, status: 409, error: "Request is closed", code: "REQUEST_CLOSED" };
  const from = r.status;
  const at = now.toISOString();
  r.quote = { ...v, quotedAt: at, quotedBy: actorId ? String(actorId) : null };
  r.status = v.available ? "quoted" : "unavailable";
  r.updatedAt = at;
  addEvent(r, { at, from, to: r.status, actor: "store", actorId: actorId || null });
  return { ok: true };
}

/** Customer decision. `expectTotal` (what the customer saw) must match what will be charged. */
function canAccept(r, { total, expectTotal, now = Date.now() }) {
  if (r.status === "accepted") return { ok: true, already: true };
  const eff = effectiveStatus(r, now);
  if (eff === "expired") return { ok: false, status: 410, error: "The offer has expired", code: "OFFER_EXPIRED" };
  if (eff !== "quoted") return { ok: false, status: 409, error: "No offer to accept", code: "NO_OFFER" };
  if (expectTotal !== undefined && expectTotal !== null && money(expectTotal) !== money(total))
    return { ok: false, status: 409, error: "The price changed", code: "PRICE_CHANGED", total: money(total) };
  return { ok: true };
}

function markAccepted(r, { orderId, delivery, total, now = new Date() }) {
  const at = now.toISOString();
  const from = r.status;
  r.status = "accepted";
  r.orderId = String(orderId);
  r.acceptedAt = at;
  r.acceptedTotal = money(total);
  r.delivery = delivery || null;
  r.updatedAt = at;
  addEvent(r, { at, from, to: "accepted", actor: "customer", orderId: String(orderId) });
}

function decline(r, { reason, now = new Date() } = {}) {
  const eff = effectiveStatus(r, now.getTime());
  if (eff !== "quoted") return { ok: false, status: 409, error: "No offer to decline", code: "NO_OFFER" };
  const at = now.toISOString();
  const from = r.status;
  r.status = "declined";
  r.declineReason = str(reason, 200);
  r.updatedAt = at;
  addEvent(r, { at, from, to: "declined", actor: "customer" });
  return { ok: true };
}

function cancel(r, { now = new Date() } = {}) {
  const eff = effectiveStatus(r, now.getTime());
  if (!OPEN.includes(eff)) return { ok: false, status: 409, error: "Request is closed", code: "REQUEST_CLOSED" };
  const at = now.toISOString();
  const from = r.status;
  r.status = "canceled";
  r.updatedAt = at;
  addEvent(r, { at, from, to: "canceled", actor: "customer" });
  return { ok: true };
}

/* ---------------- views ---------------- */

const quoteView = (q) => (q ? { available: q.available, reason: q.reason || "", note: q.note || "", lines: q.lines || [], medicinesTotal: q.medicinesTotal || 0, expiresAt: q.expiresAt || null, quotedAt: q.quotedAt } : null);

/** What the CUSTOMER may see. `delivery` is the server-computed fee for the current quote (or null). */
function customerView(r, { store = null, delivery = null, now = Date.now() } = {}) {
  const status = effectiveStatus(r, now);
  const q = quoteView(r.quote);
  const out = {
    id: r.id,
    status,
    text: r.text,
    note: r.note,
    storeId: r.storeId,
    storeName: store ? store.name : "",
    hasPrescription: !!r.prescription,
    customer: r.customer,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    quote: q,
    orderId: r.orderId || null,
    canAccept: status === "quoted" && !!(q && q.available),
    expiresAt: q ? q.expiresAt : null,
  };
  if (delivery && q && q.available) {
    out.delivery = { fee: delivery.fee, km: delivery.km || null };
    out.total = money(q.medicinesTotal + delivery.fee);
  }
  return out;
}

/** What the PHARMACY may see (customer phone masked unless the role may contact customers). */
function storeView(r, { canContact = false, maskPhone = (p) => p, now = Date.now() } = {}) {
  const status = effectiveStatus(r, now);
  return {
    id: r.id,
    status,
    text: r.text,
    note: r.note,
    hasPrescription: !!r.prescription,
    customer: { name: r.customer.name, phone: canContact ? r.customer.phone : maskPhone(r.customer.phone), addr: r.customer.addr },
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    quote: quoteView(r.quote),
    orderId: r.orderId || null,
    viewedAt: r.viewedAt || null,
  };
}

module.exports = {
  STATUSES, OPEN, FINAL, LIMITS,
  newRequestId, isRequestId, validateCreate, validateQuote, effectiveStatus, applyExpiry,
  create, applyQuote, canAccept, markAccepted, decline, cancel, customerView, storeView,
};

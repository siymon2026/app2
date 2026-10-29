"use strict";
/**
 * Payment-method registry (pure rules, no I/O).
 *
 * One record per method, configured by an authorised supervisor. The server -
 * never the client - decides what is AVAILABLE:
 *   available = enabled && integration ready && configuration complete.
 *
 * Honesty rules:
 *  - Stripe has no integration in this code base: it is never available, whatever
 *    the supervisor toggles, and shows the fixed label "غير متوفر حاليا".
 *  - Bank / cash-service methods are MANUAL transfers: instructions + a pending
 *    request verified by a supervisor. No provider API is claimed.
 *  - COD and TPE-at-delivery are order-payment methods only; they can never be a
 *    wallet-funding context.
 *  - No bank details are invented: seeded records carry empty account fields and
 *    stay disabled until the supervisor enters real data.
 */

const CONTEXTS = Object.freeze(["checkout", "customerTopup", "driverTopup"]);
const AUDIENCES = Object.freeze(["default", "customer", "driver"]);
const STRIPE_UNAVAILABLE_LABEL = "غير متوفر حاليا";
const LANGS = ["ar", "fr", "en"];

/** kind: stripe | cod | tpe | transfer */
const SEED = [
  { id: "stripe", kind: "stripe", sortOrder: 10, name: { ar: "بطاقة بنكية (Stripe)", fr: "Carte bancaire (Stripe)", en: "Card payment (Stripe)" }, contexts: { checkout: true, customerTopup: true, driverTopup: true } },
  { id: "cod", kind: "cod", sortOrder: 20, enabled: true, name: { ar: "الدفع عند الاستلام", fr: "Paiement à la livraison", en: "Cash on delivery" }, contexts: { checkout: true } },
  { id: "tpe", kind: "tpe", sortOrder: 30, name: { ar: "الدفع بجهاز TPE عند التسليم", fr: "Paiement par TPE à la livraison", en: "Card terminal (TPE) on delivery" }, contexts: { checkout: true } },
  { id: "cih", kind: "transfer", sortOrder: 40, name: { ar: "تطبيق CIH Bank", fr: "Application CIH Bank", en: "CIH Bank app" }, bankName: "CIH Bank" },
  { id: "credit_agricole", kind: "transfer", sortOrder: 50, name: { ar: "القرض الفلاحي للمغرب", fr: "Crédit Agricole du Maroc", en: "Crédit Agricole du Maroc" }, bankName: "Crédit Agricole du Maroc" },
  { id: "cashplus", kind: "transfer", sortOrder: 60, name: { ar: "كاش بلس", fr: "Cash Plus", en: "Cash Plus" }, bankName: "Cash Plus" },
  { id: "wafacash", kind: "transfer", sortOrder: 70, name: { ar: "وافاكاش", fr: "Wafacash", en: "Wafacash" }, bankName: "Wafacash" },
  { id: "attijariwafa", kind: "transfer", sortOrder: 80, name: { ar: "تطبيق التجاري وفا بنك", fr: "Application Attijariwafa Bank", en: "Attijariwafa Bank app" }, bankName: "Attijariwafa Bank" },
  { id: "barid", kind: "transfer", sortOrder: 90, name: { ar: "تطبيق بريد بنك", fr: "Application Barid Bank", en: "Barid Bank app" }, bankName: "Barid Bank" },
];

const emptyI18n = () => ({ ar: "", fr: "", en: "" });
const emptyDetails = (bankName = "") => ({ holderName: "", bankName, rib: "", iban: "", accountNumber: "", paymentIdentifier: "", branch: "", referenceFormat: "", instructions: emptyI18n() });

function seedRecord(s) {
  const transfer = s.kind === "transfer";
  return {
    id: s.id,
    kind: s.kind,
    name: { ...s.name },
    enabled: s.enabled === true,
    contexts: {
      checkout: !!(s.contexts ? s.contexts.checkout : transfer), // listed at checkout; manual transfers stay unavailable for ORDERS until a pending-payment workflow exists
      customerTopup: !!(s.contexts ? s.contexts.customerTopup : transfer),
      driverTopup: !!(s.contexts ? s.contexts.driverTopup : transfer),
    },
    details: { default: emptyDetails(s.bankName || ""), customer: null, driver: null },
    qrImage: "",
    requireReceipt: transfer,
    requireVerification: transfer,
    minAmount: null,
    maxAmount: null,
    sortOrder: s.sortOrder,
    statusMessage: emptyI18n(),
    version: 1,
  };
}

/** Stored records + any missing built-in (so a fresh install lists all 9). */
function withDefaults(stored) {
  const list = Array.isArray(stored) ? stored.filter((x) => x && x.id) : [];
  const have = new Set(list.map((x) => x.id));
  for (const s of SEED) if (!have.has(s.id)) list.push(seedRecord(s));
  return list.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

const str = (v, max) => String(v == null ? "" : v).replace(/[<>]/g, "").trim().slice(0, max);
function i18n(v, max, prev) {
  const out = { ...(prev || emptyI18n()) };
  if (v && typeof v === "object") for (const l of LANGS) if (v[l] !== undefined) out[l] = str(v[l], max);
  return out;
}
const num = (v) => (v === null || v === "" ? null : Number(v));

function cleanDetails(input, prev) {
  const p = prev || emptyDetails();
  const d = input || {};
  const out = { ...p };
  const set = (k, max) => { if (d[k] !== undefined) out[k] = str(d[k], max); };
  set("holderName", 120); set("bankName", 120); set("rib", 40); set("iban", 40); set("accountNumber", 40);
  set("paymentIdentifier", 80); set("branch", 120); set("referenceFormat", 120);
  out.instructions = i18n(d.instructions, 1500, p.instructions);
  return out;
}

/** What identifies the receiving account for a transfer method. */
const hasAccount = (d) => !!(d && d.holderName && (d.rib || d.iban || d.accountNumber || d.paymentIdentifier));

/** Details actually shown for an audience: audience override on top of default. */
function detailsFor(rec, audience) {
  const base = rec.details && rec.details.default ? rec.details.default : emptyDetails();
  const over = rec.details && audience && rec.details[audience];
  if (!over) return base;
  const out = { ...base };
  for (const k of Object.keys(over)) {
    if (k === "instructions") {
      out.instructions = { ...base.instructions };
      for (const l of LANGS) if (over.instructions && over.instructions[l]) out.instructions[l] = over.instructions[l];
    } else if (over[k]) out[k] = over[k];
  }
  return out;
}
const audienceOf = (context) => (context === "customerTopup" ? "customer" : context === "driverTopup" ? "driver" : "default");

/** @returns {{ok:true,value:object}|{ok:false,status:number,code:string,error:string}} */
function applyUpdate(rec, input) {
  const b = input || {};
  const next = JSON.parse(JSON.stringify(rec));
  if (b.name !== undefined) next.name = i18n(b.name, 120, next.name);
  if (b.statusMessage !== undefined) next.statusMessage = i18n(b.statusMessage, 300, next.statusMessage);
  if (b.enabled !== undefined) next.enabled = b.enabled === true;
  if (b.contexts && typeof b.contexts === "object") {
    for (const c of CONTEXTS) if (b.contexts[c] !== undefined) next.contexts[c] = b.contexts[c] === true;
  }
  if (next.kind === "cod" || next.kind === "tpe") {
    // order-payment methods: never a wallet-funding method
    next.contexts.customerTopup = false;
    next.contexts.driverTopup = false;
  }
  if (b.details && typeof b.details === "object") {
    for (const a of AUDIENCES) {
      if (b.details[a] === undefined) continue;
      if (b.details[a] === null) { if (a !== "default") next.details[a] = null; continue; }
      next.details[a] = cleanDetails(b.details[a], next.details[a] || (a === "default" ? emptyDetails() : emptyDetails()));
    }
  }
  if (b.qrImage !== undefined) {
    const u = String(b.qrImage || "").trim();
    if (u && !/^(\/uploads\/|https:\/\/)/.test(u)) return { ok: false, status: 400, code: "BAD_IMAGE", error: "qrImage must be an /uploads/ path or an https URL" };
    next.qrImage = u.slice(0, 300);
  }
  if (b.requireReceipt !== undefined) next.requireReceipt = b.requireReceipt === true;
  if (b.requireVerification !== undefined && next.kind === "transfer") next.requireVerification = true; // manual transfers are ALWAYS verified by a human
  for (const k of ["minAmount", "maxAmount"]) {
    if (b[k] === undefined) continue;
    const n = num(b[k]);
    if (n !== null && (!Number.isFinite(n) || n < 0 || n > 1e7)) return { ok: false, status: 400, code: "BAD_AMOUNT", error: `${k} is invalid` };
    next[k] = n === null ? null : Math.round(n * 100) / 100;
  }
  if (next.minAmount != null && next.maxAmount != null && next.maxAmount < next.minAmount) return { ok: false, status: 400, code: "BAD_RANGE", error: "maxAmount must be >= minAmount" };
  if (b.sortOrder !== undefined) {
    const n = Number(b.sortOrder);
    if (!Number.isFinite(n) || n < 0 || n > 10000) return { ok: false, status: 400, code: "BAD_SORT", error: "sortOrder is invalid" };
    next.sortOrder = Math.round(n);
  }
  // A manual-transfer method cannot be switched on without a real receiving account.
  if (next.kind === "transfer" && next.enabled) {
    for (const c of CONTEXTS) {
      if (!next.contexts[c]) continue;
      if (!hasAccount(detailsFor(next, audienceOf(c)))) {
        return { ok: false, status: 409, code: "ACCOUNT_REQUIRED", error: `Account details are required for ${c} before enabling`, context: c };
      }
    }
  }
  next.version = (rec.version || 1) + 1;
  return { ok: true, value: next };
}

/** Is a method usable right now, and if not why (reason is a stable code). */
function availability(rec, context, { stripeReady = false } = {}) {
  if (!rec.contexts || !rec.contexts[context]) return { available: false, reason: "context_off" };
  if (rec.kind === "stripe") return { available: false, reason: "not_integrated", label: STRIPE_UNAVAILABLE_LABEL };
  if (rec.kind === "transfer" && context === "checkout") return { available: false, reason: "order_workflow_pending" };
  if (!rec.enabled) return { available: false, reason: "disabled" };
  if (rec.kind === "transfer" && !hasAccount(detailsFor(rec, audienceOf(context)))) return { available: false, reason: "not_configured" };
  return { available: true, reason: null };
}

/**
 * Public view. Account details are included ONLY for wallet-funding contexts,
 * which are served to signed-in users; nothing here is an API secret.
 */
function publicView(rec, context, { includeAccount = false } = {}) {
  const a = availability(rec, context);
  const v = {
    id: rec.id,
    kind: rec.kind,
    name: rec.name,
    available: a.available,
    reason: a.reason,
    statusLabel: a.label || null,
    statusMessage: rec.statusMessage,
    requireReceipt: !!rec.requireReceipt,
    minAmount: rec.minAmount,
    maxAmount: rec.maxAmount,
    sortOrder: rec.sortOrder,
  };
  if (includeAccount && rec.kind === "transfer" && a.available) {
    const d = detailsFor(rec, audienceOf(context));
    v.account = { holderName: d.holderName, bankName: d.bankName, rib: d.rib, iban: d.iban, accountNumber: d.accountNumber, paymentIdentifier: d.paymentIdentifier, branch: d.branch, referenceFormat: d.referenceFormat, instructions: d.instructions };
    v.qrImage = rec.qrImage || "";
  }
  return v;
}

/** Amount rule for a wallet-funding request or an order payment. */
function checkAmount(rec, amount) {
  const a = Number(amount);
  if (!Number.isFinite(a) || a <= 0) return { ok: false, code: "BAD_AMOUNT", error: "Invalid amount" };
  if (rec.minAmount != null && a < rec.minAmount) return { ok: false, code: "BELOW_MIN", error: "Amount below the minimum", min: rec.minAmount };
  if (rec.maxAmount != null && a > rec.maxAmount) return { ok: false, code: "ABOVE_MAX", error: "Amount above the maximum", max: rec.maxAmount };
  return { ok: true };
}

/** Log-safe summary of what changed; account numbers are masked, never written in full. */
function changeSummary(before, after) {
  const mask = (s) => { const v = String(s || ""); return v.length > 4 ? "•••" + v.slice(-4) : v ? "••••" : ""; };
  const changed = [];
  const walk = (a, b, path) => {
    for (const k of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) {
      const x = a ? a[k] : undefined, y = b ? b[k] : undefined;
      if (x && typeof x === "object" && y && typeof y === "object") walk(x, y, path.concat(k));
      else if (JSON.stringify(x) !== JSON.stringify(y)) {
        const p = path.concat(k).join(".");
        const sensitive = /(rib|iban|accountNumber|paymentIdentifier)$/.test(p);
        changed.push(sensitive ? { field: p, to: mask(y) } : { field: p });
      }
    }
  };
  walk(before, after, []);
  return changed.filter((c) => c.field !== "version");
}

module.exports = { CONTEXTS, AUDIENCES, STRIPE_UNAVAILABLE_LABEL, SEED, withDefaults, applyUpdate, availability, publicView, detailsFor, audienceOf, hasAccount, checkAmount, changeSummary };

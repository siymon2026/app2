"use strict";
/**
 * Multi-activity store logic (no express / no I/O) — unit-testable.
 *
 * A "store" is a record in restaurants.json (the existing tenant model).
 * `store.type` (already supported by lib/catalog.js) points to a StoreType
 * defined here / managed by the super admin in data/store_types.json.
 *
 * Nothing here trusts the browser: callers pass server-loaded records.
 */

const str = (v, max) =>
  String(v == null ? "" : v)
    .trim()
    .slice(0, max);
const slug = (v, max = 40) =>
  str(v, max)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_-]+/gu, "-")
    .replace(/^-+|-+$/g, "");

/* ------------------------------------------------------------------ *
 * Roles & permissions (per store)
 * ------------------------------------------------------------------ */

const ROLES = ["owner", "manager", "cashier"];

const PERMISSIONS = {
  owner: [
    "dashboard.read",
    "orders.read",
    "orders.update",
    "products.read",
    "products.write",
    "products.price",
    "products.delete",
    "customers.read",
    "customers.contact", // see customer phone
    "chat.use",
    "support.use", // contact the admin team (channels + tickets)
    "pharmacy.use", // answer medicine requests (only meaningful for pharmacy-type stores)
    "reports.read",
    "settings.write",
    "members.read",
    "members.write", // owner manages managers/cashiers of their own store
  ],
  manager: [
    "dashboard.read",
    "orders.read",
    "orders.update",
    "products.read",
    "products.write",
    "products.price",
    "customers.read",
    "customers.contact",
    "chat.use",
    "support.use",
    "pharmacy.use",
    "reports.read",
  ],
  cashier: ["dashboard.read", "orders.read", "orders.update", "products.read", "chat.use", "support.use", "pharmacy.use"],
};

function can(role, perm) {
  return (PERMISSIONS[String(role)] || []).includes(perm);
}

/* ------------------------------------------------------------------ *
 * Navigation sections (the 16 items of the brief)
 * ------------------------------------------------------------------ */

const SECTIONS = {
  dashboard: { perm: "dashboard.read" },
  orders_new: { perm: "orders.read" },
  orders: { perm: "orders.read" },
  products: { perm: "products.read" },
  categories: { perm: "products.read" },
  pricing: { perm: "products.price" },
  inventory: { perm: "products.read" },
  customers: { perm: "customers.read" },
  chat: { perm: "chat.use" },
  notifications: { perm: "dashboard.read" },
  reports: { perm: "reports.read" },
  settings: { perm: "settings.write" },
  hours: { perm: "settings.write" },
  delivery: { perm: "settings.write" },
  help: { perm: "support.use" },
  feedback: { perm: "support.use" }, // ratings + complaints about this store
  members: { perm: "members.read" },
  pharmacy: { perm: "pharmacy.use" }, // medicine requests: pharmacy-type stores only
};
const ALL_SECTIONS = Object.keys(SECTIONS).filter((k) => k !== "pharmacy");

const isPharmacyType = (type) => !!type && type.id === "pharmacy";
/** Sections a store type shows. The pharmacy section belongs to the pharmacy type only (even if an older stored
 *  copy of the type predates it) and never to any other type. */
function sectionsFor(type) {
  const base = (type?.sections || []).filter((k) => SECTIONS[k] && k !== "pharmacy");
  return isPharmacyType(type) ? [...base, "pharmacy"] : base;
}

/* ------------------------------------------------------------------ *
 * Product attribute fields (flexible, per type)
 * kind: text | number | bool | select
 * Stored on the product as `item.attrs` — core fields (name, price,
 * salePrice, stock, cat, img, isAvailable, sizes, extras) are universal.
 * ------------------------------------------------------------------ */

const UNITS = ["piece", "kg", "g", "l", "ml", "pack", "bunch", "dozen"];

const F = {
  prepTimeMin: { key: "prepTimeMin", kind: "number", min: 0, max: 600, label: { ar: "وقت التحضير (دقيقة)", fr: "Temps de préparation (min)" } },
  servings: { key: "servings", kind: "number", min: 1, max: 100, label: { ar: "عدد الأشخاص", fr: "Nombre de personnes" } },
  unit: { key: "unit", kind: "select", options: UNITS, label: { ar: "الوحدة", fr: "Unité" } },
  brand: { key: "brand", kind: "text", max: 60, label: { ar: "العلامة التجارية", fr: "Marque" } },
  packSize: { key: "packSize", kind: "text", max: 40, label: { ar: "حجم العبوة", fr: "Conditionnement" } },
  origin: { key: "origin", kind: "text", max: 60, label: { ar: "المصدر", fr: "Origine" } },
  allergens: { key: "allergens", kind: "text", max: 200, label: { ar: "مسببات الحساسية", fr: "Allergènes" } },
  preorderHours: { key: "preorderHours", kind: "number", min: 0, max: 168, label: { ar: "الحجز المسبق (ساعات)", fr: "Précommande (h)" } },
  model: { key: "model", kind: "text", max: 80, label: { ar: "الموديل", fr: "Modèle" } },
  warrantyMonths: { key: "warrantyMonths", kind: "number", min: 0, max: 120, label: { ar: "الضمان (أشهر)", fr: "Garantie (mois)" } },
  colors: { key: "colors", kind: "text", max: 120, label: { ar: "الألوان المتاحة", fr: "Couleurs" } },
  sizeOptions: { key: "sizeOptions", kind: "text", max: 120, label: { ar: "المقاسات المتاحة", fr: "Tailles" } },
  activeIngredient: { key: "activeIngredient", kind: "text", max: 120, label: { ar: "المادة الفعالة", fr: "Principe actif" } },
  dosageForm: { key: "dosageForm", kind: "text", max: 60, label: { ar: "الشكل الصيدلاني", fr: "Forme galénique" } },
  requiresPrescription: { key: "requiresPrescription", kind: "bool", label: { ar: "يتطلب وصفة طبية", fr: "Sur ordonnance" } },
  controlled: { key: "controlled", kind: "bool", label: { ar: "دواء مقيّد/منظّم", fr: "Médicament contrôlé" } },
};

const f = (...keys) => keys.map((k) => F[k]);

/* ------------------------------------------------------------------ *
 * Default store types (seed). `flow`:
 *   "admin_review" — legacy restaurant path: new -> admin_accepted -> ...
 *   "direct"       — order goes straight to the store (status admin_accepted),
 *                    the admin still sees every order with full details.
 * ------------------------------------------------------------------ */

const DEFAULT_STORE_TYPES = [
  { id: "restaurant", icon: "🍽️", name: { ar: "مطعم", fr: "Restaurant", en: "Restaurant" }, flow: "admin_review", sections: ALL_SECTIONS.filter((s) => s !== "inventory"), productFields: f("prepTimeMin", "servings", "allergens") },
  { id: "fastfood", icon: "🍔", name: { ar: "وجبات سريعة", fr: "Fast-food", en: "Fast food" }, flow: "admin_review", sections: ALL_SECTIONS.filter((s) => s !== "inventory"), productFields: f("prepTimeMin", "servings", "allergens") },
  { id: "pizza", icon: "🍕", name: { ar: "بيتزا", fr: "Pizzeria", en: "Pizza" }, flow: "admin_review", sections: ALL_SECTIONS.filter((s) => s !== "inventory"), productFields: f("prepTimeMin", "servings", "allergens") },
  { id: "greengrocer", icon: "🥬", name: { ar: "خضر وفواكه", fr: "Fruits & légumes", en: "Greengrocer" }, flow: "direct", sections: ALL_SECTIONS, productFields: f("unit", "origin") },
  { id: "grocery", icon: "🛒", name: { ar: "بقالة", fr: "Épicerie", en: "Grocery" }, flow: "direct", sections: ALL_SECTIONS, productFields: f("brand", "packSize", "unit") },
  { id: "pharmacy", icon: "💊", name: { ar: "صيدلية", fr: "Pharmacie", en: "Pharmacy" }, flow: "direct", sections: [...ALL_SECTIONS, "pharmacy"], productFields: f("activeIngredient", "dosageForm", "brand", "requiresPrescription", "controlled") },
  { id: "cafe", icon: "☕", name: { ar: "مقهى", fr: "Café", en: "Café" }, flow: "direct", sections: ALL_SECTIONS.filter((s) => s !== "inventory"), productFields: f("prepTimeMin", "allergens") },
  { id: "bakery", icon: "🥖", name: { ar: "مخبزة وحلويات", fr: "Boulangerie", en: "Bakery" }, flow: "direct", sections: ALL_SECTIONS, productFields: f("preorderHours", "allergens", "unit") },
  { id: "butcher", icon: "🥩", name: { ar: "لحوم وأسماك", fr: "Boucherie / Poissonnerie", en: "Butcher & fish" }, flow: "direct", sections: ALL_SECTIONS, productFields: f("unit", "origin") },
  { id: "clothing", icon: "👕", name: { ar: "ملابس", fr: "Vêtements", en: "Clothing" }, flow: "direct", sections: ALL_SECTIONS, productFields: f("brand", "sizeOptions", "colors") },
  { id: "electronics", icon: "📱", name: { ar: "إلكترونيات", fr: "Électronique", en: "Electronics" }, flow: "direct", sections: ALL_SECTIONS, productFields: f("brand", "model", "warrantyMonths") },
  { id: "other", icon: "🏪", name: { ar: "متجر آخر", fr: "Autre commerce", en: "Other" }, flow: "direct", sections: ALL_SECTIONS, productFields: f("brand") },
].map((t) => ({ ...t, enabled: true, builtin: true, sortOrder: 0 }));

const FLOWS = ["admin_review", "direct"];
const FIELD_KINDS = ["text", "number", "bool", "select"];

/** Normalize one type definition coming from the super admin. */
function sanitizeType(input, { existing } = {}) {
  const b = input || {};
  const id = slug(existing?.id || b.id);
  if (!id) return { ok: false, error: "Missing type id" };
  const nm = (v) =>
    typeof v === "string"
      ? { ar: str(v, 60), fr: str(v, 60), en: str(v, 60) }
      : { ar: str(v?.ar, 60), fr: str(v?.fr, 60), en: str(v?.en, 60) };
  const name = nm(b.name ?? existing?.name ?? "");
  if (!(name.ar || name.fr || name.en)) return { ok: false, error: "Missing name" };

  const flow = b.flow !== undefined ? String(b.flow) : existing?.flow || "direct";
  if (!FLOWS.includes(flow)) return { ok: false, error: "Invalid flow" };

  const secIn = b.sections !== undefined ? b.sections : existing?.sections || ALL_SECTIONS;
  const sections = [...new Set((Array.isArray(secIn) ? secIn : []).map(String).filter((s) => SECTIONS[s]))];
  if (!sections.includes("dashboard")) sections.unshift("dashboard");

  const fieldsIn = b.productFields !== undefined ? b.productFields : existing?.productFields || [];
  const productFields = [];
  const seen = new Set();
  for (const x of (Array.isArray(fieldsIn) ? fieldsIn : []).slice(0, 20)) {
    const key = slug(x?.key, 30).replace(/-/g, "_");
    const kind = String(x?.kind || "");
    if (!key || seen.has(key) || !FIELD_KINDS.includes(kind)) continue;
    seen.add(key);
    const fld = { key, kind, label: nm(x.label || key) };
    if (kind === "number") {
      fld.min = Number.isFinite(Number(x.min)) ? Number(x.min) : 0;
      fld.max = Number.isFinite(Number(x.max)) ? Number(x.max) : 1000000;
    }
    if (kind === "text") fld.max = Math.min(500, Math.max(1, Math.round(Number(x.max) || 100)));
    if (kind === "select") {
      fld.options = [...new Set((Array.isArray(x.options) ? x.options : []).map((o) => str(o, 40)).filter(Boolean))].slice(0, 30);
      if (!fld.options.length) continue;
    }
    if (x.required === true) fld.required = true;
    productFields.push(fld);
  }

  return {
    ok: true,
    type: {
      id,
      icon: str(b.icon ?? existing?.icon ?? "🏪", 8) || "🏪",
      name,
      flow,
      sections,
      productFields,
      enabled: b.enabled !== undefined ? b.enabled !== false : existing?.enabled !== false,
      builtin: existing?.builtin === true,
      sortOrder: Math.round(Number(b.sortOrder ?? existing?.sortOrder ?? 0)) || 0,
    },
  };
}

/**
 * Merge seeds with stored types. Stored entries override seeds by id;
 * built-ins can be disabled/edited but not deleted (see canDeleteType).
 */
function mergeTypes(stored) {
  const map = new Map(DEFAULT_STORE_TYPES.map((t) => [t.id, t]));
  for (const t of Array.isArray(stored?.types) ? stored.types : []) {
    if (t && t.id) map.set(String(t.id), { ...(map.get(String(t.id)) || {}), ...t });
  }
  return [...map.values()].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

function getType(types, id) {
  const want = String(id || "restaurant");
  return types.find((t) => t.id === want) || types.find((t) => t.id === "restaurant") || null;
}

const canDeleteType = (type, stores) =>
  !type?.builtin && !(stores || []).some((s) => String(s.type || "restaurant") === type.id);

/* ------------------------------------------------------------------ *
 * Product attrs validation (per type)
 * ------------------------------------------------------------------ */

function validateAttrs(type, input) {
  const src = input && typeof input === "object" ? input : {};
  const out = {};
  const errors = [];
  for (const fd of type?.productFields || []) {
    const raw = src[fd.key];
    const empty = raw === undefined || raw === null || raw === "";
    if (empty) {
      if (fd.required) errors.push(`${fd.key}:required`);
      continue;
    }
    if (fd.kind === "bool") out[fd.key] = raw === true || raw === "true" || raw === 1;
    else if (fd.kind === "number") {
      const n = Number(raw);
      if (!Number.isFinite(n) || n < (fd.min ?? 0) || n > (fd.max ?? 1e9)) errors.push(`${fd.key}:invalid`);
      else out[fd.key] = n;
    } else if (fd.kind === "select") {
      if (!(fd.options || []).includes(String(raw))) errors.push(`${fd.key}:invalid`);
      else out[fd.key] = String(raw);
    } else out[fd.key] = str(raw, fd.max || 100);
  }
  return errors.length ? { ok: false, errors } : { ok: true, attrs: out };
}

/**
 * Pharmacy / regulated goods. Controlled medicines can never be listed;
 * prescription-only products can be shown but are NOT orderable online.
 * (Local legal requirements must be confirmed by a pharmacist/lawyer.)
 */
function checkRegulated(attrs) {
  const a = attrs || {};
  if (a.controlled === true) return { ok: false, error: "controlled_not_allowed" };
  return { ok: true, blockedForSale: a.requiresPrescription === true };
}

const blockedForSale = (item) => item?.attrs?.requiresPrescription === true || item?.attrs?.controlled === true;

/* ------------------------------------------------------------------ *
 * Order flow
 * ------------------------------------------------------------------ */

/** Status a freshly created order gets, from the store's type. */
function initialOrderStatus(type) {
  return type?.flow === "direct" ? "admin_accepted" : "new";
}

/** Statuses a store user may set (mirrors the legacy rule: only ready). */
const STORE_ALLOWED_STATUS = ["restaurant_ready", "canceled"];

/* ------------------------------------------------------------------ *
 * Data minimisation for store users
 * ------------------------------------------------------------------ */

const maskPhone = (p) => {
  const d = String(p || "").replace(/\D/g, "");
  return d.length > 4 ? `${"•".repeat(d.length - 4)}${d.slice(-4)}` : "";
};

/** Copy of an order safe to show a store user with `role`. */
function orderForStore(order, role) {
  if (!order) return null;
  const o = JSON.parse(JSON.stringify(order));
  delete o.paymentDetails;
  delete o.verify; // verification salt/counters never leave the server
  // Platform-funded code: the customer pays less, the store's net does not change. Shown as an explicit discount on tickets.
  if (o.promo && Number(o.promo.amount) > 0) {
    o.discount = Math.min(Number(o.promo.amount), Number(o.subtotal) || 0);
    o.promoCode = String(o.promo.code || "");
    delete o.promo;
  }
  if (o.customer && !can(role, "customers.contact")) o.customer.phone = maskPhone(o.customer.phone);
  return o;
}

/* ------------------------------------------------------------------ *
 * Store <-> customer conversations
 * A conversation exists only for a customer that has an order at the store.
 * ------------------------------------------------------------------ */

const MAX_MSG = 1000;

function canConverse(order, storeId) {
  return !!order && !!order.customerId && String(order.restaurantId || "") === String(storeId || "");
}

/** Client-generated idempotency key: a retried POST (bad network, double tap, reload) must never create a 2nd message. */
const cleanClientId = (v) => { const c = String(v == null ? "" : v).trim(); return /^[A-Za-z0-9_.:-]{6,64}$/.test(c) ? c : null; };

function newMessage({ id, from, userId, text, clientId, now = new Date() }) {
  const t = str(text, MAX_MSG);
  if (!t) return null;
  if (from !== "store" && from !== "customer") return null;
  return {
    id,
    clientId: cleanClientId(clientId),
    from,
    userId: userId ? String(userId) : null,
    text: t,
    at: now.toISOString(),
    readByStore: from === "store",
    readByCustomer: from === "customer",
  };
}

const MAX_KEEP = 500;

/** Add a message unless one with the same clientId (from the same side) is already there.
 *  -> { msg, duplicate } ; `msg` is always the stored message. */
function appendMessage(conv, msg) {
  conv.messages = Array.isArray(conv.messages) ? conv.messages : [];
  if (msg.clientId) {
    const dup = conv.messages.find((m) => m.clientId === msg.clientId && m.from === msg.from);
    if (dup) return { msg: dup, duplicate: true };
  }
  conv.messages.push(msg);
  if (conv.messages.length > MAX_KEEP) conv.messages = conv.messages.slice(-MAX_KEEP);
  conv.updatedAt = msg.at;
  return { msg, duplicate: false };
}

/** Messages after `afterId` (incremental polling). Unknown/absent id => the last `limit` messages. */
function messagesAfter(conv, afterId, limit = 300) {
  const all = Array.isArray(conv && conv.messages) ? conv.messages : [];
  if (afterId) {
    const i = all.findIndex((m) => m.id === String(afterId));
    if (i >= 0) return { messages: all.slice(i + 1), reset: false };
  }
  return { messages: all.slice(-limit), reset: !!afterId }; // reset: client's anchor is gone -> replace its list
}

const unreadForStore = (conv) => (conv?.messages || []).filter((m) => m.from === "customer" && !m.readByStore).length;
const unreadForCustomer = (conv) => (conv?.messages || []).filter((m) => m.from === "store" && !m.readByCustomer).length;

function markRead(conv, side) {
  let n = 0;
  for (const m of conv?.messages || []) {
    const fromOther = side === "store" ? m.from === "customer" : m.from === "store";
    const key = side === "store" ? "readByStore" : "readByCustomer";
    if (fromOther && !m[key]) {
      m[key] = true;
      n++;
    }
  }
  return n;
}

/* ------------------------------------------------------------------ *
 * Dashboard stats (real data only). "Order value" vs "actual sales":
 * placed value counts every non-canceled order; sales counts delivered/done.
 * ------------------------------------------------------------------ */

// admin_accepted + no storeAcceptedAt = "new" for the store;
// admin_accepted + storeAcceptedAt = "preparing" (store accepted it).
const isNewForStore = (o) => String(o.status || "") === "admin_accepted" && !o.storeAcceptedAt;
const isPreparing = (o) => String(o.status || "") === "admin_accepted" && !!o.storeAcceptedAt;
const ACTIVE_STATUSES = ["restaurant_ready", "accepted", "picked_up", "on_the_way", "sent"];
const DONE_STATUSES = ["delivered", "done"];

function computeStoreStats({ orders, items, storeId, from, to, lowStock = 5 }) {
  const mine = (orders || []).filter((o) => String(o.restaurantId || "") === String(storeId));
  const inRange = mine.filter((o) => {
    const t = Date.parse(o.createdAt);
    return (!from || t >= from) && (!to || t <= to);
  });
  const st = (o) => String(o.status || "new");
  const sum = (arr) => Math.round(arr.reduce((s, o) => s + Number(o.total || 0), 0) * 100) / 100;
  const products = (items || []).filter((i) => String(i.restaurantId || "") === String(storeId) && i.archived !== true);
  const customers = new Set(inRange.filter((o) => o.customerId).map((o) => String(o.customerId)));
  return {
    newOrders: mine.filter(isNewForStore).length, // always current, not ranged
    preparingOrders: mine.filter(isPreparing).length,
    activeOrders: mine.filter((o) => isPreparing(o) || ACTIVE_STATUSES.includes(st(o))).length,
    completedOrders: inRange.filter((o) => DONE_STATUSES.includes(st(o))).length,
    canceledOrders: inRange.filter((o) => st(o) === "canceled").length,
    ordersValue: sum(inRange.filter((o) => st(o) !== "canceled")),
    sales: sum(inRange.filter((o) => DONE_STATUSES.includes(st(o)))),
    unavailableProducts: products.filter((i) => i.isAvailable === false).length,
    lowStockProducts: products.filter((i) => i.stock !== undefined && i.stock !== null && Number(i.stock) <= lowStock).length,
    customers: customers.size,
    productsTotal: products.length,
  };
}

module.exports = {
  ROLES,
  PERMISSIONS,
  SECTIONS,
  ALL_SECTIONS,
  UNITS,
  DEFAULT_STORE_TYPES,
  STORE_ALLOWED_STATUS,
  can,
  sanitizeType,
  mergeTypes,
  getType,
  canDeleteType,
  validateAttrs,
  checkRegulated,
  blockedForSale,
  initialOrderStatus,
  maskPhone,
  orderForStore,
  canConverse,
  newMessage,
  isPharmacyType,
  sectionsFor,
  appendMessage,
  messagesAfter,
  cleanClientId,
  unreadForStore,
  unreadForCustomer,
  markRead,
  isNewForStore,
  isPreparing,
  computeStoreStats,
};

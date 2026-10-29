"use strict";
/**
 * Catalog logic for dynamic stores/restaurants (no express / no I/O).
 * Pure functions so they can be unit-tested with `node --test`.
 */

const TZ = "Africa/Casablanca";
const STATUSES = ["active", "paused", "unpublished", "archived"];
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

const str = (v, max) =>
  String(v == null ? "" : v)
    .trim()
    .slice(0, max);
const money = (n) => Math.round(Number(n) * 100) / 100;
const num = (v, min, max, def) => {
  if (v === "" || v === null || v === undefined) return def;
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};
const slug = (v, max = 40) =>
  str(v, max)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_-]+/gu, "-")
    .replace(/^-+|-+$/g, "");

/* ---------- hours ---------- */

function normalizeHours(h) {
  if (!h || typeof h !== "object" || !h.days || typeof h.days !== "object")
    return null;
  const days = {};
  for (let d = 0; d < 7; d++) {
    const x = h.days[d] ?? h.days[String(d)];
    if (!x || typeof x !== "object") continue;
    if (x.closed === true) days[d] = { closed: true };
    else if (HHMM.test(String(x.open)) && HHMM.test(String(x.close)))
      days[d] = { open: x.open, close: x.close };
  }
  return Object.keys(days).length ? { days } : null;
}

function localParts(now) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const p = {};
  for (const x of f.formatToParts(now)) p[x.type] = x.value;
  const wd = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[
    p.weekday
  ];
  return { wd, min: Number(p.hour) * 60 + Number(p.minute) };
}
const toMin = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));

/** No hours configured => considered open (admin controls via status). */
function isWithinHours(hours, now = new Date()) {
  const h = normalizeHours(hours);
  if (!h) return true;
  const { wd, min } = localParts(now);
  const today = h.days[wd];
  if (today && !today.closed) {
    const o = toMin(today.open);
    const c = toMin(today.close);
    if (c > o) {
      if (min >= o && min < c) return true;
    } else if (min >= o) return true; // overnight window, evening part
  }
  const y = h.days[(wd + 6) % 7];
  if (y && !y.closed) {
    const o = toMin(y.open);
    const c = toMin(y.close);
    if (c <= o && min < c) return true; // overnight window, after-midnight part
  }
  return false;
}

/* ---------- store status ---------- */

function effectiveStatus(store) {
  const s = String(store?.status || "");
  if (STATUSES.includes(s)) return s;
  return store?.isActive === false ? "unpublished" : "active";
}
const isPublic = (store) => {
  const s = effectiveStatus(store);
  return s === "active" || s === "paused";
};
function isOpenNow(store, now = new Date()) {
  return effectiveStatus(store) === "active" && isWithinHours(store?.hours, now);
}

/**
 * Pick/validate store fields from a request body. Returns only the
 * fields that were provided. `i18n` converts string|{ar,en,fr} -> {ar,en,fr}.
 */
function pickStoreMeta(body, i18n, cleanImg) {
  const b = body || {};
  const out = {};
  if (b.status !== undefined) {
    const s = String(b.status);
    if (STATUSES.includes(s)) out.status = s;
  } else if (b.isActive !== undefined) {
    out.status = b.isActive === false ? "unpublished" : "active";
  }
  if (out.status) out.isActive = out.status === "active" || out.status === "paused";
  if (b.type !== undefined) out.type = slug(b.type) || "restaurant";
  if (b.categoryIds !== undefined)
    out.categoryIds = (Array.isArray(b.categoryIds) ? b.categoryIds : [])
      .map((x) => str(x, 80))
      .filter(Boolean)
      .slice(0, 20);
  if (b.description !== undefined) out.description = i18n(b.description);
  if (b.city !== undefined) out.city = str(b.city, 80);
  if (b.area !== undefined) out.area = str(b.area, 80);
  if (b.minOrder !== undefined) out.minOrder = money(num(b.minOrder, 0, 100000, 0));
  if (b.deliveryFee !== undefined)
    out.deliveryFee = money(num(b.deliveryFee, 0, 10000, 0));
  if (b.freeDeliveryOver !== undefined)
    out.freeDeliveryOver = b.freeDeliveryOver === null || b.freeDeliveryOver === ""
      ? null
      : money(num(b.freeDeliveryOver, 0, 1000000, 0));
  if (b.avgDeliveryMin !== undefined)
    out.avgDeliveryMin = Math.round(num(b.avgDeliveryMin, 0, 600, 30));
  if (b.sortOrder !== undefined) out.sortOrder = Math.round(num(b.sortOrder, -100000, 100000, 0));
  if (b.featured !== undefined) out.featured = b.featured === true;
  if (b.trending !== undefined) out.trending = b.trending === true;
  if (b.offerLabel !== undefined) out.offerLabel = str(b.offerLabel, 60);
  if (b.hours !== undefined) out.hours = normalizeHours(b.hours);
  if (b.coverageAreas !== undefined)
    out.coverageAreas = (Array.isArray(b.coverageAreas) ? b.coverageAreas : [])
      .map((x) => str(x, 80))
      .filter(Boolean)
      .slice(0, 100);
  if (b.email !== undefined || b.contactEmail !== undefined)
    out.contactEmail = str(b.contactEmail ?? b.email, 120);
  if (b.logo !== undefined && cleanImg) out.logo = cleanImg(b.logo);
  if (b.cover !== undefined && cleanImg) out.cover = cleanImg(b.cover);
  return out;
}

function publicStore(s, now = new Date()) {
  return {
    id: s.id,
    name: s.name,
    description: s.description || { ar: "", en: "", fr: "" },
    logo: s.logo || "",
    cover: s.cover || "",
    phone: s.phone || "",
    address: s.address || "",
    city: s.city || "",
    area: s.area || "",
    type: s.type || "restaurant",
    categoryIds: Array.isArray(s.categoryIds) ? s.categoryIds : [],
    status: effectiveStatus(s),
    isActive: isPublic(s),
    isOpen: isOpenNow(s, now),
    hours: s.hours || null,
    minOrder: Number(s.minOrder || 0),
    deliveryFee: Number(s.deliveryFee || 0),
    freeDeliveryOver: s.freeDeliveryOver ?? null,
    avgDeliveryMin: Number(s.avgDeliveryMin || 30),
    offerLabel: s.offerLabel || "",
    featured: s.featured === true,
    trending: s.trending === true,
    sortOrder: Number(s.sortOrder || 0),
  };
}

/* ---------- items & pricing ---------- */

/** Effective unit price: salePrice only when valid and lower than price. */
function unitPrice(item) {
  const p = Number(item?.price || 0);
  const sp = item?.salePrice;
  if (sp !== undefined && sp !== null && sp !== "") {
    const n = Number(sp);
    if (Number.isFinite(n) && n >= 0 && n < p) return money(n);
  }
  return money(p);
}

function pickItemMeta(body) {
  const b = body || {};
  const out = {};
  if (b.salePrice !== undefined)
    out.salePrice =
      b.salePrice === null || b.salePrice === ""
        ? null
        : money(num(b.salePrice, 0, 1000000, 0));
  if (b.featured !== undefined) out.featured = b.featured === true;
  if (b.trending !== undefined) out.trending = b.trending === true;
  if (b.sortOrder !== undefined) out.sortOrder = Math.round(num(b.sortOrder, -100000, 100000, 0));
  if (b.stock !== undefined)
    out.stock =
      b.stock === null || b.stock === ""
        ? null
        : Math.round(num(b.stock, 0, 1000000, 0));
  if (b.archived !== undefined) out.archived = b.archived === true;
  if (b.sizes !== undefined)
    out.sizes = (Array.isArray(b.sizes) ? b.sizes : [])
      .slice(0, 12)
      .map((x) => ({ label: str(x?.label, 40), price: money(num(x?.price, 0, 1000000, 0)) }))
      .filter((x) => x.label);
  if (b.extras !== undefined)
    out.extras = (Array.isArray(b.extras) ? b.extras : [])
      .slice(0, 30)
      .map((x) => ({ label: str(x?.label, 40), price: money(num(x?.price, 0, 1000000, 0)) }))
      .filter((x) => x.label);
  return out;
}

const itemOrderable = (it) =>
  it &&
  it.isAvailable !== false &&
  it.archived !== true &&
  (it.stock === undefined || it.stock === null || Number(it.stock) > 0);

/**
 * Server-side order pricing. Never trusts client prices.
 * lines: [{id, qty}] ; byId: Map(id -> menu item of THIS store)
 */
function computePricing({ store, lines, byId, nameOf, now = new Date() }) {
  if (effectiveStatus(store) !== "active")
    return { ok: false, status: 403, error: "Restaurant not accepting orders" };
  if (!isWithinHours(store.hours, now))
    return { ok: false, status: 403, error: "Restaurant is closed" };

  const items = [];
  for (const l of lines) {
    const src = byId.get(String(l.id));
    if (!src) return { ok: false, status: 400, error: `Invalid item: ${l.id}` };
    if (!itemOrderable(src))
      return { ok: false, status: 409, error: `Item unavailable: ${l.id}` };
    const qty = Math.min(99, Math.floor(Number(l.qty)));
    if (!(qty > 0)) return { ok: false, status: 400, error: "Invalid quantity" };
    if (src.stock !== undefined && src.stock !== null && qty > Number(src.stock))
      return { ok: false, status: 409, error: `Insufficient stock: ${l.id}` };
    const price = unitPrice(src);
    const row = {
      id: String(src.id),
      name: nameOf ? nameOf(src) || String(src.id) : String(src.id),
      qty,
      price,
    };
    if (price !== money(src.price)) row.basePrice = money(src.price);
    items.push(row);
  }
  const subtotal = money(items.reduce((s, it) => s + it.qty * it.price, 0));
  const minOrder = Number(store.minOrder || 0);
  if (subtotal < minOrder)
    return {
      ok: false,
      status: 400,
      error: "Minimum order not reached",
      minOrder,
      subtotal,
    };
  let deliveryFee = money(Number(store.deliveryFee || 0));
  if (
    store.freeDeliveryOver !== undefined &&
    store.freeDeliveryOver !== null &&
    subtotal >= Number(store.freeDeliveryOver)
  )
    deliveryFee = 0;
  return {
    ok: true,
    items,
    subtotal,
    deliveryFee,
    total: money(subtotal + deliveryFee),
  };
}

/** Decrement tracked stock in menu data after a successful order. */
function applyStock(menuData, items) {
  let changed = false;
  for (const it of items) {
    const m = (menuData.items || []).find((x) => String(x.id) === String(it.id));
    if (m && m.stock !== undefined && m.stock !== null) {
      m.stock = Math.max(0, Number(m.stock) - it.qty);
      changed = true;
    }
  }
  return changed;
}

/** Inverse of applyStock: give quantities back (cancelled / rejected order). */
function restoreStock(menuData, items) {
  let changed = false;
  for (const it of items || []) {
    const m = (menuData.items || []).find((x) => String(x.id) === String(it.id));
    const q = Number(it.qty);
    if (m && m.stock !== undefined && m.stock !== null && Number.isFinite(q) && q > 0) {
      m.stock = Number(m.stock) + q;
      changed = true;
    }
  }
  return changed;
}

/* ---------- homepage catalog (categories / banners / sections) ---------- */

const SECTION_TYPES = ["trending", "featured", "offers", "stores", "custom"];
const sortBy = (a, b) =>
  (a.sortOrder || 0) - (b.sortOrder || 0) ||
  String(a.id).localeCompare(String(b.id));

function defaultCatalog() {
  return {
    categories: [],
    banners: [],
    sections: [
      { id: "sec-trending", type: "trending", title: { ar: "الأكثر طلباً", en: "Trending items", fr: "Tendances" }, visible: true, sortOrder: 10, storeIds: [] },
      { id: "sec-featured", type: "featured", title: { ar: "المميّز", en: "Featured items", fr: "À la une" }, visible: true, sortOrder: 20, storeIds: [] },
      { id: "sec-offers", type: "offers", title: { ar: "العروض", en: "Offers", fr: "Offres" }, visible: true, sortOrder: 30, storeIds: [] },
      { id: "sec-stores", type: "stores", title: { ar: "المطاعم والمحلات", en: "Restaurants & shops", fr: "Restaurants et boutiques" }, visible: true, sortOrder: 40, storeIds: [] },
    ],
  };
}

function sanitizeCatalog(input, { i18n, cleanImg, makeId }) {
  const inp = input && typeof input === "object" ? input : {};
  const seen = new Set();
  const uid = (v) => {
    let id = str(v, 80) || makeId();
    while (seen.has(id)) id = makeId();
    seen.add(id);
    return id;
  };
  const date = (v) => {
    const t = Date.parse(String(v || ""));
    return Number.isFinite(t) ? new Date(t).toISOString() : null;
  };
  const categories = (Array.isArray(inp.categories) ? inp.categories : [])
    .slice(0, 200)
    .map((c) => ({
      id: uid(c?.id),
      name: i18n(c?.name),
      icon: cleanImg(c?.icon),
      kind: c?.kind === "dish" ? "dish" : "store",
      visible: c?.visible !== false,
      sortOrder: Math.round(num(c?.sortOrder, -100000, 100000, 0)),
    }))
    .filter((c) => c.name.ar || c.name.en || c.name.fr);
  const banners = (Array.isArray(inp.banners) ? inp.banners : [])
    .slice(0, 50)
    .map((x) => ({
      id: uid(x?.id),
      title: i18n(x?.title),
      subtitle: i18n(x?.subtitle),
      image: cleanImg(x?.image),
      storeId: str(x?.storeId, 80),
      active: x?.active !== false,
      startsAt: date(x?.startsAt),
      endsAt: date(x?.endsAt),
      sortOrder: Math.round(num(x?.sortOrder, -100000, 100000, 0)),
    }));
  const sections = (Array.isArray(inp.sections) ? inp.sections : [])
    .slice(0, 50)
    .map((s) => ({
      id: uid(s?.id),
      type: SECTION_TYPES.includes(s?.type) ? s.type : "custom",
      title: i18n(s?.title),
      visible: s?.visible !== false,
      sortOrder: Math.round(num(s?.sortOrder, -100000, 100000, 0)),
      storeIds: (Array.isArray(s?.storeIds) ? s.storeIds : [])
        .map((v) => str(v, 80))
        .filter(Boolean)
        .slice(0, 100),
    }));
  return { categories, banners, sections };
}

/** Public home payload: only published stores, visible sections/categories, live banners. */
function buildHome({ catalog, stores, items, now = new Date() }) {
  const cat = catalog || defaultCatalog();
  const pubStores = (stores || []).filter(isPublic).map((s) => publicStore(s, now));
  const storeById = new Map(pubStores.map((s) => [s.id, s]));
  const t = now.getTime();
  const live = (b) =>
    b.active !== false &&
    b.image &&
    (!b.startsAt || Date.parse(b.startsAt) <= t) &&
    (!b.endsAt || Date.parse(b.endsAt) >= t);
  const visibleItems = (items || []).filter(
    (it) => itemOrderable(it) && storeById.has(String(it.restaurantId)),
  );
  const shapeItem = (it) => ({
    id: it.id,
    restaurantId: it.restaurantId,
    name: it.name,
    img: it.img || "",
    price: Number(it.price || 0),
    salePrice: unitPrice(it) !== money(it.price) ? unitPrice(it) : null,
    store: storeById.get(String(it.restaurantId)),
  });
  const byOrder = (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0);
  const sections = (cat.sections || [])
    .filter((s) => s.visible !== false)
    .sort(sortBy)
    .map((s) => {
      let st = [];
      let its = [];
      const pinned = (s.storeIds || []).map((id) => storeById.get(id)).filter(Boolean);
      if (s.type === "trending") {
        its = visibleItems.filter((i) => i.trending === true).sort(byOrder).map(shapeItem);
        st = pinned.length ? pinned : pubStores.filter((x) => x.trending).sort(byOrder);
      } else if (s.type === "featured") {
        its = visibleItems.filter((i) => i.featured === true).sort(byOrder).map(shapeItem);
        st = pinned.length ? pinned : pubStores.filter((x) => x.featured).sort(byOrder);
      } else if (s.type === "offers") {
        its = visibleItems.filter((i) => unitPrice(i) !== money(i.price)).sort(byOrder).map(shapeItem);
        st = pinned.length ? pinned : pubStores.filter((x) => x.offerLabel).sort(byOrder);
      } else {
        st = pinned.length ? pinned : pubStores.slice().sort(byOrder);
      }
      return { id: s.id, type: s.type, title: s.title, stores: st, items: its.slice(0, 40) };
    })
    .filter((s) => s.stores.length || s.items.length);
  return {
    categories: (cat.categories || []).filter((c) => c.visible !== false).sort(sortBy),
    banners: (cat.banners || []).filter(live).sort(sortBy),
    sections,
    stores: pubStores.sort(byOrder),
  };
}

module.exports = {
  STATUSES,
  SECTION_TYPES,
  TZ,
  normalizeHours,
  isWithinHours,
  effectiveStatus,
  isPublic,
  isOpenNow,
  pickStoreMeta,
  publicStore,
  unitPrice,
  pickItemMeta,
  itemOrderable,
  computePricing,
  applyStock,
  restoreStock,
  defaultCatalog,
  sanitizeCatalog,
  buildHome,
};

"use strict";
/**
 * Loyalty points programme — pure rules and an append-only points ledger.
 * No I/O: the server owns files/transactions, this module owns the accounting.
 *
 * Model (append-only, never edited, never deleted):
 *   credit entries  kind: earn | campaign | adjust   with `remaining` (available lots)
 *   debit entries   kind: redeem | expire | reverse | adjust
 * Every entry has a UNIQUE `ref`; re-applying the same ref is a harmless no-op,
 * which is what makes retries, double clicks, duplicate webhooks and two
 * simultaneous requests safe (the server additionally serialises them in a
 * transaction).
 *
 * Points are ALWAYS integer >= 0. Money is rounded to 2 decimals. Points are
 * earned only from a trustworthy final order status, never from order creation,
 * and never twice for the same order (`loyalty:earn:<orderId>`).
 */

const LANGS = Object.freeze(["ar", "fr", "en"]);
const FINAL_STATUSES = Object.freeze(["delivered", "done"]);
/** A refunded / canceled order can never earn. */
const DEAD_STATUSES = Object.freeze(["canceled", "cancelled", "rejected", "refunded"]);

const LIMITS = Object.freeze({
  unitAmount: [1, 100000],
  pointsPerUnit: [1, 10000],
  minOrderAmount: [0, 1000000],
  maxPointsPerOrder: [1, 1000000],
  pendingDays: [0, 90],
  pointsPerCurrencyUnit: [1, 100000],
  minPoints: [1, 1000000],
  maxPointsPerTx: [1, 10000000],
  maxPointsPerDay: [1, 10000000],
  expiryDays: [1, 3650],
});

const BASE_MODES = Object.freeze(["paid", "subtotal", "total"]);
const MAX_ABS_POINTS = 10000000;

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const floor2 = (n) => Math.floor((Number(n) + Number.EPSILON) * 100) / 100;
const int = (n) => Math.round(Number(n));
const clean = (v, max) =>
  String(v == null ? "" : v)
    .replace(/[<>\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

/* ------------------------------------------------------------------ */
/* settings                                                            */
/* ------------------------------------------------------------------ */

function defaults() {
  return {
    enabled: false, // the supervisor switches the programme on
    earn: {
      enabled: true,
      statuses: [...FINAL_STATUSES],
      base: "paid", // paid = what the customer actually pays for the goods (after discount)
      includeDeliveryFee: false,
      includeDiscount: false, // false => the discounted amount is used
      unitAmount: 10, // MAD per step
      pointsPerUnit: 1, // points per step
      minOrderAmount: 0,
      maxPointsPerOrder: null,
      maxPointsPerDay: null,
      pendingDays: 0, // 0 = points usable immediately
    },
    redeem: {
      enabled: true,
      pointsPerCurrencyUnit: 100, // 100 points = 1 MAD
      minPoints: 100,
      maxPointsPerTx: null,
      maxPointsPerDay: null,
    },
    expiry: { enabled: false, days: 365 },
    campaigns: [],
    terms: { ar: "", fr: "", en: "" },
    version: 0,
    updatedAt: null,
    updatedBy: null,
  };
}

const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const inRange = (v, [lo, hi]) => {
  if (v === "" || v === null || v === undefined || typeof v === "boolean") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= lo && n <= hi ? n : null;
};
const unknown = (body, allowed) => Object.keys(body || {}).filter((k) => !allowed.includes(k));

function copySettings(s) {
  return JSON.parse(JSON.stringify(s));
}

/**
 * Strict validation of a supervisor update (unknown keys / out-of-range values
 * are rejected, never silently clamped). Returns the merged settings.
 * @returns {{ok:true,value:object}|{ok:false,status:number,code:string,error:string}}
 */
function normalizeSettings(input, prev) {
  const base = prev ? copySettings(prev) : defaults();
  const body = isObj(input) ? input : {};
  const bad = (field, error, code = "INVALID_SETTING") => ({ ok: false, status: 400, code: error ? code : code, error: `${field}: ${error}`, field });

  const topUnknown = unknown(body, ["enabled", "earn", "redeem", "expiry", "campaigns", "terms", "expectedVersion"]);
  if (topUnknown.length) return bad(topUnknown[0], "unknown setting", "UNKNOWN_SETTING");

  if (body.enabled !== undefined) {
    if (typeof body.enabled !== "boolean") return bad("enabled", "must be true or false");
    base.enabled = body.enabled;
  }

  if (body.earn !== undefined) {
    if (!isObj(body.earn)) return bad("earn", "must be an object");
    const u = unknown(body.earn, Object.keys(base.earn));
    if (u.length) return bad("earn." + u[0], "unknown setting", "UNKNOWN_SETTING");
    const e = body.earn;
    if (e.enabled !== undefined) {
      if (typeof e.enabled !== "boolean") return bad("earn.enabled", "must be true or false");
      base.earn.enabled = e.enabled;
    }
    if (e.statuses !== undefined) {
      if (!Array.isArray(e.statuses) || !e.statuses.length) return bad("earn.statuses", "must be a non-empty list");
      const st = [...new Set(e.statuses.map((s) => String(s).trim()))];
      if (st.some((s) => !FINAL_STATUSES.includes(s))) return bad("earn.statuses", "only delivered/done are trustworthy final statuses", "BAD_STATUSES");
      base.earn.statuses = FINAL_STATUSES.filter((s) => st.includes(s));
    }
    if (e.base !== undefined) {
      if (!BASE_MODES.includes(String(e.base))) return bad("earn.base", "must be paid, subtotal or total");
      base.earn.base = String(e.base);
    }
    for (const k of ["includeDeliveryFee", "includeDiscount"]) {
      if (e[k] === undefined) continue;
      if (typeof e[k] !== "boolean") return bad("earn." + k, "must be true or false");
      base.earn[k] = e[k];
    }
    for (const k of ["unitAmount", "minOrderAmount"]) {
      if (e[k] === undefined) continue;
      const n = inRange(e[k], LIMITS[k]);
      if (n === null) return bad("earn." + k, `must be a number between ${LIMITS[k][0]} and ${LIMITS[k][1]}`);
      base.earn[k] = r2(n);
    }
    if (e.pointsPerUnit !== undefined) {
      const n = inRange(e.pointsPerUnit, LIMITS.pointsPerUnit);
      if (n === null || !Number.isInteger(n)) return bad("earn.pointsPerUnit", `must be an integer between ${LIMITS.pointsPerUnit[0]} and ${LIMITS.pointsPerUnit[1]}`);
      base.earn.pointsPerUnit = n;
    }
    if (e.pendingDays !== undefined) {
      const n = inRange(e.pendingDays, LIMITS.pendingDays);
      if (n === null || !Number.isInteger(n)) return bad("earn.pendingDays", `must be an integer between ${LIMITS.pendingDays[0]} and ${LIMITS.pendingDays[1]}`);
      base.earn.pendingDays = n;
    }
    for (const k of ["maxPointsPerOrder", "maxPointsPerDay"]) {
      if (e[k] === undefined) continue;
      if (e[k] === null || e[k] === "") { base.earn[k] = null; continue; }
      const n = inRange(e[k], LIMITS[k]);
      if (n === null || !Number.isInteger(n)) return bad("earn." + k, `must be an integer between ${LIMITS[k][0]} and ${LIMITS[k][1]}, or empty`);
      base.earn[k] = n;
    }
    if (base.earn.maxPointsPerOrder !== null && base.earn.maxPointsPerOrder < base.earn.pointsPerUnit)
      return bad("earn.maxPointsPerOrder", "must be at least pointsPerUnit");
  }

  if (body.redeem !== undefined) {
    if (!isObj(body.redeem)) return bad("redeem", "must be an object");
    const u = unknown(body.redeem, Object.keys(base.redeem));
    if (u.length) return bad("redeem." + u[0], "unknown setting", "UNKNOWN_SETTING");
    const d = body.redeem;
    if (d.enabled !== undefined) {
      if (typeof d.enabled !== "boolean") return bad("redeem.enabled", "must be true or false");
      base.redeem.enabled = d.enabled;
    }
    for (const k of ["pointsPerCurrencyUnit", "minPoints"]) {
      if (d[k] === undefined) continue;
      const n = inRange(d[k], LIMITS[k]);
      if (n === null || !Number.isInteger(n)) return bad("redeem." + k, `must be an integer between ${LIMITS[k][0]} and ${LIMITS[k][1]}`);
      base.redeem[k] = n;
    }
    for (const k of ["maxPointsPerTx", "maxPointsPerDay"]) {
      if (d[k] === undefined) continue;
      if (d[k] === null || d[k] === "") { base.redeem[k] = null; continue; }
      const n = inRange(d[k], LIMITS[k]);
      if (n === null || !Number.isInteger(n)) return bad("redeem." + k, `must be an integer between ${LIMITS[k][0]} and ${LIMITS[k][1]}, or empty`);
      base.redeem[k] = n;
    }
  }

  if (body.expiry !== undefined) {
    if (!isObj(body.expiry)) return bad("expiry", "must be an object");
    const u = unknown(body.expiry, ["enabled", "days"]);
    if (u.length) return bad("expiry." + u[0], "unknown setting", "UNKNOWN_SETTING");
    if (body.expiry.enabled !== undefined) {
      if (typeof body.expiry.enabled !== "boolean") return bad("expiry.enabled", "must be true or false");
      base.expiry.enabled = body.expiry.enabled;
    }
    if (body.expiry.days !== undefined) {
      const n = inRange(body.expiry.days, LIMITS.expiryDays);
      if (n === null || !Number.isInteger(n)) return bad("expiry.days", `must be an integer between ${LIMITS.expiryDays[0]} and ${LIMITS.expiryDays[1]}`);
      base.expiry.days = n;
    }
  }

  if (body.terms !== undefined) {
    if (!isObj(body.terms)) return bad("terms", "must be an object");
    const u = unknown(body.terms, LANGS);
    if (u.length) return bad("terms." + u[0], "unknown language", "UNKNOWN_SETTING");
    for (const l of LANGS) if (body.terms[l] !== undefined) base.terms[l] = clean(body.terms[l], 2000);
  }

  if (body.campaigns !== undefined) {
    if (!Array.isArray(body.campaigns)) return bad("campaigns", "must be a list");
    if (body.campaigns.length > 50) return bad("campaigns", "too many campaigns (max 50)");
    const out = [];
    for (const c of body.campaigns) {
      if (!isObj(c)) return bad("campaigns", "every campaign must be an object");
      const id = clean(c.id || `camp_${out.length + 1}`, 40).replace(/[^A-Za-z0-9_-]/g, "");
      const name = clean(c.name, 80);
      const points = inRange(c.points, [1, 1000000]);
      if (!id || !name || points === null || !Number.isInteger(points)) return bad("campaigns", "each campaign needs an id, a name and integer points");
      out.push({
        id,
        name,
        points,
        note: clean(c.note, 300),
        active: c.active !== false,
        startsAt: c.startsAt ? String(c.startsAt).slice(0, 40) : null,
        endsAt: c.endsAt ? String(c.endsAt).slice(0, 40) : null,
      });
    }
    base.campaigns = out;
  }

  if (body.expectedVersion !== undefined && Number(body.expectedVersion) !== Number(base.version || 0)) {
    return { ok: false, status: 409, code: "VERSION_CONFLICT", error: "The settings were changed by someone else. Reload." };
  }

  base.version = Number(base.version || 0) + 1;
  return { ok: true, value: base };
}

/**
 * Safe read of stored settings (never throws, always complete).
 * Storage metadata (version / updatedAt / updatedBy) is stripped before the
 * strict validation, then restored, so a stored record always round-trips.
 */
function settingsOf(raw) {
  const d = defaults();
  if (!isObj(raw)) return d;
  const body = { ...raw };
  delete body.version;
  delete body.updatedAt;
  delete body.updatedBy;
  const v = normalizeSettings(body, d);
  const value = v.ok ? v.value : d;
  value.version = Number(raw.version || 0);
  value.updatedAt = raw.updatedAt || null;
  value.updatedBy = raw.updatedBy || null;
  return value;
}

/** What a customer may see (rates, thresholds, terms) — nothing internal. */
function publicView(settings, lang = "ar") {
  const s = settingsOf(settings);
  const l = LANGS.includes(lang) ? lang : "ar";
  return {
    enabled: !!s.enabled,
    earn: {
      enabled: !!s.earn.enabled,
      unitAmount: s.earn.unitAmount,
      pointsPerUnit: s.earn.pointsPerUnit,
      base: s.earn.base,
      includeDeliveryFee: !!s.earn.includeDeliveryFee,
      includeDiscount: !!s.earn.includeDiscount,
      minOrderAmount: s.earn.minOrderAmount,
      maxPointsPerOrder: s.earn.maxPointsPerOrder,
      pendingDays: s.earn.pendingDays,
      rule: earningRuleText(s, l),
    },
    redeem: {
      enabled: !!(s.enabled && s.redeem.enabled),
      pointsPerCurrencyUnit: s.redeem.pointsPerCurrencyUnit,
      minPoints: s.redeem.minPoints,
      maxPointsPerTx: s.redeem.maxPointsPerTx,
      maxPointsPerDay: s.redeem.maxPointsPerDay,
      rate: r2(1 / (Number(s.redeem.pointsPerCurrencyUnit) || 1)),
    },
    expiry: { enabled: !!s.expiry.enabled, days: s.expiry.days },
    campaigns: s.campaigns.filter((c) => c.active),
    terms: termsText(s, l),
    customTerms: s.terms[l] || "",
  };
}

/** Human sentence describing how points are earned (shown before joining). */
function earningRuleText(s, lang = "ar") {
  const unit = s.earn.unitAmount;
  const pts = s.earn.pointsPerUnit;
  const baseKey = s.earn.base === "total" ? "total" : s.earn.base === "subtotal" ? "subtotal" : "paid";
  const text = {
    ar: `تحصل على ${pts} نقطة مقابل كل ${unit} درهم من ${baseKey === "total" ? "إجمالي الطلب" : baseKey === "subtotal" ? "قيمة المنتجات قبل الخصم" : "المبلغ المدفوع فعليًا"}${s.earn.includeDeliveryFee ? " (شامل رسوم التوصيل)" : " (بدون رسوم التوصيل)"}${s.earn.includeDiscount ? "" : " بعد الخصومات"}، بعد تسليم الطلب وتأكيده.`,
    fr: `${pts} point(s) par tranche de ${unit} MAD sur ${baseKey === "total" ? "le total de la commande" : baseKey === "subtotal" ? "les articles avant remise" : "le montant réellement payé"}${s.earn.includeDeliveryFee ? " (livraison incluse)" : " (hors livraison)"}${s.earn.includeDiscount ? "" : " après remises"}, une fois la commande livrée et confirmée.`,
    en: `${pts} point(s) for every ${unit} MAD of ${baseKey === "total" ? "the order total" : baseKey === "subtotal" ? "the items value before discount" : "the amount actually paid"}${s.earn.includeDeliveryFee ? " (delivery included)" : " (delivery excluded)"}${s.earn.includeDiscount ? "" : " after discounts"}, once the order is delivered and confirmed.`,
  };
  return text[LANGS.includes(lang) ? lang : "ar"];
}

function termsText(s, lang = "ar") {
  const l = LANGS.includes(lang) ? lang : "ar";
  const rate = r2(1 / (Number(s.redeem.pointsPerCurrencyUnit) || 1));
  const lines = {
    ar: [
      earningRuleText(s, "ar"),
      `الحد الأدنى للتحويل إلى المحفظة: ${s.redeem.minPoints} نقطة.`,
      `سعر التحويل: ${s.redeem.pointsPerCurrencyUnit} نقطة = 1 درهم (كل ${s.redeem.pointsPerCurrencyUnit} نقطة تُضاف ${rate} درهم).`,
      s.redeem.maxPointsPerTx ? `الحد الأقصى للتحويل في العملية الواحدة: ${s.redeem.maxPointsPerTx} نقطة.` : "",
      s.redeem.maxPointsPerDay ? `الحد الأقصى للتحويل اليومي: ${s.redeem.maxPointsPerDay} نقطة.` : "",
      s.expiry.enabled ? `تنتهي صلاحية النقاط بعد ${s.expiry.days} يومًا من تاريخ اكتسابها.` : "لا تنتهي صلاحية النقاط حاليًا.",
      s.earn.pendingDays ? `تصبح النقاط قابلة للاستخدام بعد ${s.earn.pendingDays} يومًا من اكتسابها.` : "تصبح النقاط قابلة للاستخدام فور تأكيد الطلب.",
      "إذا أُلغي الطلب أو استُرجع مبلغه، تُسحب النقاط المكتسبة عنه.",
      "لا تُمنح النقاط إلا مرة واحدة لكل طلب.",
    ],
    fr: [
      earningRuleText(s, "fr"),
      `Conversion minimale vers le portefeuille : ${s.redeem.minPoints} points.`,
      `Taux : ${s.redeem.pointsPerCurrencyUnit} points = 1 MAD (chaque ${s.redeem.pointsPerCurrencyUnit} points = ${rate} MAD).`,
      s.redeem.maxPointsPerTx ? `Maximum par conversion : ${s.redeem.maxPointsPerTx} points.` : "",
      s.redeem.maxPointsPerDay ? `Maximum par jour : ${s.redeem.maxPointsPerDay} points.` : "",
      s.expiry.enabled ? `Les points expirent ${s.expiry.days} jours après leur obtention.` : "Les points n'expirent pas pour le moment.",
      s.earn.pendingDays ? `Les points deviennent utilisables ${s.earn.pendingDays} jours après leur obtention.` : "Les points sont utilisables dès la confirmation de la commande.",
      "En cas d'annulation ou de remboursement, les points gagnés sont retirés.",
      "Les points ne sont accordés qu'une seule fois par commande.",
    ],
    en: [
      earningRuleText(s, "en"),
      `Minimum conversion to the wallet: ${s.redeem.minPoints} points.`,
      `Rate: ${s.redeem.pointsPerCurrencyUnit} points = 1 MAD (each ${s.redeem.pointsPerCurrencyUnit} points = ${rate} MAD).`,
      s.redeem.maxPointsPerTx ? `Maximum per conversion: ${s.redeem.maxPointsPerTx} points.` : "",
      s.redeem.maxPointsPerDay ? `Maximum per day: ${s.redeem.maxPointsPerDay} points.` : "",
      s.expiry.enabled ? `Points expire ${s.expiry.days} days after they are earned.` : "Points do not expire for now.",
      s.earn.pendingDays ? `Points become usable ${s.earn.pendingDays} days after they are earned.` : "Points are usable as soon as the order is confirmed.",
      "If an order is cancelled or refunded, the points earned for it are removed.",
      "Points are granted only once per order.",
    ],
  };
  return lines[l].filter(Boolean).join("\n");
}

/* ------------------------------------------------------------------ */
/* earning                                                            */
/* ------------------------------------------------------------------ */

const orderStatus = (o) => String((o && o.status) || "").toLowerCase();
const orderDiscount = (o) => {
  if (!o) return 0;
  // The server stores the applied promo snapshot on the order; older rows may only
  // carry a plain `discount` amount. Both must reduce the earning base.
  const candidates = [
    o.promo && Number(o.promo.amount),
    Number(o.discount),
    Number(o.discountAmount),
  ];
  const raw = candidates.find((n) => Number.isFinite(n) && n > 0);
  return raw ? r2(Math.min(raw, Number(o.subtotal) || 0)) : 0;
};

/**
 * Points an order earns, or the reason it earns nothing. Pure: the caller
 * decides whether the order state is trustworthy.
 * @returns {{eligible:boolean, points:number, base:number, reason?:string}}
 */
function earnForOrder(order, settings) {
  const s = settingsOf(settings);
  if (!s.enabled) return { eligible: false, points: 0, base: 0, reason: "program_disabled" };
  if (!s.earn.enabled) return { eligible: false, points: 0, base: 0, reason: "earning_disabled" };
  if (!order) return { eligible: false, points: 0, base: 0, reason: "no_order" };
  const st = orderStatus(order);
  if (DEAD_STATUSES.includes(st)) return { eligible: false, points: 0, base: 0, reason: "order_not_eligible" };
  if (order.refundedAt || order.refund) return { eligible: false, points: 0, base: 0, reason: "refunded" };
  const allowed = s.earn.statuses && s.earn.statuses.length ? s.earn.statuses : FINAL_STATUSES;
  if (!allowed.includes(st)) return { eligible: false, points: 0, base: 0, reason: "status_not_final" };

  const subtotal = Math.max(0, Number(order.subtotal) || 0);
  const deliveryFee = Math.max(0, Number(order.deliveryFee) || 0);
  const discount = orderDiscount(order);
  const goodsAfterDiscount = Math.max(0, subtotal - discount);

  let base;
  if (s.earn.base === "total") {
    base = subtotal; // gross goods, before discounts
    if (s.earn.includeDeliveryFee) base += deliveryFee;
    if (s.earn.includeDiscount === false && discount > 0) base = goodsAfterDiscount + (s.earn.includeDeliveryFee ? deliveryFee : 0);
  } else if (s.earn.base === "subtotal") {
    base = subtotal;
    if (s.earn.includeDeliveryFee) base += deliveryFee;
    if (!s.earn.includeDiscount && discount > 0) base = goodsAfterDiscount + (s.earn.includeDeliveryFee ? deliveryFee : 0);
  } else {
    // "paid": what the customer actually hands over for the goods
    base = goodsAfterDiscount;
    if (s.earn.includeDeliveryFee) base += deliveryFee;
    if (s.earn.includeDiscount) base = subtotal + (s.earn.includeDeliveryFee ? deliveryFee : 0);
  }
  base = r2(Math.max(0, base));

  if (base < Number(s.earn.minOrderAmount || 0)) return { eligible: false, points: 0, base, reason: "below_min_order" };
  const unit = Number(s.earn.unitAmount) || 0;
  if (!(unit > 0)) return { eligible: false, points: 0, base, reason: "bad_rule" };
  let points = Math.floor((base + 1e-9) / unit) * Math.max(1, int(s.earn.pointsPerUnit));
  if (s.earn.maxPointsPerOrder != null) points = Math.min(points, s.earn.maxPointsPerOrder);
  points = Math.max(0, int(points));
  if (!points) return { eligible: false, points: 0, base, reason: "below_step" };
  return { eligible: true, points, base, reason: null };
}

const earnRef = (orderId) => `loyalty:earn:${orderId}`;
const reverseRef = (orderId) => `loyalty:reverse:${orderId}`;
const expireRef = (entryId) => `loyalty:expire:${entryId}`;
const redeemRef = (id) => `loyalty:redeem:${id}`;

/* ------------------------------------------------------------------ */
/* ledger                                                             */
/* ------------------------------------------------------------------ */

function ensure(account) {
  const a = account && typeof account === "object" ? account : {};
  if (!Array.isArray(a.entries)) a.entries = [];
  if (!a.customerId) a.customerId = "";
  return a;
}

const CREDIT_KINDS = Object.freeze(["earn", "campaign", "adjust"]);
const DEBIT_KINDS = Object.freeze(["redeem", "expire", "reverse", "adjust"]);

const marksOnlyLeft = (points, markOnly) => (markOnly ? 0 : points);

function newId(rand) {
  return rand ? rand() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Add a credit lot.
 * @returns {{ok:true,entry:object,duplicate:boolean}|{ok:false,code:string,error:string}}
 */
function credit(account, e) {
  const a = ensure(account);
  const ref = String((e && e.ref) || "").trim();
  if (!ref) return { ok: false, code: "REF_REQUIRED", error: "ref is required" };
  const dup = a.entries.find((x) => x.ref === ref);
  if (dup) return { ok: true, entry: dup, duplicate: true };
  const kind = CREDIT_KINDS.includes(e.kind) ? e.kind : "earn";
  const points = int(e.points);
  if (!Number.isFinite(points) || points <= 0 || points > MAX_ABS_POINTS) return { ok: false, code: "BAD_POINTS", error: "Invalid points" };
  const at = e.at || new Date().toISOString();
  const pending = kind !== "adjust" && Number(e.holdDays || 0) > 0;
  const expiresAt = e.expiresDays > 0 ? new Date(Date.parse(at) + Number(e.expiresDays) * 86400000).toISOString() : null;
  const entry = {
    id: newId(e.rand),
    ref,
    direction: "credit",
    kind,
    points,
    remaining: pending ? 0 : points,
    status: pending ? "pending" : "available",
    reason: clean(e.reason, 300),
    orderId: e.orderId ? String(e.orderId) : null,
    campaignId: e.campaignId ? String(e.campaignId) : null,
    at,
    availableAt: pending ? new Date(Date.parse(at) + Number(e.holdDays) * 86400000).toISOString() : at,
    expiresAt,
    actorType: e.actorType ? String(e.actorType) : "system",
    actorId: e.actorId != null ? String(e.actorId) : null,
    meta: e.meta && typeof e.meta === "object" ? e.meta : undefined,
  };
  a.entries.unshift(entry);
  return { ok: true, entry, duplicate: false };
}

/** Available lots, oldest first (FIFO consumption). */
function lots(a, now) {
  const t = Date.parse(now || new Date().toISOString());
  return ensure(a)
    .entries.filter((x) => x.direction === "credit" && x.status === "available" && Number(x.remaining) > 0)
    .filter((x) => !x.expiresAt || Date.parse(x.expiresAt) > t)
    .sort((x, y) => String(x.at).localeCompare(String(y.at)));
}

function availableOf(a, now) {
  return lots(a, now).reduce((s, x) => s + Number(x.remaining || 0), 0);
}

/**
 * Debit points, consuming available lots FIFO.
 * `reverse` may consume partially: the uncovered part becomes a documented debt
 * that future earnings offset (points already spent can never be double counted).
 * @returns {{ok:true,entry:object,duplicate:boolean}|{ok:false,code:string,error:string,available?:number}}
 */
function debit(account, e) {
  const a = ensure(account);
  const ref = String((e && e.ref) || "").trim();
  if (!ref) return { ok: false, code: "REF_REQUIRED", error: "ref is required" };
  const dup = a.entries.find((x) => x.ref === ref);
  if (dup) return { ok: true, entry: dup, duplicate: true };
  const kind = DEBIT_KINDS.includes(e.kind) ? e.kind : "adjust";
  const points = int(e.points);
  if (!Number.isFinite(points) || points <= 0 || points > MAX_ABS_POINTS) return { ok: false, code: "BAD_POINTS", error: "Invalid points" };
  const at = e.at || new Date().toISOString();
  const partial = kind === "reverse" || e.allowPartial === true;
  const markOnly = e.markOnly === true; // withdraw a PENDING credit: no lot to consume
  const pool = markOnly ? [] : lots(a, at);
  const total = pool.reduce((s, x) => s + Number(x.remaining || 0), 0);
  if (!markOnly && total < points && !partial) {
    return { ok: false, code: "INSUFFICIENT_POINTS", error: "Not enough points", available: total };
  }
  let left = marksOnlyLeft(points, markOnly);
  const consumed = [];
  for (const lot of pool) {
    if (left <= 0) break;
    const take = Math.min(Number(lot.remaining), left);
    if (take <= 0) continue;
    lot.remaining = Number(lot.remaining) - take;
    if (Number(lot.remaining) <= 0) lot.status = "exhausted";
    consumed.push({ entryId: lot.id, points: take });
    left -= take;
  }
  const uncovered = markOnly ? 0 : left > 0 ? left : 0;
  if (markOnly && e.voidCreditRef) {
    const src = a.entries.find((x) => x.direction === "credit" && x.ref === e.voidCreditRef && x.status === "pending");
    if (src) {
      src.remaining = 0;
      src.status = "reversed";
    }
  }
  const entry = {
    id: newId(e.rand),
    ref,
    direction: "debit",
    kind,
    points,
    consumed,
    uncovered,
    status: "applied",
    reason: clean(e.reason, 300),
    orderId: e.orderId ? String(e.orderId) : null,
    walletRef: e.walletRef ? String(e.walletRef) : null,
    at,
    actorType: e.actorType ? String(e.actorType) : "system",
    actorId: e.actorId != null ? String(e.actorId) : null,
    meta: e.meta && typeof e.meta === "object" ? e.meta : undefined,
  };
  a.entries.unshift(entry);
  return { ok: true, entry, duplicate: false };
}

/** Balances derived from the ledger — never from a number the client sent. */
function balances(account, now) {
  const a = ensure(account);
  const t = Date.parse(now || new Date().toISOString());
  let earnedTotal = 0;
  let adjustments = 0;
  let pending = 0;
  let available = 0;
  let used = 0;
  let expired = 0;
  let reversed = 0;
  let debt = 0;
  let expiringSoon = 0;
  for (const e of a.entries) {
    if (e.direction === "credit") {
      const p = Number(e.points) || 0;
      if (e.kind === "adjust") adjustments += p;
      else earnedTotal += p;
      if (e.status === "pending") pending += p;
      if (e.status === "available") {
        const rem = Number(e.remaining) || 0;
        if (!e.expiresAt || Date.parse(e.expiresAt) > t) {
          available += rem;
          if (e.expiresAt && Date.parse(e.expiresAt) - t < 30 * 86400000) expiringSoon += rem;
        }
      }
    } else if (e.direction === "debit") {
      const p = Number(e.points) || 0;
      if (e.kind === "redeem") used += p;
      else if (e.kind === "expire") expired += p;
      else if (e.kind === "reverse") reversed += p;
      else if (e.kind === "adjust") adjustments -= p;
      debt += Number(e.uncovered) || 0;
    }
  }
  return {
    earnedTotal,
    adjustments,
    available: Math.max(0, available),
    pending,
    used,
    expired,
    reversed,
    debt,
    expiringSoon,
  };
}

/**
 * Formalise the expiry of lots whose validity ended (idempotent by ref).
 * Expired lots are no longer consumable, so the write-off entry is created
 * directly (with the lot link) instead of going through debit().
 */
function expireDue(account, now = new Date().toISOString()) {
  const a = ensure(account);
  const t = Date.parse(now);
  const out = [];
  for (const e of [...a.entries].reverse()) {
    if (e.direction !== "credit" || e.status !== "available") continue;
    if (!e.expiresAt || Date.parse(e.expiresAt) > t) continue;
    const rem = Number(e.remaining) || 0;
    if (rem <= 0) continue;
    const ref = expireRef(e.id);
    if (a.entries.some((x) => x.ref === ref)) continue;
    const entry = {
      id: newId(),
      ref,
      direction: "debit",
      kind: "expire",
      points: rem,
      consumed: [{ entryId: e.id, points: rem }],
      uncovered: 0,
      status: "applied",
      reason: "Points expired",
      orderId: e.orderId || null,
      walletRef: null,
      at: now,
      actorType: "system",
      actorId: null,
    };
    a.entries.unshift(entry);
    e.remaining = 0;
    e.status = "expired";
    out.push(entry);
  }
  return out;
}

/** Move matured pending credits into the available balance. */
function settlePending(account, now = new Date().toISOString()) {
  const a = ensure(account);
  const t = Date.parse(now);
  const out = [];
  for (const e of a.entries) {
    if (e.direction !== "credit" || e.status !== "pending") continue;
    if (e.availableAt && Date.parse(e.availableAt) > t) continue;
    e.status = "available";
    e.remaining = Number(e.points) || 0;
    out.push(e);
  }
  return out;
}

/**
 * Quote a points → wallet conversion against the supervisor's rules.
 * @returns {{ok:true,points:number,amount:number}|{ok:false,status:number,code:string,error:string,...}}
 */
function redeemQuote(account, requested, settings, opts = {}) {
  const s = settingsOf(settings);
  const fail = (status, code, error, extra) => ({ ok: false, status, code, error, ...(extra || {}) });
  if (!s.enabled) return fail(409, "PROGRAM_DISABLED", "The loyalty programme is not active");
  if (!s.redeem.enabled) return fail(409, "REDEEM_DISABLED", "Points conversion is not available");
  const bal = balances(account, opts.now);
  const points = int(requested);
  if (!Number.isFinite(points) || points <= 0) return fail(400, "BAD_POINTS", "Enter a valid number of points", { available: bal.available });
  if (points > bal.available) return fail(409, "INSUFFICIENT_POINTS", "Not enough available points", { available: bal.available, shortfall: points - bal.available });
  if (points < s.redeem.minPoints) return fail(400, "BELOW_MIN_POINTS", `The minimum conversion is ${s.redeem.minPoints} points`, { minPoints: s.redeem.minPoints });
  if (s.redeem.maxPointsPerTx != null && points > s.redeem.maxPointsPerTx) return fail(400, "ABOVE_MAX_POINTS", `The maximum per conversion is ${s.redeem.maxPointsPerTx} points`, { maxPointsPerTx: s.redeem.maxPointsPerTx });
  if (s.redeem.maxPointsPerDay != null && points + Number(opts.redeemedToday || 0) > s.redeem.maxPointsPerDay) {
    return fail(429, "DAILY_LIMIT", `The daily limit is ${s.redeem.maxPointsPerDay} points`, { maxPointsPerDay: s.redeem.maxPointsPerDay, redeemedToday: int(opts.redeemedToday || 0) });
  }
  const per = Number(s.redeem.pointsPerCurrencyUnit) || 0;
  const amount = floor2(points / per);
  if (!(amount > 0)) return fail(400, "TOO_SMALL", `At least ${per} points are needed to convert`, { pointsPerCurrencyUnit: per });
  return { ok: true, points, amount, rate: r2(1 / per), pointsPerCurrencyUnit: per, balances: bal };
}

/** Points redeemed by an account on a given calendar day (UTC). */
function redeemedOn(account, isoDay) {
  const day = String(isoDay || "").slice(0, 10);
  return ensure(account)
    .entries.filter((e) => e.direction === "debit" && e.kind === "redeem" && String(e.at || "").slice(0, 10) === day)
    .reduce((s, e) => s + (Number(e.points) || 0), 0);
}

/** Supervisor manual adjustment validation (reason is mandatory). */
function validateAdjustment(input) {
  const b = input && typeof input === "object" ? input : {};
  const u = unknown(b, ["points", "direction", "reason", "reference", "requestId"]);
  if (u.length) return { ok: false, status: 400, code: "UNKNOWN_FIELD", error: "Unknown field: " + u[0].slice(0, 40) };
  const raw = b.points;
  const num = Number(raw);
  if (raw === "" || raw === null || !Number.isInteger(num) || num <= 0 || num > 1000000) {
    return { ok: false, status: 400, code: "BAD_POINTS", error: "points must be an integer between 1 and 1000000" };
  }
  const points = num;
  const direction = String(b.direction || "").toLowerCase();
  if (!["credit", "debit"].includes(direction)) return { ok: false, status: 400, code: "BAD_DIRECTION", error: "direction must be credit or debit" };
  const reason = clean(b.reason, 300);
  if (reason.length < 3) return { ok: false, status: 400, code: "REASON_REQUIRED", error: "A reason is required" };
  const reference = clean(b.reference, 80) || null;
  return { ok: true, value: { points, direction, reason, reference } };
}

/** Statement for the customer / the supervisor. Newest first. */
function statement(account, { limit = 100 } = {}) {
  const a = ensure(account);
  return a.entries
    .slice()
    .sort((x, y) => String(y.at || "").localeCompare(String(x.at || "")))
    .slice(0, Math.max(1, Math.min(500, Number(limit) || 100)))
    .map((e) => ({
      id: e.id,
      ref: e.ref,
      direction: e.direction,
      kind: e.kind,
      points: Number(e.points) || 0,
      status: e.direction === "credit" ? e.status : "applied",
      remaining: e.direction === "credit" ? Number(e.remaining) || 0 : 0,
      uncovered: Number(e.uncovered) || 0,
      reason: e.reason || "",
      orderId: e.orderId || null,
      walletRef: e.walletRef || null,
      at: e.at || null,
      expiresAt: e.expiresAt || null,
      actorType: e.actorType || null,
    }));
}

module.exports = {
  LANGS,
  FINAL_STATUSES,
  DEAD_STATUSES,
  LIMITS,
  defaults,
  settingsOf,
  normalizeSettings,
  publicView,
  earningRuleText,
  termsText,
  earnForOrder,
  earnRef,
  reverseRef,
  expireRef,
  redeemRef,
  ensure,
  credit,
  debit,
  balances,
  lots,
  availableOf,
  expireDue,
  settlePending,
  redeemQuote,
  redeemedOn,
  validateAdjustment,
  statement,
  r2,
  floor2,
  int,
};

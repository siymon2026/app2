"use strict";
/**
 * Store + driver ratings with supervisor moderation of written comments (spec 16). Pure logic, no I/O.
 *
 * - A rating lives ON the order it is about (one per order and per target):
 *     order.customerRating  -> the store/restaurant rating (name kept: older orders and /api/ratings already use it)
 *     order.driverRating    -> the driver rating
 *   Stars count immediately (they feed the public average). A WRITTEN COMMENT is never public until a supervisor
 *   publishes it: commentStatus none | pending | published | rejected.
 * - Records created before moderation existed have a comment but no commentStatus: they are treated as PENDING
 *   (hidden until reviewed), never as published.
 * - Every moderation decision records reviewer, time and reason (bounded history). Rejecting REQUIRES a reason.
 * - Only the customer of a DELIVERED order may rate, once per target, within the rating window.
 */

const RATING_WINDOW_MS = 7 * 24 * 3600 * 1000;
const COMMENT_STATUSES = Object.freeze(["none", "pending", "published", "rejected"]);
const KINDS = Object.freeze(["store", "driver"]);
const FIELD = Object.freeze({ store: "customerRating", driver: "driverRating" });
const MAX_HISTORY = 20;
const MAX_COMMENT = 500;

const st = (o) => String((o && o.status) || "").toLowerCase();
const isDelivered = (o) => ["delivered", "done"].includes(st(o));
const clean = (s, n) => String(s == null ? "" : s).replace(/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
const ts = (v) => { const t = Date.parse(v); return Number.isFinite(t) ? t : null; };
const deliveredAtMs = (o) => ts(o.deliveredAt) || ts(o.updatedAt) || ts(o.createdAt);
const round1 = (n) => Math.round(n * 10) / 10;

/** Effective moderation state of a rating record (legacy commented records => pending). */
function commentStatusOf(r) {
  if (!r || typeof r !== "object") return "none";
  const hasText = !!String(r.comment || "").trim();
  if (!hasText) return "none";
  return COMMENT_STATUSES.includes(r.commentStatus) && r.commentStatus !== "none" ? r.commentStatus : "pending";
}
const isPublished = (r) => commentStatusOf(r) === "published";

function validateStoreRating(body) {
  const b = body || {};
  const stars = Number(b.stars);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return { ok: false, error: "invalid_stars" };
  return { ok: true, value: { stars, comment: clean(b.comment, MAX_COMMENT) } };
}

/** May the customer rate the STORE of this order now? (ownership is checked by the caller) */
function canRateStore(order, now = Date.now()) {
  if (!order) return { ok: false, error: "not_found" };
  if (!isDelivered(order)) return { ok: false, error: "not_delivered" };
  if (!order.restaurantId) return { ok: false, error: "no_store" };
  const at = deliveredAtMs(order);
  if (at == null || now - at > RATING_WINDOW_MS) return { ok: false, error: "window_expired" };
  // the store rating may be corrected inside the window (it always was); a changed comment goes back to moderation
  return { ok: true, expiresAt: at + RATING_WINDOW_MS, editing: !!(order.customerRating && Number(order.customerRating.stars) >= 1) };
}

/**
 * Stores (or corrects) the store rating on the order. A NEW comment, or a changed one, always returns to moderation, so a
 * published review can never be edited into something nobody approved. An unchanged comment keeps its decision.
 */
function applyStoreRating(order, value, now = new Date()) {
  const at = now.toISOString();
  const prev = order.customerRating && Number(order.customerRating.stars) >= 1 ? order.customerRating : null;
  if (!prev) {
    order.customerRating = { stars: value.stars, comment: value.comment, storeId: String(order.restaurantId), createdAt: at, updatedAt: at, commentStatus: value.comment ? "pending" : "none", moderation: null };
    return order.customerRating;
  }
  const changed = String(prev.comment || "") !== value.comment;
  prev.stars = value.stars;
  prev.updatedAt = at;
  prev.storeId = String(order.restaurantId);
  if (!prev.createdAt) prev.createdAt = at;
  if (changed) {
    prev.comment = value.comment;
    prev.commentStatus = value.comment ? "pending" : "none";
    if (prev.moderation) prev.moderation = { ...prev.moderation, status: prev.commentStatus };
  } else if (!prev.commentStatus) prev.commentStatus = commentStatusOf(prev);
  return prev;
}

/** Moderation state for a driver rating record at creation time. */
const initialCommentStatus = (comment) => (String(comment || "").trim() ? "pending" : "none");

const MODERATION_TRANSITIONS = Object.freeze({ pending: ["published", "rejected"], published: ["rejected"], rejected: ["published"] });

/**
 * Apply a supervisor decision to a rating record (mutates it).
 * @returns {{ok:true,from:string,to:string}|{ok:false,status:number,code:string,error:string}}
 */
function moderate(rating, { decision, by, reason, now = new Date() } = {}) {
  if (!rating || commentStatusOf(rating) === "none") return { ok: false, status: 409, code: "NO_COMMENT", error: "There is no written comment to moderate" };
  const from = commentStatusOf(rating);
  const to = decision === "publish" ? "published" : decision === "reject" ? "rejected" : null;
  if (!to) return { ok: false, status: 400, code: "INVALID_DECISION", error: "Decision must be publish or reject" };
  if (from === to) return { ok: false, status: 409, code: "NO_CHANGE", error: `Comment is already ${to}` };
  if (!MODERATION_TRANSITIONS[from].includes(to)) return { ok: false, status: 409, code: "ILLEGAL_TRANSITION", error: `${from} -> ${to}` };
  const why = clean(reason, 300);
  if (to === "rejected" && why.length < 3) return { ok: false, status: 400, code: "REASON_REQUIRED", error: "A reason is required to reject a comment" };
  const at = now.toISOString();
  const prev = rating.moderation && Array.isArray(rating.moderation.history) ? rating.moderation.history : [];
  const history = [...prev, { from, to, by: String(by || ""), at, reason: why }].slice(-MAX_HISTORY);
  rating.commentStatus = to;
  rating.moderation = { status: to, by: String(by || ""), at, reason: why, history };
  return { ok: true, from, to };
}

/* ---------------- aggregates ---------------- */

const validStars = (r) => { const s = Number(r && r.stars); return Number.isInteger(s) && s >= 1 && s <= 5 ? s : 0; };

function blank() { return { count: 0, avg: 0, dist: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } }; }
function finish(a) { return { count: a.count, avg: a.count ? round1(a.sum / a.count) : 0, dist: a.dist }; }

/** One pass over the orders: Map<storeId, {count, avg, dist}> (public: stars only, never comments). */
function storeAverages(orders) {
  const acc = new Map();
  for (const o of orders || []) {
    const s = validStars(o && o.customerRating);
    const id = o && o.restaurantId ? String(o.restaurantId) : "";
    if (!s || !id) continue;
    const a = acc.get(id) || { ...blank(), sum: 0 };
    a.count++; a.sum += s; a.dist[s]++;
    acc.set(id, a);
  }
  return new Map([...acc].map(([k, a]) => [k, finish(a)]));
}

function driverAverages(orders) {
  const acc = new Map();
  for (const o of orders || []) {
    const r = o && o.driverRating; const s = validStars(r);
    const id = String((o && o.driverId) || (r && r.driverId) || "");
    if (!s || !id) continue;
    const a = acc.get(id) || { ...blank(), sum: 0 };
    a.count++; a.sum += s; a.dist[s]++;
    acc.set(id, a);
  }
  return new Map([...acc].map(([k, a]) => [k, finish(a)]));
}

const none = () => ({ count: 0, avg: 0, dist: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } });
const storeAverage = (orders, storeId) => storeAverages(orders).get(String(storeId)) || none();
const driverAverage = (orders, driverId) => driverAverages(orders).get(String(driverId)) || none();

function maskName(name) {
  const parts = clean(name, 60).split(" ").filter(Boolean);
  if (!parts.length) return "";
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[1].slice(0, 1)}.`;
}

/** Published written reviews of a store (what the public may read). Newest first. */
function publishedStoreReviews(orders, storeId, limit = 20) {
  return (orders || [])
    .filter((o) => o && String(o.restaurantId || "") === String(storeId) && validStars(o.customerRating) && isPublished(o.customerRating))
    .map((o) => ({ stars: o.customerRating.stars, comment: o.customerRating.comment, name: maskName(o.customer && o.customer.name), at: o.customerRating.createdAt || o.updatedAt || null }))
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, Math.max(1, Math.min(100, limit)));
}

/** The supervisor's work list: every comment with its state. kind: store|driver|"" ; status filter optional. */
function moderationQueue(orders, { kind = "", status = "" } = {}) {
  const out = [];
  for (const o of orders || []) {
    for (const k of KINDS) {
      if (kind && kind !== k) continue;
      const r = o && o[FIELD[k]];
      if (!r || !validStars(r)) continue;
      const cs = commentStatusOf(r);
      if (cs === "none") continue;
      if (status && status !== cs) continue;
      out.push({
        orderId: String(o.id), kind: k, stars: r.stars, comment: String(r.comment || ""), commentStatus: cs,
        storeId: o.restaurantId ? String(o.restaurantId) : "", driverId: o.driverId ? String(o.driverId) : "",
        customerName: maskName(o.customer && o.customer.name), createdAt: r.createdAt || null, moderation: r.moderation || null,
        flags: k === "driver" ? { polite: r.polite, askedExtraMoney: r.askedExtraMoney } : undefined,
      });
    }
  }
  return out.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function queueCounts(orders) {
  const c = { pending: 0, published: 0, rejected: 0 };
  for (const q of moderationQueue(orders)) c[q.commentStatus]++;
  return c;
}

/** Flags for the customer's own order list. */
function customerFlags(order, now = Date.now()) {
  const cs = canRateStore(order, now);
  const r = order && order.customerRating;
  return {
    canRateStore: cs.ok,
    rateStoreUntil: cs.ok ? cs.expiresAt : null,
    storeRating: r && validStars(r) ? { stars: r.stars, comment: String(r.comment || ""), commentStatus: commentStatusOf(r) } : null,
  };
}

module.exports = {
  RATING_WINDOW_MS, COMMENT_STATUSES, KINDS, FIELD, MAX_COMMENT,
  commentStatusOf, isPublished, initialCommentStatus, validateStoreRating, canRateStore, applyStoreRating, moderate,
  storeAverages, driverAverages, storeAverage, driverAverage, publishedStoreReviews, moderationQueue, queueCounts, customerFlags, maskName,
};

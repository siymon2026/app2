"use strict";
/** Pure helpers: driver ratings, chat open/closed + unread, live-track payload. No I/O. */
const ratings = require("./ratings");
const RATING_WINDOW_MS = 7 * 24 * 3600 * 1000;
const CLOSED = ["delivered", "done", "canceled", "cancelled"];
const TRACK_STATUSES = ["picked_up", "on_the_way"]; // driver has the food and is heading out
const TRACK_MAX_AGE_MS = 5 * 60 * 1000; // older than this: hide the driver marker

const st = (o) => String((o && o.status) || "").toLowerCase();
const isDelivered = (o) => ["delivered", "done"].includes(st(o));
const clean = (s, n) => String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, n);
const ts = (v) => { const t = Date.parse(v); return Number.isFinite(t) ? t : null; };

function validateDriverRating(body) {
  const b = body || {};
  const stars = Number(b.stars);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return { ok: false, error: "invalid_stars" };
  if (typeof b.polite !== "boolean") return { ok: false, error: "polite_required" };
  if (typeof b.askedExtraMoney !== "boolean") return { ok: false, error: "extra_money_required" };
  return { ok: true, value: { stars, polite: b.polite, askedExtraMoney: b.askedExtraMoney, comment: clean(b.comment, 500) } };
}

function deliveredAtMs(o) { return ts(o.deliveredAt) || ts(o.updatedAt) || ts(o.createdAt); }

function canRateDriver(order, now) {
  if (!order) return { ok: false, error: "not_found" };
  if (!isDelivered(order)) return { ok: false, error: "not_delivered" };
  if (!order.driverId) return { ok: false, error: "no_driver" };
  if (order.driverRating) return { ok: false, error: "already_rated" };
  const at = deliveredAtMs(order);
  if (at == null || now - at > RATING_WINDOW_MS) return { ok: false, error: "window_expired" };
  return { ok: true, expiresAt: at + RATING_WINDOW_MS };
}

/** Aggregates driver ratings from orders (each order carries at most one driverRating). */
function summarize(orders, driverId) {
  const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0, count = 0, impolite = 0, askedMoney = 0;
  for (const o of orders || []) {
    const r = o && o.driverRating;
    if (!r || String(o.driverId || r.driverId || "") !== String(driverId)) continue;
    const s = Number(r.stars);
    if (!(s >= 1 && s <= 5)) continue;
    count++; sum += s; dist[s]++;
    if (r.polite === false) impolite++;
    if (r.askedExtraMoney === true) askedMoney++;
  }
  return { count, avg: count ? Math.round((sum / count) * 10) / 10 : 0, dist, impolite, askedMoney };
}

/**
 * Driver-facing review list: stars + date, and the written comment ONLY once a supervisor published it
 * (spec 16: comments are moderated before publication). No customer identity, no flags.
 */
function reviewsFor(orders, driverId, limit = 30) {
  return (orders || [])
    .filter((o) => o && o.driverRating && String(o.driverId || "") === String(driverId))
    .map((o) => ({ stars: o.driverRating.stars, comment: ratings.isPublished(o.driverRating) ? o.driverRating.comment || "" : "", at: o.driverRating.createdAt || null }))
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, limit);
}

/** Chat is open only while a driver is assigned and the order is not delivered/canceled. */
function isChatOpen(order) { return !!(order && order.driverId) && !CLOSED.includes(st(order)); }

function unreadFor(chat, party) {
  if (!chat || !Array.isArray(chat.messages)) return 0;
  const readAt = chat[party + "ReadAt"] || "";
  return chat.messages.filter((m) => m && m.from !== party && String(m.createdAt || "") > readAt).length;
}
/** Marks everything read for `party`; returns true if state changed (caller saves). */
function markRead(chat, party, nowIso) {
  if (!unreadFor(chat, party)) return false;
  chat[party + "ReadAt"] = nowIso;
  return true;
}

const rad = Math.PI / 180;
function distM(a, b) {
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(s)));
}
const okLL = (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180 && !(p.lat === 0 && p.lng === 0);

/** Delivery coordinates: validated fields, else the exact-location link saved in the notes (older orders). */
function customerCoords(order) {
  const c = (order && order.customer) || {};
  const direct = { lat: Number(c.lat), lng: Number(c.lng) };
  if (okLL(direct)) return direct;
  const m = String(c.notes || "").match(/[?&]q=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/);
  if (m) { const p = { lat: Number(m[1]), lng: Number(m[2]) }; if (okLL(p)) return p; }
  return null;
}

/**
 * Live tracking payload. Only while the order is on_the_way. Straight line:
 * road-following routes need an external routing service.
 */
function trackPayload(order, fix, now) {
  const status = st(order);
  if (!TRACK_STATUSES.includes(status)) return { ok: true, tracking: false, status };
  const destination = customerCoords(order);
  if (!fix || !okLL(fix) || now - fix.at > TRACK_MAX_AGE_MS) return { ok: true, tracking: true, status, driver: null, destination };
  const driver = { lat: Math.round(fix.lat * 1e5) / 1e5, lng: Math.round(fix.lng * 1e5) / 1e5, ageSec: Math.max(0, Math.round((now - fix.at) / 1000)) };
  return { ok: true, tracking: true, status, driver, destination, distanceM: destination ? Math.round(distM(driver, destination)) : null };
}

module.exports = { customerCoords, TRACK_STATUSES, RATING_WINDOW_MS, validateDriverRating, canRateDriver, summarize, reviewsFor, isChatOpen, unreadFor, markRead, trackPayload, isDelivered };

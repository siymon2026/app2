"use strict";
/**
 * Siymon dispatch core: pure, dependency-free logic (no I/O, no clock reads
 * unless `now` is passed). server.js wraps these in its existing withFileLock
 * read-modify-write so all mutations are atomic on the JSON store.
 */

const DRIVER_STATES = ["offline", "available", "offer_pending", "assigned", "delivering", "paused"];
const DEFAULTS = {
  liveMaxAgeMs: 30_000,      // fix newer than this = "live"
  staleMaxAgeMs: 120_000,    // older than this = unusable for dispatch
  maxAccuracyM: 150,         // reject fixes worse than this for dispatch
  offerTtlMs: 25_000,
  maxCandidates: 5,
  maxSpeedMps: 70,           // ~250 km/h; teleport/spoof guard
};

function validCoords(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && !(lat === 0 && lng === 0);
}

function haversineM(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Validate a client-submitted fix. Server stamps its own time; client time is advisory. */
function validateFix(input, prev, now, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const lat = Number(input && input.lat), lng = Number(input && input.lng);
  if (!validCoords(lat, lng)) return { ok: false, error: "invalid_coordinates" };
  const accuracy = input.accuracy == null ? null : Number(input.accuracy);
  if (accuracy != null && (!Number.isFinite(accuracy) || accuracy < 0)) return { ok: false, error: "invalid_accuracy" };
  const num = (v, lo, hi) => (v == null || v === "" || !Number.isFinite(Number(v)) || Number(v) < lo || Number(v) > hi) ? null : Number(v);
  // Section 20: a position the phone captured a while ago (e.g. just before a network drop) must not be stamped
  // "now". The client sends how old the reading is (relative age, immune to clock skew); the server back-dates it.
  // No age sent = captured at receipt (old clients keep working). Too old = refused, never stored as current.
  let ageMs = 0;
  if (input.ageMs != null && input.ageMs !== "") {
    ageMs = Number(input.ageMs);
    if (!Number.isFinite(ageMs) || ageMs < 0) return { ok: false, error: "invalid_age" };
    if (ageMs > o.staleMaxAgeMs) return { ok: false, error: "stale_fix" };
  }
  const fix = { lat, lng, accuracy, heading: num(input.heading, 0, 360), speed: num(input.speed, 0, 100), at: now - ageMs };
  // An older reading never overwrites a newer one (late/out-of-order delivery after a reconnect).
  if (prev && validCoords(prev.lat, prev.lng) && Number.isFinite(prev.at) && fix.at < prev.at) return { ok: false, error: "out_of_order" };
  if (prev && validCoords(prev.lat, prev.lng) && fix.at > prev.at) {
    const mps = haversineM(prev, fix) / ((fix.at - prev.at) / 1000);
    if (mps > o.maxSpeedMps && (fix.at - prev.at) < 60_000) return { ok: false, error: "implausible_jump" };
  }
  return { ok: true, fix };
}

/** live | stale | lost — never report old data as live. */
function freshness(fix, now, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  if (!fix || !validCoords(fix.lat, fix.lng)) return "lost";
  const age = now - fix.at;
  if (age <= o.liveMaxAgeMs) return "live";
  if (age <= o.staleMaxAgeMs) return "stale";
  return "lost";
}

function isDispatchable(driver, now, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  if (!driver || driver.status !== "approved") return false;
  if ((driver.dispatchState || "offline") !== "available") return false;
  const fix = driver.location;
  if (freshness(fix, now, o) !== "live") return false;
  if (fix.accuracy != null && fix.accuracy > o.maxAccuracyM) return false;
  return true;
}

const ALLOWED = {
  offline: ["available"],
  available: ["offline", "offer_pending", "paused", "assigned"],
  offer_pending: ["available", "assigned", "offline"],
  assigned: ["delivering", "available"],
  delivering: ["available"],
  paused: ["available", "offline"],
};
function canTransition(from, to) { return from === to || (ALLOWED[from] || []).includes(to); }

/**
 * Rank candidates. `cellOf`/`ringOf` are injected (H3 in prod, stub in tests).
 * `etaOf` optional (routing service) -> seconds or null; null => straight-line fallback flagged.
 */
function rankCandidates({ drivers, pickup, now, cellOf, ringOf, excludeIds = [], loadOf = () => 0, etaOf, opts = {} }) {
  const o = { ...DEFAULTS, ...opts };
  if (!validCoords(pickup.lat, pickup.lng)) return [];
  const rings = new Set(ringOf(cellOf(pickup.lat, pickup.lng)));
  const skip = new Set(excludeIds.map(String));
  const out = [];
  for (const d of drivers) {
    if (skip.has(String(d.id)) || !isDispatchable(d, now, o)) continue;
    const cell = cellOf(d.location.lat, d.location.lng);
    const distM = haversineM(d.location, pickup);
    const eta = etaOf ? etaOf(d, pickup) : null;
    out.push({
      driverId: String(d.id), cell, inRing: rings.has(cell), distM: Math.round(distM),
      etaSec: eta == null ? null : Math.round(eta), etaSource: eta == null ? "straight_line_unavailable" : "routing",
      load: loadOf(d), lastFixAgeMs: now - d.location.at,
    });
  }
  // Prefer: in-ring, then ETA (when all have it) else distance, then lighter load, then stable id.
  const useEta = out.length > 0 && out.every((c) => c.etaSec != null);
  out.sort((a, b) =>
    (b.inRing - a.inRing) ||
    ((useEta ? a.etaSec - b.etaSec : a.distM - b.distM)) ||
    (a.load - b.load) || (a.driverId < b.driverId ? -1 : 1));
  return out.slice(0, o.maxCandidates);
}

/* ---------- Offers: state is a plain object {offers: []}; callers hold the file lock ---------- */

function createOffer(state, { orderId, driverId, now, ttlMs = DEFAULTS.offerTtlMs, idemKey, reason }) {
  state.offers = state.offers || [];
  if (idemKey) {
    const dup = state.offers.find((x) => x.idemKey === idemKey);
    if (dup) return { ok: true, offer: dup, duplicate: true };
  }
  const live = state.offers.find((x) => x.orderId === orderId && x.status === "pending" && x.expiresAt > now);
  if (live) return { ok: false, error: "offer_already_pending", offer: live };
  const offer = {
    id: "OFR-" + (state.seq = (state.seq || 0) + 1), version: 1, orderId, driverId: String(driverId),
    status: "pending", createdAt: now, expiresAt: now + ttlMs, idemKey: idemKey || null, reason: reason || null,
  };
  state.offers.push(offer);
  return { ok: true, offer };
}

/** Atomic accept: caller runs this inside the lock together with the order write. */
function acceptOffer(state, order, { offerId, driverId, now }) {
  const offer = (state.offers || []).find((x) => x.id === offerId);
  if (!offer || offer.orderId !== order.id) return { ok: false, status: 404, error: "offer_not_found" };
  if (offer.driverId !== String(driverId)) return { ok: false, status: 403, error: "not_your_offer" };
  if (offer.status === "accepted") return { ok: true, offer, duplicate: true }; // idempotent retry
  if (offer.status !== "pending") return { ok: false, status: 409, error: "offer_" + offer.status };
  if (offer.expiresAt <= now) { offer.status = "expired"; offer.version++; return { ok: false, status: 409, error: "offer_expired" }; }
  if (order.driverId && String(order.driverId) !== String(driverId)) return { ok: false, status: 409, error: "order_already_assigned" };
  if (String(order.status) !== "restaurant_ready") return { ok: false, status: 409, error: "order_not_ready" };
  offer.status = "accepted"; offer.version++; offer.respondedAt = now;
  order.driverId = String(driverId);
  order.status = "accepted";
  order.assignmentId = offer.id;
  return { ok: true, offer };
}

function rejectOffer(state, { offerId, driverId, now }) {
  const offer = (state.offers || []).find((x) => x.id === offerId);
  if (!offer) return { ok: false, status: 404, error: "offer_not_found" };
  if (offer.driverId !== String(driverId)) return { ok: false, status: 403, error: "not_your_offer" };
  if (offer.status === "rejected") return { ok: true, offer, duplicate: true };
  if (offer.status !== "pending") return { ok: false, status: 409, error: "offer_" + offer.status };
  offer.status = "rejected"; offer.version++; offer.respondedAt = now;
  return { ok: true, offer };
}

/** Marks overdue pending offers expired; returns them so the caller can offer to the next candidate. */
function expireOffers(state, now) {
  const out = [];
  for (const x of state.offers || []) {
    if (x.status === "pending" && x.expiresAt <= now) { x.status = "expired"; x.version++; out.push(x); }
  }
  return out;
}

module.exports = {
  DEFAULTS, DRIVER_STATES, validCoords, haversineM, validateFix, freshness, isDispatchable,
  canTransition, rankCandidates, createOffer, acceptOffer, rejectOffer, expireOffers,
};

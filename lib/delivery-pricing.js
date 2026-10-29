"use strict";
/**
 * Road-distance delivery pricing.
 *
 * mode "flat"     (default, legacy): the store's own deliveryFee.
 * mode "distance": fee = baseFee + roadKm * pricePerKm  (baseFee defaults to 0).
 *
 * Distance comes ONLY from the routing service (road distance). If it cannot
 * be obtained we return an explicit error; we never substitute a straight-line
 * or invented distance. The store's free-delivery threshold still applies.
 */

const MODES = Object.freeze(["flat", "distance"]);
const BOUNDS = Object.freeze({ pricePerKm: [0, 50], baseFee: [0, 100], maxKm: [1, 60] });

const money = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const okLL = (p) =>
  p && Number.isFinite(p.lat) && Number.isFinite(p.lng) &&
  Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180 && !(p.lat === 0 && p.lng === 0);

const clamp = (v, [lo, hi], dflt) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
};

/** Current settings, always within safe bounds. */
function settingsFromConfig(cfg = {}) {
  return {
    mode: MODES.includes(cfg.deliveryPricingMode) ? cfg.deliveryPricingMode : "flat",
    pricePerKm: money(clamp(cfg.deliveryPricePerKm, BOUNDS.pricePerKm, 0)),
    baseFee: money(clamp(cfg.deliveryBaseFee, BOUNDS.baseFee, 0)),
    maxKm: clamp(cfg.deliveryMaxKm, BOUNDS.maxKm, 15),
  };
}

/**
 * Validate an admin update. Returns {ok:true, values} (values = config keys to
 * set) or {ok:false, error}. Out-of-range numbers are rejected, not clamped,
 * so a typo cannot silently set a different price.
 */
function validateUpdate(body = {}) {
  const values = {};
  if (body.deliveryPricingMode !== undefined) {
    const m = String(body.deliveryPricingMode);
    if (!MODES.includes(m)) return { ok: false, error: "deliveryPricingMode must be flat or distance" };
    values.deliveryPricingMode = m;
  }
  const num = (key, bounds) => {
    if (body[key] === undefined) return null;
    const n = Number(body[key]);
    if (body[key] === "" || !Number.isFinite(n) || n < bounds[0] || n > bounds[1]) {
      return `${key} must be between ${bounds[0]} and ${bounds[1]}`;
    }
    values[key] = money(n);
    return null;
  };
  for (const [k, b] of [
    ["deliveryPricePerKm", BOUNDS.pricePerKm],
    ["deliveryBaseFee", BOUNDS.baseFee],
    ["deliveryMaxKm", BOUNDS.maxKm],
  ]) {
    const err = num(k, b);
    if (err) return { ok: false, error: err };
  }
  return { ok: true, values };
}

function feeFromDistance(distanceM, s) {
  const km = distanceM / 1000;
  return { km: Math.round(km * 100) / 100, fee: money(s.baseFee + km * s.pricePerKm) };
}

/** Store free-delivery threshold, same rule as the flat mode. */
function applyFreeOver(fee, subtotal, store) {
  const t = store && store.freeDeliveryOver;
  if (t !== undefined && t !== null && t !== "" && Number(subtotal) >= Number(t)) return 0;
  return fee;
}

/**
 * @returns {Promise<{ok:true,mode:string,fee:number,distanceM?:number,km?:number,snapshot:object}
 *                  |{ok:false,status:number,code:string,error:string}>}
 */
async function quote({ settings, store, dropoff, subtotal = 0, routeService, now = new Date() }) {
  if (settings.mode !== "distance") {
    const flat = money(Number(store && store.deliveryFee) || 0);
    return {
      ok: true,
      mode: "flat",
      fee: money(applyFreeOver(flat, subtotal, store)),
      snapshot: { mode: "flat", flatFee: flat, computedAt: now.toISOString() },
    };
  }
  const pickup = store ? { lat: Number(store.lat), lng: Number(store.lng) } : null;
  if (!okLL(pickup)) {
    return { ok: false, status: 422, code: "STORE_LOCATION_MISSING", error: "Store location is not configured" };
  }
  const drop = dropoff ? { lat: Number(dropoff.lat), lng: Number(dropoff.lng) } : null;
  if (!okLL(drop)) {
    return { ok: false, status: 422, code: "ADDRESS_LOCATION_REQUIRED", error: "A valid delivery location pin is required" };
  }
  if (!routeService || typeof routeService.route !== "function") {
    return { ok: false, status: 503, code: "ROUTING_UNAVAILABLE", error: "Road distance cannot be calculated right now" };
  }
  let r;
  try {
    r = await routeService.route(pickup, drop);
  } catch (e) {
    if (e && e.message === "too_far") {
      return { ok: false, status: 422, code: "OUT_OF_RANGE", error: "Delivery address is too far" };
    }
    if (e && e.message === "invalid_coordinates") {
      return { ok: false, status: 422, code: "ADDRESS_LOCATION_REQUIRED", error: "A valid delivery location pin is required" };
    }
    return { ok: false, status: 503, code: "ROUTING_UNAVAILABLE", error: "Road distance cannot be calculated right now" };
  }
  const distanceM = Number(r && r.distance);
  if (!Number.isFinite(distanceM) || distanceM <= 0) {
    return { ok: false, status: 503, code: "ROUTING_UNAVAILABLE", error: "Road distance cannot be calculated right now" };
  }
  if (distanceM / 1000 > settings.maxKm) {
    return { ok: false, status: 422, code: "OUT_OF_RANGE", error: "Delivery address is too far" };
  }
  const { km, fee: raw } = feeFromDistance(distanceM, settings);
  const fee = money(applyFreeOver(raw, subtotal, store));
  return {
    ok: true,
    mode: "distance",
    fee,
    distanceM: Math.round(distanceM),
    km,
    snapshot: {
      mode: "distance",
      pricePerKm: settings.pricePerKm,
      baseFee: settings.baseFee,
      distanceM: Math.round(distanceM),
      km,
      feeBeforeFreeOver: raw,
      fee,
      provider: r.provider || "",
      computedAt: now.toISOString(),
    },
  };
}

module.exports = { MODES, BOUNDS, settingsFromConfig, validateUpdate, feeFromDistance, applyFreeOver, quote };

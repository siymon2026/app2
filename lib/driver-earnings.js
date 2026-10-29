"use strict";
/**
 * Driver earnings per delivery.
 *
 * mode "delivery_fee" (default, legacy): the driver earns the order's
 *   deliveryFee (read live, exactly as before; no snapshot is stored).
 * mode "formula": base + roadKm * perKm. The rates and result are SNAPSHOTTED
 *   on the order at creation (order.driverEarnings), so later setting changes
 *   never rewrite history.
 *
 * Road km comes only from the order's road-distance pricing snapshot
 * (order.deliveryPricing.km). When it is not available the distance part is
 * NOT invented: earnings = base only, and the snapshot says so
 * (distanceMissing: true).
 */
const MODES = Object.freeze(["delivery_fee", "formula"]);
const BOUNDS = Object.freeze({ base: [0, 200], perKm: [0, 50] });

const money = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const clamp = (v, [lo, hi], d) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

function settingsFromConfig(cfg = {}) {
  return {
    mode: MODES.includes(cfg.driverEarningsMode) ? cfg.driverEarningsMode : "delivery_fee",
    base: money(clamp(cfg.driverEarningBase, BOUNDS.base, 0)),
    perKm: money(clamp(cfg.driverEarningPerKm, BOUNDS.perKm, 0)),
  };
}

function validateUpdate(body = {}) {
  const values = {};
  if (body.driverEarningsMode !== undefined) {
    const m = String(body.driverEarningsMode);
    if (!MODES.includes(m)) return { ok: false, error: "driverEarningsMode must be delivery_fee or formula" };
    values.driverEarningsMode = m;
  }
  for (const [k, b] of [["driverEarningBase", BOUNDS.base], ["driverEarningPerKm", BOUNDS.perKm]]) {
    if (body[k] === undefined) continue;
    const n = Number(body[k]);
    if (body[k] === "" || !Number.isFinite(n) || n < b[0] || n > b[1]) {
      return { ok: false, error: `${k} must be between ${b[0]} and ${b[1]}` };
    }
    values[k] = money(n);
  }
  return { ok: true, values };
}

/** Snapshot to store on a new order, or null in legacy mode. */
function snapshot(order, settings, now = new Date()) {
  if (settings.mode !== "formula") return null;
  const km = Number(order && order.deliveryPricing && order.deliveryPricing.km);
  const hasKm = Number.isFinite(km) && km > 0;
  const distancePart = hasKm ? money(km * settings.perKm) : 0;
  return {
    basis: "formula",
    base: settings.base,
    perKm: settings.perKm,
    km: hasKm ? km : null,
    distanceMissing: !hasKm,
    amount: money(settings.base + distancePart),
    computedAt: now.toISOString(),
  };
}

/** What the driver earns for this order (snapshot if present, else legacy fee). */
function earningOf(order) {
  const s = order && order.driverEarnings;
  if (s && s.basis === "formula" && Number.isFinite(Number(s.amount))) return money(s.amount);
  return money(Number(order && order.deliveryFee) || 0);
}

module.exports = { MODES, BOUNDS, settingsFromConfig, validateUpdate, snapshot, earningOf };

"use strict";
/**
 * Dispatch service: wraps dispatch-core with persistence (data/dispatch.json).
 * All methods are synchronous. Like the existing order routes, atomicity relies
 * on the single-process, synchronous request model (pm2 instances: 1) plus the
 * atomic file writes of writeJson. Do NOT run in pm2 cluster mode.
 */
const driverEarnings = require("./driver-earnings");
const ACTIVE = ["accepted", "picked_up", "on_the_way"];
const RETRY_MS = 15_000;
const EXCLUDE_WINDOW_MS = 5 * 60_000;
const EVENTS_MAX = 2000;

const promoLib = require("./promo");
const LOCATION_RETENTION_MS = 60 * 60 * 1000; // last known position is kept at most 1 hour

function createDispatchService(deps) {
  const { core, grid, file, readJson, writeJson, loadOrders, saveOrders, loadDrivers,
    loadRestaurants, loadConfig, onAccepted, notifyDriver, logger } = deps;
  const clock = deps.now || (() => Date.now());

  /* ---------- settings & state ---------- */
  function settings() {
    const cfg = loadConfig() || {};
    const clamp = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
    return {
      mode: cfg.dispatchMode === "offers" ? "offers" : "pull",
      auto: cfg.dispatchAuto !== false, // default: automatic
      ttlMs: clamp(cfg.dispatchOfferTtlMs, 10_000, 120_000, core.DEFAULTS.offerTtlMs),
      rings: clamp(cfg.dispatchRings, 1, 5, 2),
      pickupFallback: cfg.pickupLocation || null,
      cfg,
    };
  }
  function loadState() {
    const s = readJson(file, null) || {};
    s.seq = s.seq || 0;
    s.offers = Array.isArray(s.offers) ? s.offers : [];
    s.events = Array.isArray(s.events) ? s.events : [];
    s.locations = s.locations && typeof s.locations === "object" ? s.locations : {};
    s.driverStates = s.driverStates && typeof s.driverStates === "object" ? s.driverStates : {};
    s.attempts = s.attempts && typeof s.attempts === "object" ? s.attempts : {};
    return s;
  }
  function saveState(s) {
    const t = clock();
    // keep the offers log bounded
    if (s.offers.length > 3000) s.offers = s.offers.filter((o) => o.status === "pending" || t - o.createdAt < 24 * 3600_000);
    if (s.events.length > EVENTS_MAX) s.events = s.events.slice(-EVENTS_MAX);
    writeJson(file, s);
  }
  function event(s, type, extra) { s.events.push({ at: clock(), type, ...extra }); }

  /* ---------- driver view ---------- */
  const activeCount = (orders, id) =>
    orders.filter((o) => String(o.driverId || "") === String(id) && ACTIVE.includes(String(o.status || ""))).length;

  function derive(d, s, orders, t) {
    const id = String(d.id);
    const stored = s.driverStates[id] || "offline";
    let st = stored;
    const act = orders.filter((o) => String(o.driverId || "") === id && ACTIVE.includes(String(o.status || "")));
    if (act.length) st = act.some((o) => ["picked_up", "on_the_way"].includes(o.status)) ? "delivering" : "assigned";
    else if (s.offers.some((o) => o.driverId === id && o.status === "pending" && o.expiresAt > t)) st = "offer_pending";
    return { id, status: d.status, dispatchState: st, location: s.locations[id] || null, load: act.length, name: d.name || "" };
  }

  /* ---------- driver-facing ---------- */
  function updateLocation(driverId, input) {
    const s = loadState(), t = clock(), id = String(driverId);
    const r = core.validateFix(input, s.locations[id], t);
    if (!r.ok) return { ok: false, status: 400, error: r.error };
    s.locations[id] = r.fix; // only the latest fix is retained (no history)
    saveState(s);
    return { ok: true, freshness: core.freshness(r.fix, t), cell: grid.cellOf(r.fix.lat, r.fix.lng) };
  }

  function setStatus(driverId, want) {
    const s = loadState(), t = clock(), id = String(driverId);
    if (!["online", "offline", "paused"].includes(want)) return { ok: false, status: 400, error: "invalid_status" };
    const orders = loadOrders().orders;
    const busy = activeCount(orders, id) > 0;
    if (want === "online") {
      const fix = s.locations[id];
      // In pull mode (current system) GPS is optional so nobody gets locked out.
      if (settings().mode !== "offers") { if (!busy) s.driverStates[id] = "available"; }
      else if (core.freshness(fix, t) !== "live") return { ok: false, status: 409, error: "location_required" };
      else if (fix.accuracy != null && fix.accuracy > core.DEFAULTS.maxAccuracyM) return { ok: false, status: 409, error: "location_inaccurate" };
      else if (!busy) s.driverStates[id] = "available";
    } else {
      if (busy && want === "offline") return { ok: false, status: 409, error: "busy_with_order" };
      s.driverStates[id] = want === "paused" ? "paused" : "offline";
      for (const o of s.offers) if (o.driverId === id && o.status === "pending") { o.status = "cancelled"; o.version++; }
    }
    event(s, "driver_status", { driverId: id, detail: want });
    saveState(s);
    return { ok: true, dispatchState: derive({ id, status: "approved" }, s, orders, t).dispatchState };
  }

  function driverOffers(driverId) {
    const s = loadState(), t = clock(), id = String(driverId);
    const orders = loadOrders().orders;
    const st = settings();
    return s.offers.filter((o) => o.driverId === id && o.status === "pending" && o.expiresAt > t).map((o) => {
      const order = orders.find((x) => x.id === o.orderId) || {};
      const pickup = pickupOf(order, st);
      const loc = s.locations[id];
      return {
        id: o.id, orderId: o.orderId, expiresAt: o.expiresAt, serverNow: t, version: o.version,
        // privacy: no customer name/phone/address before acceptance
        deliveryFee: Number(order.deliveryFee || 0), driverEarning: driverEarnings.earningOf(order), total: Number(order.total || 0),
        pickup: pickup ? { lat: pickup.lat, lng: pickup.lng, name: pickup.name || "" } : null,
        pickupDistM: pickup && loc ? Math.round(core.haversineM(loc, pickup)) : null,
        etaSource: "straight_line_unavailable",
      };
    });
  }

  /* ---------- wallet gate (mirrors the existing /accept route) ---------- */
  function walletGate(order, driverId, orders, cfg) {
    if (cfg.driverWalletEnabled === false) return null;
    const d = (loadDrivers().drivers || []).find((x) => String(x.id) === String(driverId));
    if (!d) return null;
    const mode = String(cfg.driverWalletChargeMode || "subtotal").toLowerCase();
    const chargeOf = (o) => !o ? 0 : mode === "commission" ? Number(cfg.driverCommissionPerOrder || 0)
      : mode === "total" ? Number(o.total || 0) : promoLib.goodsDue(o);
    const required = Math.max(0, chargeOf(order) || 0);
    if (!(required > 0)) return null;
    const reserved = orders
      .filter((o) => String(o.driverId || "") === String(driverId) && String(o.id) !== String(order.id))
      .filter((o) => !["delivered", "done", "canceled"].includes(String(o.status || "").toLowerCase()) && !(o.walletChargedAt || o.commissionChargedAt))
      .reduce((a, o) => a + Math.max(0, chargeOf(o) || 0), 0);
    const balance = Number(d.walletBalance || 0);
    if (required > balance - reserved + 1e-9) {
      return { status: 402, error: "Insufficient wallet balance", walletBalance: balance, walletReserved: reserved, walletAvailable: balance - reserved, required, mode };
    }
    return null;
  }

  function acceptOffer(driverId, offerId) {
    const s = loadState(), t = clock(), st = settings();
    const offer = s.offers.find((x) => x.id === offerId);
    if (!offer) return { ok: false, status: 404, error: "offer_not_found" };
    const ordersData = loadOrders();
    const order = ordersData.orders.find((o) => o.id === offer.orderId);
    if (!order) return { ok: false, status: 404, error: "order_not_found" };
    if (offer.driverId === String(driverId) && offer.status === "pending" && offer.expiresAt > t) {
      const gate = walletGate(order, driverId, ordersData.orders, st.cfg);
      if (gate) return { ok: false, ...gate };
    }
    const prev = String(order.status || "new");
    const r = core.acceptOffer(s, order, { offerId, driverId, now: t });
    if (!r.ok) { saveState(s); return r; }
    if (!r.duplicate) {
      order.acceptedAt = order.acceptedAt || new Date(t).toISOString();
      order.updatedAt = new Date(t).toISOString();
      saveOrders(ordersData); // order first, then offer bookkeeping
      for (const o of s.offers) if (o.orderId === order.id && o.id !== offerId && o.status === "pending") { o.status = "superseded"; o.version++; }
      delete s.attempts[order.id];
      event(s, "offer_accepted", { orderId: order.id, driverId: String(driverId), offerId });
      saveState(s);
      try { onAccepted && onAccepted(order, prev); } catch (_e) {}
    }
    return { ok: true, order };
  }

  function rejectOffer(driverId, offerId) {
    const s = loadState(), t = clock();
    const r = core.rejectOffer(s, { offerId, driverId, now: t });
    if (!r.ok) return r;
    if (!r.duplicate) {
      event(s, "offer_rejected", { orderId: r.offer.orderId, driverId: String(driverId), offerId });
      saveState(s);
      if (settings().auto) dispatchOrder(r.offer.orderId, { actor: "system" });
    }
    return { ok: true };
  }

  /* ---------- dispatching ---------- */
  function pickupOf(order, st) {
    try {
      const r = (loadRestaurants().restaurants || []).find((x) => String(x.id) === String(order.restaurantId));
      if (r && core.validCoords(Number(r.lat), Number(r.lng))) return { lat: Number(r.lat), lng: Number(r.lng), name: r.name || "" };
    } catch (_e) {}
    const f = st.pickupFallback;
    if (f && core.validCoords(Number(f.lat), Number(f.lng))) return { lat: Number(f.lat), lng: Number(f.lng), name: f.name || "" };
    return null;
  }

  function dispatchOrder(orderId, { driverId: manualId, actor = "system" } = {}) {
    const st = settings();
    if (st.mode !== "offers") return { ok: false, error: "mode_pull" };
    const s = loadState(), t = clock();
    const orders = loadOrders().orders;
    const order = orders.find((o) => o.id === String(orderId));
    if (!order) return { ok: false, status: 404, error: "order_not_found" };
    if (String(order.status || "") !== "restaurant_ready" || order.driverId) return { ok: false, status: 409, error: "order_not_dispatchable" };
    if (core.expireOffers(s, t).length) saveState(s);
    const att = s.attempts[order.id] = s.attempts[order.id] || { count: 0 };
    att.at = t;

    let target = null, reason = "auto";
    if (manualId) {
      const d = (loadDrivers().drivers || []).find((x) => String(x.id) === String(manualId));
      if (!d || d.status !== "approved") return { ok: false, status: 400, error: "driver_not_approved" };
      if (activeCount(orders, manualId) > 0) return { ok: false, status: 409, error: "driver_busy" };
      target = { driverId: String(manualId) }; reason = "manual:" + actor;
    } else {
      const pickup = pickupOf(order, st);
      if (!pickup) { att.exhausted = "no_pickup_location"; saveState(s); return { ok: false, error: "no_pickup_location" }; }
      const drivers = (loadDrivers().drivers || []).map((d) => derive(d, s, orders, t));
      const excl = s.offers.filter((o) => o.orderId === order.id && t - o.createdAt < EXCLUDE_WINDOW_MS && ["rejected", "expired"].includes(o.status)).map((o) => o.driverId);
      const ranked = core.rankCandidates({
        drivers, pickup, now: t, excludeIds: excl, loadOf: (d) => d.load,
        cellOf: grid.cellOf, ringOf: (c) => grid.ringOf(c, st.rings),
      });
      if (!ranked.length) { att.exhausted = "no_candidates"; saveState(s); return { ok: false, error: "no_candidates" }; }
      target = ranked[0];
    }
    delete att.exhausted;
    att.count++;
    const r = core.createOffer(s, { orderId: order.id, driverId: target.driverId, now: t, ttlMs: st.ttlMs, idemKey: `${order.id}#${att.count}`, reason });
    if (!r.ok) { saveState(s); return r; }
    event(s, "offer_created", { orderId: order.id, driverId: target.driverId, offerId: r.offer.id, detail: reason });
    saveState(s);
    try { notifyDriver && notifyDriver(target.driverId, r.offer); } catch (_e) {}
    return { ok: true, offer: r.offer, candidate: target };
  }

  /** Called every few seconds: expire offers, re-offer, reconcile. */
  function tick() {
    const st = settings();
    const s = loadState(), t = clock();
    const orders = loadOrders().orders;
    let dirty = false;
    // Privacy: a position nobody can use any more (older than the retention window) is erased.
    for (const id of Object.keys(s.locations)) {
      const fix = s.locations[id];
      if (!fix || !Number.isFinite(Number(fix.at)) || t - Number(fix.at) > LOCATION_RETENTION_MS) {
        delete s.locations[id];
        dirty = true;
      }
    }
    for (const o of core.expireOffers(s, t)) { event(s, "offer_expired", { orderId: o.orderId, driverId: o.driverId, offerId: o.id }); dirty = true; }
    for (const o of s.offers) { // reconcile offers whose order is already assigned/closed
      if (o.status !== "pending") continue;
      const ord = orders.find((x) => x.id === o.orderId);
      if (!ord || ord.driverId || String(ord.status) !== "restaurant_ready") { o.status = "superseded"; o.version++; dirty = true; }
    }
    if (dirty) saveState(s);
    if (st.mode !== "offers" || !st.auto) return;
    for (const order of orders) {
      if (String(order.status || "") !== "restaurant_ready" || order.driverId) continue;
      if (s.offers.some((o) => o.orderId === order.id && o.status === "pending" && o.expiresAt > t)) continue;
      const att = s.attempts[order.id];
      if (att && att.exhausted && t - att.at < RETRY_MS) continue;
      dispatchOrder(order.id, { actor: "system" });
    }
  }

  /* ---------- admin ---------- */
  function resetOrder(orderId, actor) {
    const s = loadState();
    let n = 0;
    for (const o of s.offers) if (o.orderId === String(orderId) && o.status === "pending") { o.status = "cancelled"; o.version++; n++; }
    delete s.attempts[String(orderId)];
    event(s, "order_reset", { orderId: String(orderId), detail: actor });
    saveState(s);
    return { ok: true, cancelled: n };
  }

  function adminState() {
    const st = settings(), s = loadState(), t = clock();
    const orders = loadOrders().orders;
    const drivers = (loadDrivers().drivers || []).filter((d) => d.status === "approved").map((d) => {
      const v = derive(d, s, orders, t);
      const fresh = core.freshness(v.location, t);
      return { id: v.id, name: v.name, dispatchState: v.dispatchState, freshness: fresh, load: v.load,
        location: v.location && fresh !== "lost" ? { lat: v.location.lat, lng: v.location.lng, accuracy: v.location.accuracy, ageMs: t - v.location.at } : null,
        cell: v.location && fresh !== "lost" ? grid.cellOf(v.location.lat, v.location.lng) : null };
    });
    const cells = {};
    for (const d of drivers) if (d.cell && d.dispatchState !== "offline") {
      const c = cells[d.cell] = cells[d.cell] || { cell: d.cell, boundary: grid.boundary(d.cell), drivers: 0, available: 0 };
      c.drivers++; if (d.dispatchState === "available") c.available++;
    }
    const pending = orders.filter((o) => String(o.status || "") === "restaurant_ready" && !o.driverId).map((o) => ({
      id: o.id, createdAt: o.createdAt, readyAt: o.restaurantReadyAt || null,
      customerLat: o.customer && o.customer.lat, customerLng: o.customer && o.customer.lng,
      offer: s.offers.find((x) => x.orderId === o.id && x.status === "pending" && x.expiresAt > t) || null,
      exhausted: (s.attempts[o.id] || {}).exhausted || null,
    }));
    const counts = {}; drivers.forEach((d) => { counts[d.dispatchState] = (counts[d.dispatchState] || 0) + 1; });
    let restWithCoords = 0;
    try { restWithCoords = (loadRestaurants().restaurants || []).filter((r) => core.validCoords(Number(r.lat), Number(r.lng))).length; } catch (_e) {}
    const pk = st.pickupFallback && core.validCoords(Number(st.pickupFallback.lat), Number(st.pickupFallback.lng)) ? st.pickupFallback : null;
    return { ok: true, serverNow: t, mode: st.mode, auto: st.auto, ttlMs: st.ttlMs, gridEngine: grid.engine,
      pickup: pk ? { lat: Number(pk.lat), lng: Number(pk.lng), name: pk.name || "" } : null,
      pickupOk: !!pk || restWithCoords > 0,
      counts, drivers, cells: Object.values(cells), pending, events: s.events.slice(-100).reverse() };
  }

  /** Validates and returns the config patch for admin-editable dispatch settings. */
  function settingsPatch(input) {
    const b = input || {}, patch = {};
    if (b.mode !== undefined) {
      if (!["pull", "offers"].includes(b.mode)) return { ok: false, status: 400, error: "invalid_mode" };
      patch.dispatchMode = b.mode;
    }
    if (b.auto !== undefined) patch.dispatchAuto = b.auto === true;
    if (b.ttlSec !== undefined) {
      const n = Number(b.ttlSec);
      if (!Number.isFinite(n) || n < 10 || n > 120) return { ok: false, status: 400, error: "invalid_ttl" };
      patch.dispatchOfferTtlMs = Math.round(n * 1000);
    }
    if (b.pickup !== undefined) {
      if (b.pickup === null) patch.pickupLocation = null;
      else {
        const lat = Number(b.pickup.lat), lng = Number(b.pickup.lng);
        if (!core.validCoords(lat, lng)) return { ok: false, status: 400, error: "invalid_pickup" };
        patch.pickupLocation = { lat, lng, name: String(b.pickup.name || "").slice(0, 80) };
      }
    }
    return { ok: true, patch };
  }

  /** Latest stored fix for one driver (or null). Callers must authorize first. */
  function driverFix(driverId) { return loadState().locations[String(driverId)] || null; }

  return { driverFix, settingsPatch, settings, updateLocation, setStatus, driverOffers, acceptOffer, rejectOffer, dispatchOrder, tick, resetOrder, adminState, _loadState: loadState };
}

module.exports = { createDispatchService };

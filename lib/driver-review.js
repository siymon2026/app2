"use strict";
/**
 * Driver review workflow (pending -> approved / rejected -> suspended ...).
 *
 * - Uploading documents never verifies a driver: only an explicit review
 *   decision does, and every decision records reviewer, time and reason in
 *   driver.review and the bounded driver.reviewHistory.
 * - Rejecting or suspending REQUIRES a reason.
 * - Approving requires the identity documents to exist; a missing driving
 *   licence / vehicle record is reported as a warning (older drivers signed up
 *   before those fields existed).
 * - Suspending / rejecting an approved driver safely releases orders that were
 *   accepted but not yet picked up, and flags orders already in the driver's
 *   hands so a supervisor can handle them (the driver may still finish).
 */

const STATUSES = Object.freeze(["pending", "approved", "rejected", "suspended"]);
const TRANSITIONS = Object.freeze({
  pending: ["approved", "rejected"],
  approved: ["suspended", "rejected"],
  suspended: ["approved", "rejected"],
  rejected: ["pending", "approved"],
});
const NEEDS_REASON = Object.freeze(["rejected", "suspended"]);
const REQUIRED_DOCS = Object.freeze(["idFront", "idBack", "faceWithBikeCard"]);
const MAX_HISTORY = 50;
const VEHICLE_TYPES = Object.freeze(["motorcycle", "scooter", "bicycle", "car"]);

const statusOf = (d) => (STATUSES.includes(d && d.status) ? d.status : "pending");

function missingFor(driver) {
  const missing = [];
  const imgs = (driver && driver.images) || {};
  for (const k of REQUIRED_DOCS) if (!imgs[k]) missing.push(k);
  return missing;
}

function warningsFor(driver) {
  const w = [];
  if (!(driver && driver.images && driver.images.license)) w.push("license_missing");
  if (!(driver && driver.vehicle && driver.vehicle.type)) w.push("vehicle_missing");
  return w;
}

/**
 * @returns {{ok:true,from:string,to:string,warnings:string[],leftApproved:boolean}
 *          |{ok:false,status:number,code:string,error:string,missing?:string[]}}
 */
function applyReview(driver, { to, by, reason, now = new Date() }) {
  const from = statusOf(driver);
  const target = String(to || "").toLowerCase();
  if (!STATUSES.includes(target)) return { ok: false, status: 400, code: "INVALID_STATUS", error: "Invalid status" };
  if (target === from) return { ok: false, status: 409, code: "NO_CHANGE", error: `Driver is already ${from}` };
  if (!TRANSITIONS[from].includes(target)) {
    return { ok: false, status: 409, code: "ILLEGAL_TRANSITION", error: `Illegal status change: ${from} -> ${target}` };
  }
  const why = String(reason || "").trim().slice(0, 300);
  if (NEEDS_REASON.includes(target) && why.length < 3) {
    return { ok: false, status: 400, code: "REASON_REQUIRED", error: "A reason is required" };
  }
  if (target === "approved") {
    const missing = missingFor(driver);
    if (missing.length) {
      return { ok: false, status: 409, code: "MISSING_DOCUMENTS", error: "Identity documents are missing", missing };
    }
  }
  const at = now.toISOString();
  driver.status = target;
  driver.updatedAt = at;
  driver.review = { status: target, by: String(by || ""), at, reason: why };
  if (!Array.isArray(driver.reviewHistory)) driver.reviewHistory = [];
  driver.reviewHistory.push({ from, to: target, by: String(by || ""), at, reason: why });
  if (driver.reviewHistory.length > MAX_HISTORY) driver.reviewHistory.splice(0, driver.reviewHistory.length - MAX_HISTORY);
  // legacy fields kept in sync for existing screens
  driver.approvedAt = target === "approved" ? at : driver.approvedAt && target !== "rejected" ? driver.approvedAt : null;
  driver.rejectedAt = target === "rejected" ? at : null;
  driver.suspendedAt = target === "suspended" ? at : null;
  return {
    ok: true,
    from,
    to: target,
    warnings: target === "approved" ? warningsFor(driver) : [],
    leftApproved: from === "approved" && target !== "approved",
  };
}

const ACTIVE = ["accepted", "picked_up", "on_the_way"];

/**
 * Orders of a driver who just lost approval.
 *  - accepted (not collected yet): released back to the pool ("restaurant_ready").
 *  - picked_up / on_the_way: kept, flagged for the supervisor.
 * Mutates the orders; returns what happened so the caller can persist/notify.
 */
function handleSuspension(orders, driverId, { by, now = new Date() } = {}) {
  const released = [];
  const keptActive = [];
  const at = now.toISOString();
  for (const o of orders || []) {
    if (String(o.driverId || "") !== String(driverId) || !ACTIVE.includes(String(o.status))) continue;
    if (o.status === "accepted") {
      if (!Array.isArray(o.events)) o.events = [];
      o.events.push({ at, from: "accepted", to: "restaurant_ready", actorType: "admin", actorId: String(by || "") });
      o.status = "restaurant_ready";
      o.driverId = null;
      o.acceptedAt = null;
      o.supervisorAlert = { type: "driver_suspended_released", at, driverId: String(driverId) };
      o.updatedAt = at;
      released.push(String(o.id));
    } else {
      o.supervisorAlert = { type: "driver_suspended_in_delivery", at, driverId: String(driverId) };
      o.updatedAt = at;
      keptActive.push(String(o.id));
    }
  }
  return { released, keptActive };
}

/** May this (non-approved) driver still finish an order already in their hands? */
function mayFinishDelivery(driver, order) {
  if (!driver || !order) return false;
  if (statusOf(driver) !== "suspended") return false;
  return String(order.driverId || "") === String(driver.id) && ["picked_up", "on_the_way"].includes(String(order.status));
}

module.exports = {
  STATUSES, TRANSITIONS, REQUIRED_DOCS, VEHICLE_TYPES,
  statusOf, missingFor, warningsFor, applyReview, handleSuspension, mayFinishDelivery,
};

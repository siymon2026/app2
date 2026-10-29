"use strict";
/**
 * Section 20 — server-side rules for updates that a client queued while offline.
 * Pure functions (no I/O) so they can be tested without express.
 *
 * The server never trusts the client's claim that something is "queued": it re-validates everything.
 *  - A queued update may never carry a verification step (pickup / delivery): those need the live code check
 *    or a separately authorized supervisor exception.
 *  - A queued update older than QUEUED_MAX_AGE_MS is refused (the situation may have changed).
 *  - Replayed chat messages are de-duplicated by the client's idempotency key.
 */

const QUEUED_MAX_AGE_MS = 30 * 60 * 1000;
// Statuses that need code verification (see lib/verify-codes.js): never accepted from a queue.
const VERIFIED_STATUSES = Object.freeze(["picked_up", "delivered"]);
// Statuses a driver may replay from a queue.
const QUEUEABLE_STATUSES = Object.freeze(["on_the_way"]);

function cleanKey(v) {
  const s = String(v == null ? "" : v).trim();
  return /^[A-Za-z0-9_-]{8,64}$/.test(s) ? s : "";
}

/**
 * @param body   request body of PATCH /api/driver/orders/:id
 * @param now    ms
 * @returns {{ok:true,queued:boolean}|{ok:false,status:number,code:string,error:string}}
 */
function checkQueuedStatusUpdate(body, now) {
  const b = body || {};
  if (!b.queued) return { ok: true, queued: false };
  const st = String(b.status || "");
  if (VERIFIED_STATUSES.includes(st) || b.code != null) {
    return { ok: false, status: 400, code: "NOT_QUEUEABLE", error: "This step needs live verification and cannot be sent from the offline queue" };
  }
  if (!QUEUEABLE_STATUSES.includes(st)) {
    return { ok: false, status: 400, code: "NOT_QUEUEABLE", error: "This update cannot be sent from the offline queue" };
  }
  const at = Number(b.queuedAt);
  if (!Number.isFinite(at) || at <= 0) {
    return { ok: false, status: 400, code: "QUEUED_AT_REQUIRED", error: "queuedAt is required for queued updates" };
  }
  // queuedAt is the CLIENT clock, so only its age relative to the client's own send time is meaningful.
  const sentAt = Number(b.sentAt);
  const age = Number.isFinite(sentAt) ? sentAt - at : now - at;
  if (age < -60_000) return { ok: false, status: 400, code: "QUEUED_AT_INVALID", error: "Invalid queuedAt" };
  if (age > QUEUED_MAX_AGE_MS) {
    return { ok: false, status: 409, code: "QUEUED_UPDATE_EXPIRED", error: "Queued update is too old; please review the order and redo it" };
  }
  return { ok: true, queued: true };
}

/** Returns the already-stored message when this idempotency key was seen, else null. */
function findDuplicateMessage(messages, clientId) {
  const k = cleanKey(clientId);
  if (!k || !Array.isArray(messages)) return null;
  return messages.find((m) => m && m.clientId === k) || null;
}

/**
 * Re-accepting an order you already own must be a no-op: it may never move the order back to "accepted".
 * @returns {boolean} true when the accept is a harmless repeat
 */
const PAST_ACCEPT = Object.freeze(["accepted", "picked_up", "on_the_way", "delivered", "done"]);
function isRepeatAccept(order, driverId) {
  if (!order || !order.driverId) return false;
  if (String(order.driverId) !== String(driverId)) return false;
  // An order assigned to this driver but still waiting for their first accept (status restaurant_ready) is NOT a repeat.
  return PAST_ACCEPT.includes(String(order.status || "").toLowerCase());
}

module.exports = {
  QUEUED_MAX_AGE_MS, VERIFIED_STATUSES, QUEUEABLE_STATUSES,
  cleanKey, checkQueuedStatusUpdate, findDuplicateMessage, isRepeatAccept,
};

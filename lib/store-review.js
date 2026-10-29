"use strict";
/**
 * Store onboarding / review workflow (pending -> approved / rejected -> suspended ...).
 *
 * - A store is only orderable/visible when its review status is "approved".
 *   Stores created before this workflow existed (no `review` field) are
 *   treated as approved so nothing live breaks.
 * - Every decision records reviewer, time and reason (store.review plus the
 *   bounded store.reviewHistory). Rejecting / suspending REQUIRES a reason.
 * - Leaving "approved" unpublishes the store (catalog status "unpublished",
 *   isActive=false => no new orders, no public listing, no store login).
 *   The catalog status it had is remembered and restored on re-approval.
 * - Orders: those the store never touched (admin_accepted, no storeAcceptedAt)
 *   are cancelled by the platform (stock restored by the caller); orders the
 *   store already started are NOT cancelled - they are flagged for a supervisor.
 */

const STATUSES = Object.freeze(["pending", "approved", "rejected", "suspended"]);
const TRANSITIONS = Object.freeze({
  pending: ["approved", "rejected"],
  approved: ["suspended"],
  suspended: ["approved", "rejected"],
  rejected: ["pending", "approved"],
});
const NEEDS_REASON = Object.freeze(["rejected", "suspended"]);
const MAX_HISTORY = 50;
const OPEN = ["new", "admin_accepted", "restaurant_ready", "accepted", "picked_up", "on_the_way"];

const statusOf = (s) => {
  const v = s && s.review && s.review.status;
  return STATUSES.includes(v) ? v : "approved";
};

/** Fields required before a store may go live. */
function missingFor(store) {
  const m = [];
  const name = store && store.name;
  const hasName = typeof name === "string" ? name.trim() : name && (name.ar || name.en || name.fr);
  if (!hasName) m.push("name");
  if (!String((store && store.phone) || "").trim()) m.push("phone");
  if (!String((store && store.address) || "").trim()) m.push("address");
  return m;
}

/** Start a brand-new store in the review queue (unpublished until approved). */
function initPending(store, { by, now = new Date() } = {}) {
  const at = now.toISOString();
  store.statusBeforeReview = store.status && store.status !== "unpublished" ? store.status : "active";
  store.status = "unpublished";
  store.isActive = false;
  store.review = { status: "pending", by: String(by || ""), at, reason: "" };
  store.reviewHistory = [{ from: null, to: "pending", by: String(by || ""), at, reason: "" }];
  return store;
}

function applyReview(store, { to, by, reason, now = new Date() }) {
  const from = statusOf(store);
  const target = String(to || "").toLowerCase();
  if (!STATUSES.includes(target)) return { ok: false, status: 400, code: "INVALID_STATUS", error: "Invalid status" };
  if (target === from) return { ok: false, status: 409, code: "NO_CHANGE", error: `Store is already ${from}` };
  if (!TRANSITIONS[from].includes(target)) {
    return { ok: false, status: 409, code: "ILLEGAL_TRANSITION", error: `Illegal status change: ${from} -> ${target}` };
  }
  const why = String(reason || "").trim().slice(0, 300);
  if (NEEDS_REASON.includes(target) && why.length < 3) {
    return { ok: false, status: 400, code: "REASON_REQUIRED", error: "A reason is required" };
  }
  if (target === "approved") {
    const missing = missingFor(store);
    if (missing.length) {
      return { ok: false, status: 409, code: "MISSING_INFO", error: "Store information is incomplete", missing };
    }
  }
  const at = now.toISOString();
  if (from === "approved") {
    // remember what to restore (active / paused ...) then unpublish
    const cur = String(store.status || "active");
    store.statusBeforeReview = cur === "unpublished" || cur === "archived" ? "active" : cur;
  }
  if (target === "approved") {
    store.status = store.statusBeforeReview || "active";
    store.isActive = store.status === "active" || store.status === "paused";
  } else {
    store.status = "unpublished";
    store.isActive = false;
  }
  store.review = { status: target, by: String(by || ""), at, reason: why };
  if (!Array.isArray(store.reviewHistory)) store.reviewHistory = [];
  store.reviewHistory.push({ from, to: target, by: String(by || ""), at, reason: why });
  if (store.reviewHistory.length > MAX_HISTORY) store.reviewHistory.splice(0, store.reviewHistory.length - MAX_HISTORY);
  store.updatedAt = at;
  return { ok: true, from, to: target, leftApproved: from === "approved" && target !== "approved" };
}

/**
 * Orders of a store that just lost approval. Mutates the orders.
 *  - cancelled: store never touched them (admin_accepted, no storeAcceptedAt).
 *  - flagged: already started by the store / dispatched; supervisor must act.
 */
function handleSuspension(orders, storeId, { by, reason, now = new Date() } = {}) {
  const cancelled = [];
  const flagged = [];
  const at = now.toISOString();
  for (const o of orders || []) {
    if (String(o.restaurantId || "") !== String(storeId)) continue;
    const st = String(o.status || "new");
    if (!OPEN.includes(st)) continue;
    if (st === "new" || (st === "admin_accepted" && !o.storeAcceptedAt)) {
      if (!Array.isArray(o.events)) o.events = [];
      o.events.push({ at, from: st, to: "canceled", actorType: "admin", actorId: String(by || "") });
      o.status = "canceled";
      o.canceledBy = "admin";
      o.canceledAt = at;
      o.cancelReason = `store_unavailable: ${String(reason || "").slice(0, 200)}`;
      o.updatedAt = at;
      cancelled.push(String(o.id));
    } else {
      o.supervisorAlert = { type: "store_suspended_in_progress", at, storeId: String(storeId) };
      o.updatedAt = at;
      flagged.push(String(o.id));
    }
  }
  return { cancelled, flagged };
}

module.exports = { STATUSES, TRANSITIONS, statusOf, missingFor, initPending, applyReview, handleSuspension };

"use strict";
/**
 * Authoritative order state machine for DRIVER-initiated transitions.
 *
 * The full order flow in this codebase is:
 *   new -> admin_accepted -> restaurant_ready -> accepted -> picked_up
 *       -> on_the_way -> delivered -> done
 * with "canceled" as an exceptional exit. Earlier steps are driven by the
 * admin / restaurant / accept endpoints; this table guards the steps a driver
 * can request through PATCH /api/driver/orders/:id so the client can never
 * skip a step, rewind a finished order, or re-complete it.
 */

const MAX_EVENTS = 200;

// from -> allowed next statuses (driver-initiated)
const DRIVER_TRANSITIONS = Object.freeze({
  accepted: ["picked_up", "canceled"],
  picked_up: ["on_the_way", "canceled"],
  on_the_way: ["delivered", "canceled"],
  delivered: ["done"],
});

// Supervisor-initiated transitions (PATCH /api/orders/:id). "restaurant_ready"
// is deliberately absent: only the store may release an order to drivers.
const ADMIN_TRANSITIONS = Object.freeze({
  new: ["admin_accepted", "canceled"],
  admin_accepted: ["canceled"],
  restaurant_ready: ["canceled"],
  accepted: ["picked_up", "canceled"],
  picked_up: ["on_the_way", "canceled"],
  on_the_way: ["delivered", "canceled"],
  delivered: ["done"],
});

const TERMINAL = Object.freeze(["done", "canceled", "cancelled"]);

/**
 * @returns {{ok:true, noop:boolean} | {ok:false, code:string, error:string}}
 */
function checkDriverTransition(from, to) {
  const f = String(from || "");
  const t = String(to || "");
  if (f === t) return { ok: true, noop: true }; // idempotent retry
  if (TERMINAL.includes(f)) {
    return { ok: false, code: "ORDER_CLOSED", error: "Order is already closed" };
  }
  const allowed = DRIVER_TRANSITIONS[f];
  if (!allowed || !allowed.includes(t)) {
    return {
      ok: false,
      code: "ILLEGAL_TRANSITION",
      error: `Illegal status change: ${f || "unknown"} -> ${t}`,
    };
  }
  return { ok: true, noop: false };
}

function checkAdminTransition(from, to) {
  const f = String(from || "new");
  const t = String(to || "");
  if (f === t) return { ok: true, noop: true };
  if (TERMINAL.includes(f)) {
    return { ok: false, code: "ORDER_CLOSED", error: "Order is already closed" };
  }
  const allowed = ADMIN_TRANSITIONS[f];
  if (!allowed || !allowed.includes(t)) {
    return { ok: false, code: "ILLEGAL_TRANSITION", error: `Illegal status change: ${f} -> ${t}` };
  }
  return { ok: true, noop: false };
}

/**
 * Customers may cancel only before the store accepts the order:
 * status "new", or "admin_accepted" while the store has not accepted yet.
 */
function canCustomerCancel(order) {
  const st = String(order?.status || "new").toLowerCase();
  if (st === "new") return { ok: true };
  if (st === "admin_accepted" && !order.storeAcceptedAt) return { ok: true };
  if (TERMINAL.includes(st) || st === "delivered") {
    return { ok: false, code: "ORDER_CLOSED", error: "Order cannot be canceled" };
  }
  return { ok: false, code: "CANCEL_NOT_ALLOWED", error: "Order can no longer be canceled by the customer" };
}

/** Append a bounded, auditable entry to order.events (no secrets). */
function recordEvent(order, { from, to, actorType, actorId, at }) {
  if (!Array.isArray(order.events)) order.events = [];
  order.events.push({
    at: at || new Date().toISOString(),
    from: String(from || ""),
    to: String(to || ""),
    actorType: String(actorType || ""),
    actorId: String(actorId || ""),
  });
  if (order.events.length > MAX_EVENTS) {
    order.events.splice(0, order.events.length - MAX_EVENTS);
  }
  return order.events;
}

module.exports = {
  DRIVER_TRANSITIONS, ADMIN_TRANSITIONS, TERMINAL,
  checkDriverTransition, checkAdminTransition, canCustomerCancel, recordEvent,
};

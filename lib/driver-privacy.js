"use strict";
/**
 * What a driver may see of the customer's personal data (pure, no I/O).
 *
 * - Before the driver has accepted the order (pull-mode "available" list) the
 *   customer's name, phone, address, notes and coordinates are withheld, the same
 *   rule the offers flow already follows. Only the road distance is shown.
 * - After a delivery has been finished for RETENTION_MS the driver no longer
 *   sees the customer's phone, address, notes and coordinates (name stays, the
 *   history list uses it; earnings and totals are untouched).
 * Never mutates its input.
 */

const RETENTION_MS = 24 * 3600e3;
const FINISHED = ["delivered", "done"];

function withheldCustomer(order) {
  const { customer, ...rest } = order || {};
  const km = Number(order && order.deliveryPricing && order.deliveryPricing.km);
  return { ...rest, customer: { withheld: true }, dropoffKm: Number.isFinite(km) && km > 0 ? km : null };
}

function forAvailable(order) {
  return withheldCustomer(order);
}

function forMine(order, now = Date.now()) {
  if (!order || !FINISHED.includes(String(order.status || ""))) return order;
  const at = Date.parse(order.deliveredAt || order.updatedAt || "");
  if (!Number.isFinite(at) || now - at < RETENTION_MS) return order;
  const c = order.customer || {};
  return { ...order, customer: { name: c.name || "", withheld: true } };
}

module.exports = { RETENTION_MS, forAvailable, forMine };

"use strict";
/**
 * notifications-core.js
 * Pure helpers for the admin notification editor (no I/O, no dependencies).
 * Used by server.js and covered by tests/notifications-core.test.js.
 */

const LIMITS = Object.freeze({
  TITLE_MAX: 120,
  // Web Push payloads are limited to ~4 KB after encryption. Arabic text is
  // 2 bytes/char in UTF-8, so 1000 chars (~2 KB) leaves room for the rest.
  MESSAGE_MAX: 1000,
  URL_MAX: 500,
  // Hard ceiling for the JSON payload we hand to web-push (bytes).
  PAYLOAD_MAX_BYTES: 3800,
});

const AUDIENCES = Object.freeze(["all", "ordered", "no_orders"]);

/**
 * Accept only same-site relative paths ("/offers/x") or https URLs.
 * Returns { ok, value, error }. Empty input is valid (value = null).
 */
function sanitizeNotifUrl(raw) {
  const s = String(raw == null ? "" : raw).trim();
  if (!s) return { ok: true, value: null };
  if (s.length > LIMITS.URL_MAX) return { ok: false, error: "url_too_long" };
  if (/[\u0000-\u001f\u007f\s<>"'`\\]/.test(s))
    return { ok: false, error: "url_invalid" };
  // relative path (but not protocol-relative "//host")
  if (s.startsWith("/") && !s.startsWith("//")) return { ok: true, value: s };
  try {
    const u = new URL(s);
    if (u.protocol === "https:") return { ok: true, value: u.toString() };
  } catch (_e) {}
  return { ok: false, error: "url_invalid" };
}

function isValidAudience(a) {
  return AUDIENCES.includes(String(a));
}

function payloadBytes(obj) {
  return Buffer.byteLength(JSON.stringify(obj || {}), "utf8");
}

/** Build the exact payload that is pushed to devices. */
function buildPushPayload(rec) {
  return {
    id: String(rec?.id || ""),
    title: String(rec?.title || "siymon"),
    body: String(rec?.message || ""),
    image: rec?.imageUrl ? String(rec.imageUrl) : null,
    url: String(rec?.url || "/orders/?open=notifications"),
    createdAt: String(rec?.createdAt || new Date().toISOString()),
  };
}

/**
 * Resolve the audience from REAL data only.
 *  - all:        every registered customer
 *  - ordered:    customers with at least one order
 *  - no_orders:  customers without any order
 * Push reach = customers that have >= 1 valid Web Push subscription
 * (the browser permission prompt is the customer's opt-in).
 */
function computeAudience({ customers, orders, subscriptions, audience }) {
  const aud = isValidAudience(audience) ? String(audience) : "all";
  const custs = Array.isArray(customers) ? customers : [];
  const ords = Array.isArray(orders) ? orders : [];
  const subs = Array.isArray(subscriptions) ? subscriptions : [];

  const orderedIds = new Set();
  for (const o of ords) {
    const id = String(o?.customerId || "").trim();
    if (id) orderedIds.add(id);
  }

  const targeted = [];
  for (const c of custs) {
    const id = String(c?.id || "").trim();
    if (!id) continue;
    if (aud === "all") targeted.push(id);
    else if (aud === "ordered" && orderedIds.has(id)) targeted.push(id);
    else if (aud === "no_orders" && !orderedIds.has(id)) targeted.push(id);
  }
  const targetSet = new Set(targeted);

  const reachable = new Set();
  let devices = 0;
  for (const r of subs) {
    const cid = String(r?.customerId || "").trim();
    const sub = r?.subscription || r;
    const valid = !!(
      sub &&
      sub.endpoint &&
      sub.keys &&
      sub.keys.p256dh &&
      sub.keys.auth
    );
    if (!valid || !cid) continue;
    if (targetSet.has(cid)) {
      reachable.add(cid);
      devices += 1;
    }
  }

  return {
    audience: aud,
    totalCustomers: custs.length,
    targetedCustomers: targeted.length,
    targetedIds: targeted,
    pushCustomers: reachable.size,
    pushDevices: devices,
  };
}

/** Keep only subscriptions that belong to the given customer-id Set. */
function selectSubscriptions(subs, customerIdSet) {
  const list = Array.isArray(subs) ? subs : [];
  if (!customerIdSet) return list;
  return list.filter((r) => customerIdSet.has(String(r?.customerId || "")));
}

/** Should this notification record appear in a customer's inbox? */
function visibleToCustomer(n, customerId) {
  if (!n) return false;
  const status = String(n.status || "sent");
  if (status === "draft") return false;
  const cid = String(customerId || "");
  const aud = String(n.audience ? n.audience : "all");
  if (aud === "all" || aud === "broadcast") return true;
  if (aud === "segment")
    return Array.isArray(n.recipientIds) && n.recipientIds.includes(cid);
  if (aud === "customer" || aud === "customer_only")
    return String(n.customerId || "") === cid;
  // backward compat: record with customerId is personal
  if (n.customerId) return String(n.customerId) === cid;
  return true;
}

/**
 * Validate editor input. Returns { ok, error, value }.
 * error codes are stable so the UI can localise them.
 */
function validateNotifInput(input, { requireContent = true } = {}) {
  const title = String(input?.title || "").trim();
  const message = String(input?.message || "").trim();
  if (requireContent && !title) return { ok: false, error: "missing_title" };
  if (requireContent && !message) return { ok: false, error: "missing_message" };
  if (title.length > LIMITS.TITLE_MAX)
    return { ok: false, error: "title_too_long" };
  if (message.length > LIMITS.MESSAGE_MAX)
    return { ok: false, error: "message_too_long" };

  const u = sanitizeNotifUrl(input?.url);
  if (!u.ok) return { ok: false, error: u.error };

  const audience =
    input?.audience === undefined || input?.audience === null
      ? "all"
      : String(input.audience);
  if (!isValidAudience(audience)) return { ok: false, error: "invalid_audience" };

  return { ok: true, value: { title, message, url: u.value, audience } };
}

module.exports = {
  LIMITS,
  AUDIENCES,
  sanitizeNotifUrl,
  isValidAudience,
  payloadBytes,
  buildPushPayload,
  computeAudience,
  selectSubscriptions,
  visibleToCustomer,
  validateNotifInput,
};

"use strict";
/**
 * Pickup / delivery verification codes.
 *
 * - Two independent stages: "pickup" (shown to the store) and "delivery"
 *   (shown to the customer). The driver never receives either code.
 * - Codes are NOT stored: they are derived with HMAC-SHA256 from a server
 *   secret, the order id and a per-order random salt. Only the salt and
 *   attempt/usage counters live on the order (order.verify).
 * - Attempt limit + temporary lock, expiry, one-time use, constant-time compare.
 * - A supervisor may record an authorised exception (reason + actor) that lets
 *   the stage pass without the code. Legacy orders (no order.verify) are not
 *   gated, so in-flight orders keep working after deployment.
 */
const crypto = require("crypto");

const STAGES = Object.freeze(["pickup", "delivery"]);
const MAX_ATTEMPTS = 5;
const LOCK_MS = 10 * 60 * 1000;
const TTL_MS = 24 * 60 * 60 * 1000;

function isStage(s) {
  return STAGES.includes(s);
}

function newVerify(now = new Date()) {
  const t = now.getTime();
  return {
    salt: crypto.randomBytes(16).toString("hex"),
    createdAt: new Date(t).toISOString(),
    expiresAt: new Date(t + TTL_MS).toISOString(),
    pickup: { attempts: 0 },
    delivery: { attempts: 0 },
  };
}

function codeFor(secret, order, stage) {
  if (!secret || !order?.verify?.salt || !isStage(stage)) return null;
  const h = crypto
    .createHmac("sha256", String(secret))
    .update(`${order.id}|${order.verify.salt}|${stage}`)
    .digest();
  return String(h.readUInt32BE(0) % 1000000).padStart(6, "0");
}

/** Is a code required before this stage may complete? */
function isRequired(order, stage) {
  const v = order?.verify;
  if (!v || !isStage(stage) || !v[stage]) return false; // legacy order
  return !v[stage].verifiedAt && !v[stage].exception;
}

/**
 * Verify `input` for `stage`. Mutates order.verify[stage] (attempts / verifiedAt)
 * so the caller MUST persist the order on both success and failure.
 * @returns {{ok:true} | {ok:false, code:string, status:number, attemptsLeft?:number}}
 */
function check(secret, order, stage, input, now = new Date()) {
  if (!isRequired(order, stage)) return { ok: true };
  const st = order.verify[stage];
  const t = now.getTime();
  if (t > Date.parse(order.verify.expiresAt)) {
    return { ok: false, code: "CODE_EXPIRED", status: 410 };
  }
  if (st.lockedUntil && t < Date.parse(st.lockedUntil)) {
    return { ok: false, code: "CODE_LOCKED", status: 423 };
  }
  const given = String(input == null ? "" : input).trim();
  if (!/^\d{6}$/.test(given)) {
    return { ok: false, code: "CODE_REQUIRED", status: 400 };
  }
  const expected = codeFor(secret, order, stage);
  const a = Buffer.from(given);
  const b = Buffer.from(expected || "");
  const match = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (match) {
    st.verifiedAt = new Date(t).toISOString();
    st.attempts = 0;
    delete st.lockedUntil;
    return { ok: true };
  }
  st.attempts = (st.attempts || 0) + 1;
  if (st.attempts >= MAX_ATTEMPTS) {
    st.lockedUntil = new Date(t + LOCK_MS).toISOString();
    st.attempts = 0;
    return { ok: false, code: "CODE_LOCKED", status: 423 };
  }
  return {
    ok: false,
    code: "CODE_INVALID",
    status: 403,
    attemptsLeft: MAX_ATTEMPTS - st.attempts,
  };
}

/** Supervisor-authorised bypass for one stage. Also refreshes expiry. */
function grantException(order, stage, { by, reason, now = new Date() }) {
  if (!order?.verify || !isStage(stage)) return { ok: false, error: "No verification on this order" };
  const why = String(reason || "").trim();
  if (why.length < 3) return { ok: false, error: "Reason required" };
  order.verify[stage].exception = {
    by: String(by || ""),
    reason: why.slice(0, 300),
    at: now.toISOString(),
  };
  order.verify.expiresAt = new Date(now.getTime() + TTL_MS).toISOString();
  return { ok: true };
}

/** The code a customer may see: only while the delivery stage is still pending. */
function deliveryCodeForCustomer(secret, order) {
  if (!["accepted", "picked_up", "on_the_way"].includes(String(order?.status))) return null;
  if (!isRequired(order, "delivery")) return null;
  return codeFor(secret, order, "delivery");
}

/** The code a store may see: from "ready" until the driver has collected it. */
function pickupCodeForStore(secret, order) {
  if (!["admin_accepted", "restaurant_ready", "accepted"].includes(String(order?.status))) return null;
  if (!isRequired(order, "pickup")) return null;
  return codeFor(secret, order, "pickup");
}

/** Remove everything verification-related before sending an order to a driver. */
function stripForDriver(order) {
  const { verify, ...rest } = order || {};
  return {
    ...rest,
    verifyRequired: {
      pickup: isRequired(order, "pickup"),
      delivery: isRequired(order, "delivery"),
    },
  };
}

module.exports = {
  STAGES, MAX_ATTEMPTS, LOCK_MS, TTL_MS,
  newVerify, codeFor, isRequired, check, grantException,
  deliveryCodeForCustomer, pickupCodeForStore, stripForDriver,
};

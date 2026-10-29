"use strict";
/**
 * Retry policy + queue logic for web-push delivery (pure, no I/O).
 *
 * - 404/410  -> subscription is gone: remove it, never retry.
 * - 400/401/403/413 (and other 4xx except 408/429) -> permanent: do not retry.
 * - 408, 429, 5xx, network errors (ECONNRESET, ETIMEDOUT, ...) -> transient: retry
 *   with growing delays, bounded attempts and a maximum age.
 * The queue is idempotent per (notification id, endpoint).
 */

const DELAYS_MS = Object.freeze([60e3, 5 * 60e3, 30 * 60e3, 2 * 3600e3]); // after attempt 1..4
const MAX_ATTEMPTS = DELAYS_MS.length + 1; // first send + 4 retries
const MAX_AGE_MS = 6 * 3600e3;
const MAX_QUEUE = 1000;

function classify(err) {
  const raw = err && (err.statusCode || err.status);
  const code = Number(raw);
  if (code === 404 || code === 410) return "gone";
  if (Number.isFinite(code) && code >= 400 && code < 500) return code === 408 || code === 429 ? "retry" : "permanent";
  if (Number.isFinite(code) && code >= 500) return "retry";
  return "retry"; // network-level failure (no HTTP status)
}

/** Delay before the next try after `attempt` attempts have been made, or null when out of attempts. */
function nextDelay(attempt) {
  return attempt >= 1 && attempt <= DELAYS_MS.length ? DELAYS_MS[attempt - 1] : null;
}

const keyOf = (i) => `${i.recId}|${i.endpoint}`;

/** Add a failed delivery to the queue (idempotent). Returns the queue. */
function enqueue(queue, { recId, endpoint, customerId, payload, attempt = 1, now = Date.now() }) {
  const q = Array.isArray(queue) ? queue : [];
  const d = nextDelay(attempt);
  if (d === null) return q;
  const item = { recId: String(recId), endpoint: String(endpoint), customerId: String(customerId || ""), payload, attempt, firstAt: now, nextAt: now + d };
  const k = keyOf(item);
  const existing = q.find((x) => keyOf(x) === k);
  if (existing) return q;
  q.push(item);
  while (q.length > MAX_QUEUE) q.shift();
  return q;
}

/** Items that are due now; expired ones are reported separately for dropping. */
function due(queue, now = Date.now()) {
  const ready = [];
  const expired = [];
  for (const i of queue || []) {
    if (now - i.firstAt > MAX_AGE_MS) expired.push(i);
    else if (i.nextAt <= now) ready.push(i);
  }
  return { ready, expired };
}

/** Apply the result of one retry attempt. outcome: "sent" | "gone" | "permanent" | "retry". */
function settle(queue, item, outcome, now = Date.now()) {
  const q = (queue || []).filter((x) => keyOf(x) !== keyOf(item));
  if (outcome !== "retry") return q;
  const attempt = item.attempt + 1;
  const d = nextDelay(attempt);
  if (d === null) return q; // exhausted
  q.push({ ...item, attempt, nextAt: now + d });
  return q;
}

module.exports = { DELAYS_MS, MAX_ATTEMPTS, MAX_AGE_MS, MAX_QUEUE, classify, nextDelay, enqueue, due, settle };

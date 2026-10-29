"use strict";
/**
 * Unified supervisor exception-management center (pure logic, no I/O) — unit-tested in tests/exceptions.test.js.
 *
 * A CASE tracks one problem on one order (or one payment) from detection to a recorded outcome:
 *   type, state, priority, responsible party, reasons, timeline, actions, final resolution.
 * Rules enforced here (the routes only persist the result):
 *   - a case can NOT be closed without a resolution outcome + note (RESOLUTION_REQUIRED);
 *   - a resolved case is final: no further actions except reading (CASE_CLOSED);
 *   - one open case per (type, order) — detection is idempotent (dedupeKey), a re-scan never duplicates;
 *   - every change appends to an append-only timeline (never rewritten);
 *   - failed delivery follows the configured redelivery rule, then escalates to the supervisor.
 */

const TYPES = Object.freeze([
  "delayed_preparation", "rejected_order", "unassigned_order", "driver_failure", "failed_delivery",
  "cancel_refund_request", "complaint_dispute", "payment_error",
]);
const STATUSES = Object.freeze(["open", "in_progress", "escalated", "resolved"]);
const PRIORITIES = Object.freeze(["low", "normal", "high", "urgent"]);
const ESCALATE_TO = Object.freeze(["accounting", "support", "supervisor"]);
const OUTCOMES = Object.freeze([
  "fixed", "reassigned", "redelivered", "refunded", "cancelled_confirmed", "compensated", "customer_at_fault",
  "store_at_fault", "driver_at_fault", "no_action_needed", "other",
]);
const CONTACT_PARTIES = Object.freeze(["customer", "store", "driver"]);

const LIMITS = Object.freeze({ note: 1000, reason: 300, timeline: 400, perOrder: 20 });

/** Safe, configurable bounds (the supervisor can change them, never outside these). */
const DEFAULTS = Object.freeze({
  prepDelayMin: 15,        // minutes after store acceptance without "ready" => delayed
  unassignedMin: 5,        // minutes in restaurant_ready without a driver => unassigned
  maxRedeliveryAttempts: 2,
  urgentAfterMin: 30,      // open this long => priority bumped to urgent
});
const BOUNDS = Object.freeze({
  prepDelayMin: [3, 240], unassignedMin: [1, 120], maxRedeliveryAttempts: [0, 5], urgentAfterMin: [5, 1440],
});

function clampSettings(raw) {
  const out = { ...DEFAULTS };
  const r = raw && typeof raw === "object" ? raw : {};
  for (const k of Object.keys(DEFAULTS)) {
    if (r[k] === undefined || r[k] === null || r[k] === "") continue;
    const n = Number(r[k]);
    if (Number.isFinite(n)) out[k] = Math.min(BOUNDS[k][1], Math.max(BOUNDS[k][0], Math.round(n)));
  }
  return out;
}

/** Validate a settings patch; unlike clampSettings this REJECTS out-of-range input so the admin sees why. */
function validateSettingsPatch(b) {
  const out = {};
  const r = b && typeof b === "object" ? b : {};
  for (const k of Object.keys(r)) {
    if (!(k in DEFAULTS)) return { ok: false, error: "Unknown setting: " + String(k).slice(0, 40), code: "UNKNOWN_SETTING" };
    const n = Number(r[k]);
    if (!Number.isInteger(n) || n < BOUNDS[k][0] || n > BOUNDS[k][1])
      return { ok: false, error: `${k} must be between ${BOUNDS[k][0]} and ${BOUNDS[k][1]}`, code: "OUT_OF_RANGE" };
    out[k] = n;
  }
  if (!Object.keys(out).length) return { ok: false, error: "Nothing to change", code: "EMPTY" };
  return { ok: true, value: out };
}

const str = (v, max) => String(v == null ? "" : v).replace(/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max);
const iso = (t) => new Date(t).toISOString();

const DEFAULT_PRIORITY = Object.freeze({
  delayed_preparation: "normal", rejected_order: "high", unassigned_order: "high", driver_failure: "high",
  failed_delivery: "high", cancel_refund_request: "normal", complaint_dispute: "normal", payment_error: "urgent",
});

function newCaseId(rnd = Math.random, now = Date.now) {
  return "EX-" + now().toString(36).toUpperCase().slice(-5) + Math.floor(rnd() * 36 ** 3).toString(36).toUpperCase().padStart(3, "0");
}

function event(kind, actor, text, now, extra) {
  return { at: iso(now), kind, by: actor && actor.name ? str(actor.name, 60) : actor && actor.id ? String(actor.id).slice(0, 60) : "system",
    role: actor && actor.role ? String(actor.role).slice(0, 30) : "system", text: str(text, LIMITS.timeline), ...(extra || {}) };
}

/** Create a case. -> {ok, case} | {ok:false, error, code} */
function createCase(input, { id, now = Date.now(), actor = null } = {}) {
  const b = input || {};
  if (!TYPES.includes(b.type)) return { ok: false, error: "Invalid case type", code: "INVALID_TYPE" };
  const reason = str(b.reason, LIMITS.reason);
  if (!reason) return { ok: false, error: "A reason is required", code: "REASON_REQUIRED" };
  if (b.type !== "payment_error" && !b.orderId) return { ok: false, error: "An order is required", code: "ORDER_REQUIRED" };
  const priority = PRIORITIES.includes(b.priority) ? b.priority : DEFAULT_PRIORITY[b.type];
  const orderId = b.orderId ? String(b.orderId).slice(0, 80) : "";
  const t = {
    id: id || newCaseId(),
    type: b.type,
    status: "open",
    priority,
    orderId,
    storeId: b.storeId ? String(b.storeId).slice(0, 80) : "",
    driverId: b.driverId ? String(b.driverId).slice(0, 80) : "",
    customerId: b.customerId ? String(b.customerId).slice(0, 80) : "",
    source: b.source === "auto" ? "auto" : "manual",
    dedupeKey: str(b.dedupeKey || (orderId ? b.type + ":" + orderId : ""), 120),
    responsible: { role: "supervisor", id: "", name: "" },
    reasons: [reason],
    timeline: [event("opened", actor, reason, now)],
    actions: [],
    redelivery: { attempts: 0, max: Number.isInteger(b.maxRedelivery) ? b.maxRedelivery : DEFAULTS.maxRedeliveryAttempts },
    resolution: null,
    createdAt: iso(now),
    updatedAt: iso(now),
  };
  return { ok: true, case: t };
}

/** Auto-detection must not duplicate: is there an unresolved case for the same key? */
function findOpen(cases, dedupeKey) {
  if (!dedupeKey) return null;
  return (Array.isArray(cases) ? cases : []).find((c) => c.dedupeKey === dedupeKey && c.status !== "resolved") || null;
}

const closedErr = () => ({ ok: false, status: 409, error: "This case is already resolved", code: "CASE_CLOSED" });
const touch = (c, now) => { c.updatedAt = iso(now); };
const push = (c, ev, action) => { c.timeline.push(ev); if (action) c.actions.push(action); if (c.timeline.length > 500) c.timeline.splice(1, c.timeline.length - 500); };

function addReason(c, text, { actor, now = Date.now() } = {}) {
  if (c.status === "resolved") return closedErr();
  const r = str(text, LIMITS.reason);
  if (!r) return { ok: false, status: 400, error: "Empty reason", code: "REASON_REQUIRED" };
  if (!c.reasons.includes(r)) c.reasons.push(r);
  push(c, event("reason", actor, r, now));
  touch(c, now);
  return { ok: true, case: c };
}

function setPriority(c, priority, { actor, now = Date.now() } = {}) {
  if (c.status === "resolved") return closedErr();
  if (!PRIORITIES.includes(priority)) return { ok: false, status: 400, error: "Invalid priority", code: "INVALID_PRIORITY" };
  if (c.priority !== priority) {
    push(c, event("priority", actor, `${c.priority} -> ${priority}`, now));
    c.priority = priority; touch(c, now);
  }
  return { ok: true, case: c };
}

/** Take ownership. */
function assign(c, to, { actor, now = Date.now() } = {}) {
  if (c.status === "resolved") return closedErr();
  const t = to || {};
  c.responsible = { role: str(t.role || "supervisor", 30), id: str(t.id, 80), name: str(t.name, 60) };
  if (c.status === "open") c.status = "in_progress";
  push(c, event("assigned", actor, `${c.responsible.role}${c.responsible.name ? " " + c.responsible.name : ""}`, now),
    { kind: "assign", at: iso(now), to: c.responsible.role });
  touch(c, now);
  return { ok: true, case: c };
}

/** Record that a party was contacted (the contact itself happens outside; we never claim it was received). */
function recordContact(c, party, note, { actor, now = Date.now() } = {}) {
  if (c.status === "resolved") return closedErr();
  if (!CONTACT_PARTIES.includes(party)) return { ok: false, status: 400, error: "Invalid party", code: "INVALID_PARTY" };
  const n = str(note, LIMITS.note);
  if (!n) return { ok: false, status: 400, error: "Note required", code: "NOTE_REQUIRED" };
  if (c.status === "open") c.status = "in_progress";
  push(c, event("contact", actor, `[${party}] ${n}`, now), { kind: "contact", at: iso(now), party });
  touch(c, now);
  return { ok: true, case: c };
}

/** Escalate to accounting / customer support / (back to) the supervisor. */
function escalate(c, to, reason, { actor, now = Date.now() } = {}) {
  if (c.status === "resolved") return closedErr();
  if (!ESCALATE_TO.includes(to)) return { ok: false, status: 400, error: "Invalid escalation target", code: "INVALID_TARGET" };
  const r = str(reason, LIMITS.reason);
  if (!r) return { ok: false, status: 400, error: "Reason required", code: "REASON_REQUIRED" };
  c.status = "escalated";
  c.responsible = { role: to, id: "", name: "" };
  if (!c.reasons.includes(r)) c.reasons.push(r);
  if (PRIORITIES.indexOf(c.priority) < PRIORITIES.indexOf("high")) c.priority = "high";
  push(c, event("escalated", actor, `-> ${to}: ${r}`, now), { kind: "escalate", at: iso(now), to });
  touch(c, now);
  return { ok: true, case: c };
}

/** Record a driver reassignment that the route performed through the dispatch service (the lib never fakes it). */
function recordReassign(c, { fromDriverId, ok, error, actor, now = Date.now() } = {}) {
  if (c.status === "resolved") return closedErr();
  push(c, event("reassign", actor, ok ? `driver ${fromDriverId || "-"} released, dispatch restarted` : `reassign failed: ${str(error, 100)}`, now),
    { kind: "reassign", at: iso(now), ok: !!ok });
  if (ok && c.status === "open") c.status = "in_progress";
  touch(c, now);
  return { ok: true, case: c };
}

/**
 * Failed delivery: record the reason and decide, from the configured rule, whether to try again.
 * @returns {{ok, decision: "redeliver"|"escalate", case}}
 */
function recordFailedAttempt(c, reason, { actor, now = Date.now(), maxAttempts } = {}) {
  if (c.status === "resolved") return closedErr();
  const r = str(reason, LIMITS.reason);
  if (!r) return { ok: false, status: 400, error: "A failure reason is required", code: "REASON_REQUIRED" };
  const max = Number.isInteger(maxAttempts) ? maxAttempts : c.redelivery.max;
  c.redelivery.max = max;
  c.redelivery.attempts += 1;
  if (!c.reasons.includes(r)) c.reasons.push(r);
  push(c, event("failed_attempt", actor, `#${c.redelivery.attempts}: ${r}`, now), { kind: "failed_attempt", at: iso(now), n: c.redelivery.attempts });
  let decision;
  if (c.redelivery.attempts <= max) {
    decision = "redeliver";
    if (c.status === "open") c.status = "in_progress";
    push(c, event("redelivery_scheduled", actor, `attempt ${c.redelivery.attempts} of ${max}`, now));
  } else {
    decision = "escalate"; // out of attempts: the supervisor must decide
    c.status = "escalated"; c.responsible = { role: "supervisor", id: "", name: "" };
    c.priority = "urgent";
    push(c, event("escalated", actor, "redelivery attempts exhausted", now), { kind: "escalate", at: iso(now), to: "supervisor" });
  }
  touch(c, now);
  return { ok: true, decision, case: c };
}

/** Close a case. Refuses without a recorded outcome AND note. */
function resolve(c, { outcome, note } = {}, { actor, now = Date.now() } = {}) {
  if (c.status === "resolved") return closedErr();
  if (!OUTCOMES.includes(outcome)) return { ok: false, status: 400, error: "A valid outcome is required to close the case", code: "RESOLUTION_REQUIRED" };
  const n = str(note, LIMITS.note);
  if (n.length < 3) return { ok: false, status: 400, error: "A resolution note is required to close the case", code: "RESOLUTION_REQUIRED" };
  c.status = "resolved";
  c.resolution = { outcome, note: n, by: actor && actor.id ? String(actor.id).slice(0, 60) : "", role: actor && actor.role ? String(actor.role).slice(0, 30) : "", at: iso(now) };
  push(c, event("resolved", actor, `${outcome}: ${n}`, now), { kind: "resolve", at: iso(now), outcome });
  touch(c, now);
  return { ok: true, case: c };
}

/** Priority bump for stale unresolved cases (idempotent). */
function ageCase(c, { now = Date.now(), urgentAfterMin = DEFAULTS.urgentAfterMin } = {}) {
  if (c.status === "resolved" || c.priority === "urgent") return false;
  if (now - Date.parse(c.createdAt) >= urgentAfterMin * 60000) {
    push(c, event("priority", null, `${c.priority} -> urgent (open > ${urgentAfterMin} min)`, now));
    c.priority = "urgent"; touch(c, now);
    return true;
  }
  return false;
}

/* ---------------- detection from authoritative order records ---------------- */

const mins = (ms) => Math.floor(ms / 60000);
const ts = (v) => { const n = Date.parse(v); return Number.isFinite(n) ? n : null; };

/**
 * Looks at orders (read-only) and returns the cases that SHOULD exist. Nothing is invented: every candidate cites the
 * order field that triggered it. The caller dedupes with findOpen() so re-scanning is safe.
 */
function detect(orders, { now = Date.now(), settings = DEFAULTS } = {}) {
  const s = clampSettings(settings);
  const out = [];
  for (const o of Array.isArray(orders) ? orders : []) {
    if (!o || !o.id) continue;
    const st = String(o.status || "new");
    const base = { orderId: String(o.id), storeId: o.storeId || o.restaurantId || "", driverId: o.driverId || "", customerId: o.customerId || "", source: "auto" };

    // delayed preparation: store accepted, but no "ready" yet
    if (st === "admin_accepted" && o.storeAcceptedAt && ts(o.storeAcceptedAt) != null) {
      const age = mins(now - ts(o.storeAcceptedAt));
      const expected = Number(o.prepMinutes) > 0 ? Number(o.prepMinutes) : 0;
      const limit = expected ? expected + s.prepDelayMin : s.prepDelayMin;
      if (age >= limit) out.push({ ...base, type: "delayed_preparation", reason: `Preparing for ${age} min (limit ${limit})`, priority: age >= limit * 2 ? "high" : "normal" });
    }
    // unassigned: released to drivers but nobody took it
    if (st === "restaurant_ready" && !o.driverId) {
      const since = ts(o.readyAt || o.updatedAt || o.createdAt);
      if (since != null && mins(now - since) >= s.unassignedMin) out.push({ ...base, type: "unassigned_order", reason: `No driver for ${mins(now - since)} min` });
    }
    // rejected by the store (needs supervisor review before final closure)
    if ((st === "canceled" || st === "cancelled" || st === "rejected") && (o.rejectedByStore || o.storeRejectedAt || o.canceledBy === "store" || o.cancelledBy === "store")) {
      out.push({ ...base, type: "rejected_order", reason: str(o.rejectReason || o.cancelReason || "Rejected by the store", LIMITS.reason) });
    }
    // failed delivery
    if (st === "failed_delivery" || o.deliveryFailedAt || o.failedDelivery) {
      out.push({ ...base, type: "failed_delivery", reason: str((o.failedDelivery && o.failedDelivery.reason) || o.deliveryFailReason || "Delivery failed", LIMITS.reason) });
    }
    // driver failure: the driver cancelled/abandoned an active delivery
    if (o.driverFailure || o.driverAbandonedAt) {
      out.push({ ...base, type: "driver_failure", reason: str((o.driverFailure && o.driverFailure.reason) || "Driver could not complete the delivery", LIMITS.reason) });
    }
    // refund / cancellation requests and payment mismatches (only if the order carries the flag)
    if (o.refundRequested || st === "refund_pending") out.push({ ...base, type: "cancel_refund_request", reason: str(o.refundReason || "Refund requested", LIMITS.reason) });
    if (o.paymentError || o.reconciliationError) out.push({ ...base, type: "payment_error", reason: str(o.paymentError || o.reconciliationError, LIMITS.reason) });
  }
  return out;
}

/* ---------------- listing / views ---------------- */

const RANK = { urgent: 0, high: 1, normal: 2, low: 3 };

function filterCases(cases, q = {}) {
  let l = Array.isArray(cases) ? cases.slice() : [];
  if (STATUSES.includes(q.status)) l = l.filter((c) => c.status === q.status);
  else if (q.status === "active") l = l.filter((c) => c.status !== "resolved");
  if (TYPES.includes(q.type)) l = l.filter((c) => c.type === q.type);
  if (PRIORITIES.includes(q.priority)) l = l.filter((c) => c.priority === q.priority);
  if (q.orderId) l = l.filter((c) => c.orderId === String(q.orderId));
  if (q.storeId) l = l.filter((c) => c.storeId === String(q.storeId));
  if (q.responsible) l = l.filter((c) => c.responsible && c.responsible.role === String(q.responsible));
  const term = String(q.q || "").trim().toLowerCase();
  if (term) l = l.filter((c) => (c.id + " " + c.orderId + " " + (Array.isArray(c.reasons) ? c.reasons : []).join(" ")).toLowerCase().includes(term));
  l.sort((a, b) => (a.status === "resolved") - (b.status === "resolved") || RANK[a.priority] - RANK[b.priority] || String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return l;
}

function counts(cases) {
  const list = Array.isArray(cases) ? cases : [];
  const active = list.filter((c) => c.status !== "resolved");
  const byType = {};
  for (const t of TYPES) byType[t] = active.filter((c) => c.type === t).length;
  return { active: active.length, urgent: active.filter((c) => c.priority === "urgent").length, escalated: active.filter((c) => c.status === "escalated").length, resolved: list.length - active.length, byType };
}

function summary(c) {
  return { id: c.id, type: c.type, status: c.status, priority: c.priority, orderId: c.orderId, storeId: c.storeId, driverId: c.driverId,
    responsible: c.responsible, reason: (Array.isArray(c.reasons) && c.reasons[0]) || "", source: c.source, redelivery: c.redelivery, resolution: c.resolution,
    createdAt: c.createdAt, updatedAt: c.updatedAt };
}
const detail = (c) => ({ ...summary(c), reasons: Array.isArray(c.reasons) ? c.reasons : [], timeline: Array.isArray(c.timeline) ? c.timeline : [], actions: Array.isArray(c.actions) ? c.actions : [] });

module.exports = {
  TYPES, STATUSES, PRIORITIES, ESCALATE_TO, OUTCOMES, CONTACT_PARTIES, DEFAULTS, BOUNDS, LIMITS,
  clampSettings, validateSettingsPatch, newCaseId, createCase, findOpen, addReason, setPriority, assign, recordContact,
  escalate, recordReassign, recordFailedAttempt, resolve, ageCase, detect, filterCases, counts, summary, detail,
};

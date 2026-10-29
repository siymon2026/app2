"use strict";
/**
 * Customer complaints (spec 16). Pure logic, no I/O — unit-tested in tests/complaints.test.js.
 *
 * A complaint is always linked to ONE order and is about the store, the driver or the platform itself.
 *   store / driver  -> routed FIRST to that party to try to resolve it (status with_party, responsible = store|driver)
 *   platform        -> goes straight to the supervisor (escalated)
 * Flow:
 *   with_party --party answers--> party_responded --customer accepts--> resolved
 *        |                              |--customer says "not solved"--> escalated
 *        |--no answer before the deadline--> escalated (automatic, recorded)
 *   party_responded --customer silent past the deadline--> resolved (automatic, outcome no_customer_reply)
 *   escalated --supervisor takes it--> in_review --supervisor resolves (outcome + note REQUIRED)--> resolved
 *   the customer may withdraw while it is still with the party / answered.
 * Rules enforced here (the routes only persist the result):
 *   - nothing is closed without a recorded resolution (outcome + who + when [+ note for supervisors]);
 *   - a resolved complaint is final;
 *   - the timeline is append-only; supervisor-only notes carry visibility "internal" and never reach the customer/party;
 *   - the party sees what the customer wrote about them but NEVER the customer's phone / address (the views drop them).
 */

const CATEGORIES = Object.freeze(["food_quality", "missing_items", "wrong_order", "late_delivery", "driver_behavior", "extra_charge", "payment", "other"]);
const AGAINST = Object.freeze(["store", "driver", "platform"]);
const STATUSES = Object.freeze(["with_party", "party_responded", "escalated", "in_review", "resolved"]);
const OPEN_STATUSES = Object.freeze(["with_party", "party_responded", "escalated", "in_review"]);
const OUTCOMES = Object.freeze(["fixed", "compensated", "store_at_fault", "driver_at_fault", "customer_at_fault", "no_action_needed", "other"]);
const SYSTEM_OUTCOMES = Object.freeze(["resolved_by_party", "withdrawn", "no_customer_reply"]);
const FILING_WINDOW_MS = 30 * 24 * 3600 * 1000;
const LIMITS = Object.freeze({ text: 1000, note: 1000, reason: 300, timeline: 200, openPerCustomer: 10, perOrder: 6, minText: 10 });

const DEFAULTS = Object.freeze({ partyResponseHours: 24, customerReplyHours: 72 });
const BOUNDS = Object.freeze({ partyResponseHours: [1, 168], customerReplyHours: [12, 336] });

const str = (v, max) => String(v == null ? "" : v).replace(/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ").replace(/[ \t]+/g, " ").trim().slice(0, max);
const iso = (t) => new Date(t).toISOString();
const ts = (v) => { const n = Date.parse(v); return Number.isFinite(n) ? n : null; };
const cleanClientId = (v) => (/^[A-Za-z0-9_.:-]{6,64}$/.test(String(v || "")) ? String(v) : null);

function clampSettings(raw) {
  const out = { ...DEFAULTS };
  const r = raw && typeof raw === "object" ? raw : {};
  for (const k of Object.keys(DEFAULTS)) {
    if (r[k] == null || r[k] === "") continue;
    const n = Number(r[k]);
    if (Number.isFinite(n)) out[k] = Math.min(BOUNDS[k][1], Math.max(BOUNDS[k][0], Math.round(n)));
  }
  return out;
}
/** Unlike clampSettings this REJECTS out-of-range input so the supervisor sees why. */
function validateSettingsPatch(b) {
  const out = {};
  const r = b && typeof b === "object" ? b : {};
  for (const k of Object.keys(r)) {
    if (!(k in DEFAULTS)) return { ok: false, error: "Unknown setting: " + String(k).slice(0, 40), code: "UNKNOWN_SETTING" };
    const n = Number(r[k]);
    if (!Number.isInteger(n) || n < BOUNDS[k][0] || n > BOUNDS[k][1]) return { ok: false, error: `${k} must be between ${BOUNDS[k][0]} and ${BOUNDS[k][1]}`, code: "OUT_OF_RANGE" };
    out[k] = n;
  }
  if (!Object.keys(out).length) return { ok: false, error: "Nothing to change", code: "EMPTY" };
  return { ok: true, value: out };
}

const newId = (rnd = Math.random, now = Date.now) => ("CP-" + now().toString(36).slice(-4) + Math.floor(rnd() * 36 ** 4).toString(36).padStart(4, "0")).toUpperCase();
const isId = (id) => /^CP-[A-Z0-9]{8}$/.test(String(id || ""));

function entry(kind, actor, text, now, visibility = "all") {
  return { at: iso(now), kind, actor: { role: String((actor && actor.role) || "system"), id: String((actor && actor.id) || ""), name: str(actor && actor.name, 60) }, text: str(text, LIMITS.timeline * 5), visibility };
}
const closedErr = () => ({ ok: false, status: 409, code: "COMPLAINT_CLOSED", error: "This complaint is already resolved" });
const push = (c, e, now) => { c.timeline.push(e); if (c.timeline.length > LIMITS.timeline) c.timeline.splice(1, c.timeline.length - LIMITS.timeline); c.updatedAt = iso(now); };

/* ---------------- filing ---------------- */

function validateComplaint(b) {
  b = b || {};
  const orderId = str(b.orderId, 80);
  if (!orderId) return { ok: false, error: "Order required", code: "ORDER_REQUIRED" };
  if (!AGAINST.includes(b.against)) return { ok: false, error: "Choose who the complaint is about", code: "INVALID_AGAINST" };
  if (!CATEGORIES.includes(b.category)) return { ok: false, error: "Choose a category", code: "INVALID_CATEGORY" };
  const text = str(b.text, LIMITS.text);
  if (text.length < LIMITS.minText) return { ok: false, error: "Please describe the problem (at least 10 characters)", code: "TEXT_TOO_SHORT" };
  return { ok: true, value: { orderId, against: b.against, category: b.category, text, clientId: cleanClientId(b.clientId) } };
}

/** May this order be complained about now? Ownership is verified by the caller. */
function canFile(order, against, now = Date.now()) {
  if (!order) return { ok: false, status: 404, code: "ORDER_NOT_FOUND", error: "Order not found" };
  const status = String(order.status || "new").toLowerCase();
  if (status === "new") return { ok: false, status: 409, code: "ORDER_NOT_ACTIVE", error: "The order has not been accepted yet; cancel it instead" };
  if (against === "store" && !order.restaurantId) return { ok: false, status: 409, code: "NO_STORE", error: "This order has no store" };
  if (against === "driver" && !order.driverId) return { ok: false, status: 409, code: "NO_DRIVER", error: "No driver was assigned to this order" };
  const at = ts(order.deliveredAt) || ts(order.updatedAt) || ts(order.createdAt);
  if (at != null && now - at > FILING_WINDOW_MS) return { ok: false, status: 410, code: "WINDOW_EXPIRED", error: "The complaint window (30 days) has ended" };
  return { ok: true };
}

/** Duplicate / limit checks against the existing list. -> {ok:true} | {ok:true,duplicate:c} | {ok:false,...} */
function checkLimits(list, { customerId, orderId, against, clientId }) {
  if (clientId) {
    const dup = list.find((c) => c.customerId === String(customerId) && c.clientId === clientId);
    if (dup) return { ok: true, duplicate: dup };
  }
  const sameTarget = list.find((c) => c.orderId === String(orderId) && c.against === against && OPEN_STATUSES.includes(c.status));
  if (sameTarget) return { ok: false, status: 409, code: "ALREADY_OPEN", error: "There is already an open complaint about this on this order", existing: sameTarget.id };
  if (list.filter((c) => c.orderId === String(orderId)).length >= LIMITS.perOrder) return { ok: false, status: 429, code: "TOO_MANY_FOR_ORDER", error: "Too many complaints for this order" };
  if (list.filter((c) => c.customerId === String(customerId) && OPEN_STATUSES.includes(c.status)).length >= LIMITS.openPerCustomer)
    return { ok: false, status: 429, code: "TOO_MANY_OPEN", error: "Too many open complaints, wait for answers first" };
  return { ok: true };
}

function create({ id, order, customerId, value, settings = DEFAULTS, now = Date.now() }) {
  const against = value.against;
  const toParty = against === "store" || against === "driver";
  const hours = (settings && settings.partyResponseHours) || DEFAULTS.partyResponseHours;
  const c = {
    id, orderId: String(order.id), customerId: String(customerId), storeId: order.restaurantId ? String(order.restaurantId) : "",
    driverId: order.driverId ? String(order.driverId) : "", // kept for the supervisor (and the linked case) even when the complaint is about the store
    against, category: value.category, text: value.text, clientId: value.clientId || null,
    status: toParty ? "with_party" : "escalated",
    responsible: toParty ? { role: against, id: String(against === "store" ? order.restaurantId : order.driverId) } : { role: "supervisor", id: "" },
    respondBy: toParty ? iso(now + hours * 3600 * 1000) : null,
    replyBy: null, exceptionCaseId: null, resolution: null,
    createdAt: iso(now), updatedAt: iso(now), timeline: [],
  };
  c.timeline.push(entry("filed", { role: "customer", id: customerId }, value.text, now));
  c.timeline.push(entry(toParty ? "routed" : "escalated", { role: "system" }, toParty ? against : "platform", now));
  return c;
}

/* ---------------- party (store / driver) ---------------- */

function partyRespond(c, { party, text, actor, settings = DEFAULTS, now = Date.now() }) {
  if (c.status === "resolved") return closedErr();
  if (c.status !== "with_party") return { ok: false, status: 409, code: "NOT_AWAITING_PARTY", error: "This complaint is not waiting for your answer" };
  if (!c.responsible || c.responsible.role !== party.role || String(c.responsible.id) !== String(party.id))
    return { ok: false, status: 403, code: "NOT_RESPONSIBLE", error: "Forbidden" };
  const body = str(text, LIMITS.note);
  if (body.length < 3) return { ok: false, status: 400, code: "TEXT_REQUIRED", error: "Write your answer" };
  c.status = "party_responded";
  c.respondBy = null;
  c.replyBy = iso(now + ((settings && settings.customerReplyHours) || DEFAULTS.customerReplyHours) * 3600 * 1000);
  push(c, entry("party_response", { role: party.role, id: party.id, name: actor && actor.name }, body, now), now);
  return { ok: true };
}

/* ---------------- customer ---------------- */

function customerAccept(c, { actor, now = Date.now() }) {
  if (c.status === "resolved") return closedErr();
  if (c.status !== "party_responded") return { ok: false, status: 409, code: "NOT_ANSWERED", error: "There is no answer to accept yet" };
  return finish(c, { outcome: "resolved_by_party", note: "", by: { role: "customer", id: (actor && actor.id) || "" }, kind: "customer_accept", text: "accepted", now });
}

function customerEscalate(c, { reason, actor, now = Date.now() }) {
  if (c.status === "resolved") return closedErr();
  if (!["with_party", "party_responded"].includes(c.status)) return { ok: false, status: 409, code: "ALREADY_ESCALATED", error: "Already with the supervisor" };
  const why = str(reason, LIMITS.reason);
  if (why.length < 3) return { ok: false, status: 400, code: "REASON_REQUIRED", error: "Tell us why it is not solved" };
  return toSupervisor(c, { kind: "customer_escalate", actor: { role: "customer", id: (actor && actor.id) || "" }, text: why, now });
}

function customerWithdraw(c, { actor, now = Date.now() }) {
  if (c.status === "resolved") return closedErr();
  if (!["with_party", "party_responded"].includes(c.status)) return { ok: false, status: 409, code: "WITH_SUPERVISOR", error: "The supervisor is handling this complaint; ask support to close it" };
  return finish(c, { outcome: "withdrawn", note: "", by: { role: "customer", id: (actor && actor.id) || "" }, kind: "withdrawn", text: "withdrawn", now });
}

/* ---------------- supervisor ---------------- */

function toSupervisor(c, { kind, actor, text, now }) {
  c.status = "escalated";
  c.responsible = { role: "supervisor", id: "" };
  c.respondBy = null; c.replyBy = null;
  push(c, entry(kind, actor, text, now), now);
  return { ok: true };
}

function supervisorTake(c, { actor, now = Date.now() }) {
  if (c.status === "resolved") return closedErr();
  if (!["escalated", "in_review"].includes(c.status)) return { ok: false, status: 409, code: "NOT_ESCALATED", error: "The complaint is still with the store/driver; escalate it first" };
  c.status = "in_review";
  c.responsible = { role: "supervisor", id: String((actor && actor.id) || "") };
  push(c, entry("taken", actor, "", now), now);
  return { ok: true };
}

/** A supervisor may also pull a complaint off the party (e.g. serious case): same as escalation, recorded with the reason. */
function supervisorEscalate(c, { reason, actor, now = Date.now() }) {
  if (c.status === "resolved") return closedErr();
  if (!["with_party", "party_responded"].includes(c.status)) return { ok: false, status: 409, code: "ALREADY_ESCALATED", error: "Already with the supervisor" };
  const why = str(reason, LIMITS.reason);
  if (why.length < 3) return { ok: false, status: 400, code: "REASON_REQUIRED", error: "A reason is required" };
  return toSupervisor(c, { kind: "escalated", actor, text: why, now });
}

function addInternalNote(c, { text, actor, now = Date.now() }) {
  if (c.status === "resolved") return closedErr();
  const body = str(text, LIMITS.note);
  if (!body) return { ok: false, status: 400, code: "TEXT_REQUIRED", error: "Write a note" };
  push(c, entry("note", actor, body, now, "internal"), now);
  return { ok: true };
}

/** Message from the supervisor that the customer and the party may read. */
function addPublicNote(c, { text, actor, now = Date.now() }) {
  if (c.status === "resolved") return closedErr();
  const body = str(text, LIMITS.note);
  if (!body) return { ok: false, status: 400, code: "TEXT_REQUIRED", error: "Write a message" };
  push(c, entry("supervisor_message", { role: "supervisor", id: actor && actor.id, name: "" }, body, now), now);
  return { ok: true };
}

function supervisorResolve(c, { outcome, note, actor, now = Date.now() }) {
  if (c.status === "resolved") return closedErr();
  const n = str(note, LIMITS.note);
  if (!OUTCOMES.includes(outcome) || n.length < 3) return { ok: false, status: 400, code: "RESOLUTION_REQUIRED", error: "A complaint cannot be closed without an outcome and a resolution note" };
  return finish(c, { outcome, note: n, by: { role: String((actor && actor.role) || "supervisor"), id: String((actor && actor.id) || "") }, kind: "resolved", text: n, now });
}

function finish(c, { outcome, note, by, kind, text, now }) {
  c.status = "resolved";
  c.responsible = { role: "none", id: "" };
  c.respondBy = null; c.replyBy = null;
  c.resolution = { outcome, note: note || "", by, at: iso(now) };
  push(c, entry(kind, by, text, now), now);
  return { ok: true };
}

/* ---------------- time-based rules ---------------- */

/** Applies deadline rules to one complaint. Returns "escalated" | "auto_resolved" | null (nothing changed). */
function age(c, { now = Date.now() } = {}) {
  if (c.status === "with_party" && c.respondBy && ts(c.respondBy) != null && now >= ts(c.respondBy)) {
    toSupervisor(c, { kind: "auto_escalated", actor: { role: "system" }, text: "party_timeout", now });
    return "escalated";
  }
  if (c.status === "party_responded" && c.replyBy && ts(c.replyBy) != null && now >= ts(c.replyBy)) {
    finish(c, { outcome: "no_customer_reply", note: "", by: { role: "system", id: "" }, kind: "auto_resolved", text: "no_customer_reply", now });
    return "auto_resolved";
  }
  return null;
}

/* ---------------- views (what each side may read) ---------------- */

const publicTimeline = (c) => c.timeline.filter((e) => e.visibility !== "internal");
const base = (c) => ({
  id: c.id, orderId: c.orderId, against: c.against, category: c.category, status: c.status, text: c.text,
  responsible: c.responsible && c.responsible.role, respondBy: c.respondBy, replyBy: c.replyBy, resolution: c.resolution ? { outcome: c.resolution.outcome, at: c.resolution.at, note: c.resolution.by && c.resolution.by.role === "customer" ? "" : c.resolution.note } : null,
  createdAt: c.createdAt, updatedAt: c.updatedAt,
});

/** Customer: public timeline; staff identities reduced to their role. */
function customerView(c) {
  return { ...base(c), timeline: publicTimeline(c).map((e) => ({ at: e.at, kind: e.kind, role: e.actor.role, text: e.text })) };
}
/** Store / driver: same facts, no customer identity at all (the complaint never carries phone/address). */
function partyView(c) {
  return { ...base(c), timeline: publicTimeline(c).map((e) => ({ at: e.at, kind: e.kind, role: e.actor.role, text: e.text })) };
}
function adminSummary(c) {
  return { id: c.id, orderId: c.orderId, against: c.against, category: c.category, status: c.status, storeId: c.storeId, driverId: c.driverId, customerId: c.customerId,
    responsible: c.responsible, exceptionCaseId: c.exceptionCaseId, resolution: c.resolution, createdAt: c.createdAt, updatedAt: c.updatedAt, text: str(c.text, 160) };
}
const adminDetail = (c) => ({ ...adminSummary(c), text: c.text, respondBy: c.respondBy, replyBy: c.replyBy, timeline: c.timeline });

function filter(list, q = {}) {
  let out = list;
  if (STATUSES.includes(q.status)) out = out.filter((c) => c.status === q.status);
  else if (q.status === "open") out = out.filter((c) => OPEN_STATUSES.includes(c.status));
  if (AGAINST.includes(q.against)) out = out.filter((c) => c.against === q.against);
  if (CATEGORIES.includes(q.category)) out = out.filter((c) => c.category === q.category);
  if (q.storeId) out = out.filter((c) => c.storeId === String(q.storeId));
  if (q.orderId) out = out.filter((c) => c.orderId === String(q.orderId));
  const s = String(q.q || "").trim().toLowerCase();
  if (s) out = out.filter((c) => (c.id + " " + c.orderId + " " + c.text).toLowerCase().includes(s));
  return out.slice().sort((a, b) => (a.status === "escalated" ? 0 : 1) - (b.status === "escalated" ? 0 : 1) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
}
function counts(list) {
  const c = { total: list.length, open: 0, with_party: 0, party_responded: 0, escalated: 0, in_review: 0, resolved: 0 };
  for (const x of list) { c[x.status]++; if (OPEN_STATUSES.includes(x.status)) c.open++; }
  return c;
}

module.exports = {
  CATEGORIES, AGAINST, STATUSES, OPEN_STATUSES, OUTCOMES, SYSTEM_OUTCOMES, LIMITS, DEFAULTS, BOUNDS, FILING_WINDOW_MS,
  clampSettings, validateSettingsPatch, newId, isId, cleanClientId, validateComplaint, canFile, checkLimits, create,
  partyRespond, customerAccept, customerEscalate, customerWithdraw, supervisorTake, supervisorEscalate, addInternalNote, addPublicNote, supervisorResolve,
  age, customerView, partyView, adminSummary, adminDetail, filter, counts,
};

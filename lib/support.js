"use strict";
/**
 * Store <-> admin support (pure logic, no I/O) — unit-tested in tests/support.test.js.
 *
 *  1. CHANNELS: contact numbers/addresses the admin manages (phone, WhatsApp, email, Telegram). Only channels the admin
 *     enabled AND addressed to stores are shown in the store dashboard; the link (tel:/wa.me/mailto:/t.me) is built
 *     here from the validated value, never taken from the client.
 *  2. TICKETS: a store opens a ticket with the admin panel, both sides exchange messages, the admin closes/reopens.
 *     Every message may carry a clientId so a retry after a lost response never posts twice.
 */

const KINDS = Object.freeze(["phone", "whatsapp", "email", "telegram"]);
const AUDIENCES = Object.freeze(["stores", "drivers", "customers"]);
const CATEGORIES = Object.freeze(["orders", "products", "payments", "technical", "account", "other"]);
const STATUSES = Object.freeze(["open", "answered", "closed"]);
const LIMITS = Object.freeze({ channels: 20, label: 60, hours: 80, subject: 120, text: 2000, messages: 300, openPerStore: 5 });

const str = (v, max) => String(v == null ? "" : v).replace(/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max);

/* ---------------- channels ---------------- */

function normalizeValue(kind, raw) {
  const v = String(raw == null ? "" : raw).trim();
  if (kind === "phone" || kind === "whatsapp") {
    const s = v.replace(/[\s().-]/g, "");
    if (!/^\+?\d{8,15}$/.test(s)) return null;
    return s;
  }
  if (kind === "email") {
    const s = v.toLowerCase();
    return /^[^\s@<>]{1,64}@[^\s@<>]{1,190}\.[a-z]{2,}$/.test(s) && s.length <= 254 ? s : null;
  }
  if (kind === "telegram") {
    const s = v.replace(/^https?:\/\/(www\.)?(t\.me|telegram\.me)\//i, "").replace(/^@/, "");
    return /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(s) ? "@" + s : null;
  }
  return null;
}

/** Link the UI opens. Built from the normalised value only. */
function hrefFor(kind, value) {
  if (kind === "phone") return "tel:" + value;
  if (kind === "whatsapp") return "https://wa.me/" + value.replace(/^\+/, "");
  if (kind === "email") return "mailto:" + value;
  if (kind === "telegram") return "https://t.me/" + value.replace(/^@/, "");
  return "";
}

const i18n = (v) => {
  if (v && typeof v === "object") {
    const ar = str(v.ar, LIMITS.label), fr = str(v.fr, LIMITS.label), en = str(v.en, LIMITS.label);
    const any = ar || fr || en;
    return any ? { ar: ar || any, fr: fr || any, en: en || any } : null;
  }
  const s = str(v, LIMITS.label);
  return s ? { ar: s, fr: s, en: s } : null;
};

/** Validate one channel from the admin form. -> {ok, value} | {ok:false, error, code} */
function validateChannel(b) {
  b = b || {};
  const kind = String(b.kind || "");
  if (!KINDS.includes(kind)) return { ok: false, error: "Invalid channel type", code: "INVALID_KIND" };
  const label = i18n(b.label);
  if (!label) return { ok: false, error: "Label required", code: "LABEL_REQUIRED" };
  const value = normalizeValue(kind, b.value);
  if (!value) return { ok: false, error: "Invalid " + kind + " value", code: "INVALID_VALUE" };
  const aud = (Array.isArray(b.audience) ? b.audience : ["stores"]).map(String).filter((a) => AUDIENCES.includes(a));
  const audience = [...new Set(aud)];
  if (!audience.length) return { ok: false, error: "Choose who sees this channel", code: "AUDIENCE_REQUIRED" };
  return { ok: true, value: { kind, label, value, audience, hours: str(b.hours, LIMITS.hours), enabled: b.enabled !== false && b.enabled !== "false" } };
}

/** Only what the store dashboard may see: enabled channels addressed to this audience, in the admin's order. */
function publicChannels(list, audience = "stores") {
  return (Array.isArray(list) ? list : [])
    .filter((c) => c && c.enabled !== false && Array.isArray(c.audience) && c.audience.includes(audience) && KINDS.includes(c.kind))
    .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0))
    .map((c) => ({ id: c.id, kind: c.kind, label: c.label, value: c.value, hours: c.hours || "", href: hrefFor(c.kind, c.value) }));
}

/** Add (or replace) a channel in the stored list. Pure: returns {ok, list, channel}. */
function upsertChannel(list, id, value, newId, now = new Date()) {
  list = Array.isArray(list) ? list.map((c) => ({ ...c })) : [];
  const at = now.toISOString();
  if (id) {
    const cur = list.find((c) => String(c.id) === String(id));
    if (!cur) return { ok: false, status: 404, error: "Not found" };
    Object.assign(cur, value, { updatedAt: at });
    return { ok: true, list, channel: cur };
  }
  if (list.length >= LIMITS.channels) return { ok: false, status: 409, error: "Too many channels", code: "TOO_MANY" };
  if (list.some((c) => c.kind === value.kind && c.value === value.value)) return { ok: false, status: 409, error: "This channel already exists", code: "DUPLICATE" };
  const channel = { id: newId, ...value, sortOrder: list.length ? Math.max(...list.map((c) => Number(c.sortOrder) || 0)) + 1 : 1, createdAt: at, updatedAt: at };
  list.push(channel);
  return { ok: true, list, channel };
}

function reorder(list, ids) {
  const order = new Map((Array.isArray(ids) ? ids : []).map((id, i) => [String(id), i + 1]));
  return (Array.isArray(list) ? list : []).map((c) => ({ ...c, sortOrder: order.has(String(c.id)) ? order.get(String(c.id)) : 1000 + (Number(c.sortOrder) || 0) }));
}

/* ---------------- tickets ---------------- */

const newTicketId = (rand = Math.random, now = Date.now) => ("TK-" + now().toString(36).slice(-4) + Math.floor(rand() * 36 ** 4).toString(36).padStart(4, "0")).toUpperCase();
const isTicketId = (id) => /^TK-[A-Z0-9]{8}$/.test(String(id || ""));
const cleanClientId = (v) => (/^[A-Za-z0-9_.:-]{6,64}$/.test(String(v || "")) ? String(v) : null);

function validateTicket(b) {
  b = b || {};
  const subject = str(b.subject, LIMITS.subject);
  const text = str(b.text, LIMITS.text);
  if (subject.length < 3) return { ok: false, error: "Subject required", code: "SUBJECT_REQUIRED" };
  if (!text) return { ok: false, error: "Message required", code: "TEXT_REQUIRED" };
  const category = CATEGORIES.includes(String(b.category)) ? String(b.category) : "other";
  return { ok: true, value: { subject, text, category, clientId: cleanClientId(b.clientId) } };
}

function createTicket({ id, storeId, by, value, msgId, now = new Date() }) {
  const at = now.toISOString();
  return {
    id, storeId: String(storeId), subject: value.subject, category: value.category, status: "open", clientId: value.clientId,
    by: { userId: by && by.userId ? String(by.userId) : null, role: by && by.role ? String(by.role) : "" },
    messages: [{ id: msgId, from: "store", text: value.text, at, clientId: value.clientId, by: by && by.name ? str(by.name, 60) : "" }],
    unreadAdmin: 1, unreadStore: 0, createdAt: at, updatedAt: at, lastMessageAt: at,
  };
}

/** Append a message; duplicate clientId => returns the existing one. side: "store" | "admin". */
function addMessage(t, { side, text, clientId, id, by = "", now = new Date() }) {
  const body = str(text, LIMITS.text);
  if (!body) return { ok: false, status: 400, error: "Message required", code: "TEXT_REQUIRED" };
  const cid = cleanClientId(clientId);
  if (cid) {
    const dup = t.messages.find((m) => m.clientId === cid && m.from === side);
    if (dup) return { ok: true, message: dup, duplicate: true };
  }
  if (t.status === "closed" && side === "store") return { ok: false, status: 409, error: "Ticket is closed", code: "TICKET_CLOSED" };
  if (t.messages.length >= LIMITS.messages) return { ok: false, status: 409, error: "Conversation is full, open a new ticket", code: "TICKET_FULL" };
  const at = now.toISOString();
  const m = { id, from: side, text: body, at, clientId: cid, by: str(by, 60) };
  t.messages.push(m);
  t.lastMessageAt = at; t.updatedAt = at;
  if (side === "store") { t.unreadAdmin = (t.unreadAdmin || 0) + 1; if (t.status === "answered") t.status = "open"; }
  else { t.unreadStore = (t.unreadStore || 0) + 1; if (t.status !== "closed") t.status = "answered"; }
  return { ok: true, message: m };
}

function setStatus(t, status, { side, now = new Date() } = {}) {
  if (!STATUSES.includes(status)) return { ok: false, status: 400, error: "Invalid status", code: "INVALID_STATUS" };
  if (side === "store" && status !== "closed") return { ok: false, status: 403, error: "Forbidden" }; // a store may only close its own ticket
  t.status = status; t.updatedAt = now.toISOString();
  return { ok: true };
}

function markRead(t, side) { if (side === "admin") t.unreadAdmin = 0; else t.unreadStore = 0; }

/** Messages after `afterId` (incremental polling). Unknown id => full thread + reset:true. */
function messagesAfter(t, afterId) {
  if (!afterId) return { messages: t.messages, reset: false };
  const i = t.messages.findIndex((m) => String(m.id) === String(afterId));
  return i < 0 ? { messages: t.messages, reset: true } : { messages: t.messages.slice(i + 1), reset: false };
}

const last = (t) => t.messages[t.messages.length - 1] || null;
function summary(t, side, store) {
  const l = last(t);
  return {
    id: t.id, subject: t.subject, category: t.category, status: t.status, createdAt: t.createdAt, lastMessageAt: t.lastMessageAt,
    unread: side === "admin" ? t.unreadAdmin || 0 : t.unreadStore || 0,
    preview: l ? str(l.text, 120) : "", lastFrom: l ? l.from : null, count: t.messages.length,
    ...(side === "admin" ? { storeId: t.storeId, storeName: store ? store.name : null, by: t.by } : {}),
  };
}

module.exports = {
  KINDS, AUDIENCES, CATEGORIES, STATUSES, LIMITS,
  normalizeValue, hrefFor, validateChannel, publicChannels, upsertChannel, reorder,
  newTicketId, isTicketId, cleanClientId, validateTicket, createTicket, addMessage, setStatus, markRead, messagesAfter, summary,
};

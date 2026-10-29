"use strict";
/**
 * Support between stores and the admin panel.
 *   store:  GET  /api/store/support/channels                 approved contact channels (enabled + addressed to stores)
 *           GET/POST /api/store/support/tickets              own tickets / open a ticket
 *           GET  /api/store/support/tickets/:id?after=       thread (incremental), marks it read for the store
 *           POST /api/store/support/tickets/:id/messages     reply (idempotent by clientId)
 *           POST /api/store/support/tickets/:id/close
 *   admin:  /api/admin/support-channels[...]                 manage contact channels (support.use read, support.manage write)
 *           /api/admin/store-support/*                       tickets of all stores (support.use)
 * Authorisation: store routes go through requireStore(perm) (membership + role re-read per request, every resource is
 * filtered by the caller's store id); admin routes are authorised by lib/admin-roles.js in requireAdmin.
 */
const X = require("./support");

function registerSupportRoutes(app, d) {
  const { requireStore, requireAdmin, readJson, writeJson, loadRestaurants, makeId, appendAuditLog = () => {}, channelsFile, ticketsFile } = d;

  const loadCh = () => { const j = readJson(channelsFile, { channels: [] }); return Array.isArray(j.channels) ? j : { channels: [] }; };
  const saveCh = (j) => writeJson(channelsFile, j);
  const loadTk = () => { const j = readJson(ticketsFile, { tickets: [] }); return Array.isArray(j.tickets) ? j : { tickets: [] }; };
  const saveTk = (j) => writeJson(ticketsFile, j);
  const storeOf = (id) => (loadRestaurants().restaurants || []).find((r) => String(r.id) === String(id)) || null;
  const unique = (prefix) => { const ids = new Set(loadTk().tickets.map((t) => t.id)); for (let i = 0; i < 6; i++) { const id = X.newTicketId(); if (!ids.has(id)) return id; } return X.newTicketId(Math.random, () => Date.now() + Math.floor(Math.random() * 1e6)); };

  /* ================= store side ================= */

  app.get("/api/store/support/channels", requireStore("support.use"), (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, channels: X.publicChannels(loadCh().channels, "stores") });
  });

  app.get("/api/store/support/tickets", requireStore("support.use"), (req, res) => {
    const mine = loadTk().tickets.filter((t) => String(t.storeId) === String(req.storeId))
      .sort((a, b) => String(b.lastMessageAt).localeCompare(String(a.lastMessageAt)));
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, tickets: mine.map((t) => X.summary(t, "store")), unread: mine.reduce((n, t) => n + (t.unreadStore || 0), 0) });
  });

  app.post("/api/store/support/tickets", requireStore("support.use"), (req, res) => {
    const v = X.validateTicket(req.body);
    if (!v.ok) return res.status(400).json({ error: v.error, code: v.code });
    const data = loadTk();
    if (v.value.clientId) {
      const dup = data.tickets.find((t) => String(t.storeId) === String(req.storeId) && t.clientId === v.value.clientId);
      if (dup) return res.json({ ok: true, duplicate: true, ticket: X.summary(dup, "store") });
    }
    const open = data.tickets.filter((t) => String(t.storeId) === String(req.storeId) && t.status !== "closed").length;
    if (open >= X.LIMITS.openPerStore) return res.status(429).json({ error: "Too many open tickets, wait for an answer or close one", code: "TOO_MANY_OPEN" });
    const t = X.createTicket({ id: unique(), storeId: req.storeId, by: { userId: req.storeUserId, role: req.storeRole, name: req.store && req.store.name && (req.store.name.ar || req.store.name.en) }, value: v.value, msgId: makeId() });
    data.tickets.unshift(t);
    saveTk(data);
    appendAuditLog({ actorType: "store", actorId: String(req.storeUserId || ""), action: "support.ticket.create", ticketId: t.id, storeId: String(req.storeId) });
    res.status(201).json({ ok: true, ticket: X.summary(t, "store") });
  });

  const mineById = (data, req) => data.tickets.find((t) => t.id === String(req.params.id) && String(t.storeId) === String(req.storeId));

  app.get("/api/store/support/tickets/:id", requireStore("support.use"), (req, res) => {
    const data = loadTk(); const t = mineById(data, req);
    if (!t) return res.status(404).json({ error: "Not found" });
    const { messages, reset } = X.messagesAfter(t, String(req.query.after || ""));
    const had = t.unreadStore || 0;
    if (had) { X.markRead(t, "store"); saveTk(data); }
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, ticket: X.summary(t, "store"), messages: messages.map(storeMsg), reset, lastId: t.messages.length ? t.messages[t.messages.length - 1].id : null });
  });
  const storeMsg = (m) => ({ id: m.id, from: m.from, text: m.text, at: m.at, by: m.from === "admin" ? "" : m.by || "" }); // admin staff names are not exposed to stores

  app.post("/api/store/support/tickets/:id/messages", requireStore("support.use"), (req, res) => {
    const data = loadTk(); const t = mineById(data, req);
    if (!t) return res.status(404).json({ error: "Not found" });
    const r = X.addMessage(t, { side: "store", text: req.body && req.body.text, clientId: req.body && req.body.clientId, id: makeId(), by: req.store && req.store.name && (req.store.name.ar || req.store.name.en) });
    if (!r.ok) return res.status(r.status).json({ error: r.error, code: r.code });
    if (!r.duplicate) saveTk(data);
    res.json({ ok: true, message: storeMsg(r.message), duplicate: !!r.duplicate });
  });

  app.post("/api/store/support/tickets/:id/close", requireStore("support.use"), (req, res) => {
    const data = loadTk(); const t = mineById(data, req);
    if (!t) return res.status(404).json({ error: "Not found" });
    if (t.status !== "closed") { X.setStatus(t, "closed", { side: "store" }); saveTk(data); }
    res.json({ ok: true, ticket: X.summary(t, "store") });
  });

  /* ================= admin side: channels ================= */

  app.get("/api/admin/support-channels", requireAdmin, (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, channels: loadCh().channels.slice().sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0)), kinds: X.KINDS, audiences: X.AUDIENCES });
  });

  const adminActor = (req) => ({ actorType: "admin", actorId: String(req.adminId || ""), role: req.adminRole });

  app.post("/api/admin/support-channels", requireAdmin, (req, res) => {
    const v = X.validateChannel(req.body);
    if (!v.ok) return res.status(400).json({ error: v.error, code: v.code });
    const data = loadCh();
    const r = X.upsertChannel(data.channels, null, v.value, makeId());
    if (!r.ok) return res.status(r.status).json({ error: r.error, code: r.code });
    saveCh({ channels: r.list });
    appendAuditLog({ ...adminActor(req), action: "support.channel.create", channelId: r.channel.id, kind: r.channel.kind });
    res.status(201).json({ ok: true, channel: r.channel });
  });

  app.post("/api/admin/support-channels/reorder", requireAdmin, (req, res) => {
    const data = loadCh();
    saveCh({ channels: X.reorder(data.channels, req.body && req.body.ids) });
    appendAuditLog({ ...adminActor(req), action: "support.channel.reorder" });
    res.json({ ok: true });
  });

  app.put("/api/admin/support-channels/:id", requireAdmin, (req, res) => {
    const v = X.validateChannel(req.body);
    if (!v.ok) return res.status(400).json({ error: v.error, code: v.code });
    const data = loadCh();
    if (data.channels.some((c) => String(c.id) !== String(req.params.id) && c.kind === v.value.kind && c.value === v.value.value))
      return res.status(409).json({ error: "This channel already exists", code: "DUPLICATE" });
    const r = X.upsertChannel(data.channels, req.params.id, v.value, null);
    if (!r.ok) return res.status(r.status).json({ error: r.error });
    saveCh({ channels: r.list });
    appendAuditLog({ ...adminActor(req), action: "support.channel.update", channelId: String(req.params.id) });
    res.json({ ok: true, channel: r.channel });
  });

  app.delete("/api/admin/support-channels/:id", requireAdmin, (req, res) => {
    const data = loadCh();
    const i = data.channels.findIndex((c) => String(c.id) === String(req.params.id));
    if (i < 0) return res.status(404).json({ error: "Not found" });
    data.channels.splice(i, 1);
    saveCh(data);
    appendAuditLog({ ...adminActor(req), action: "support.channel.delete", channelId: String(req.params.id) });
    res.json({ ok: true });
  });

  /* ================= admin side: tickets ================= */

  app.get("/api/admin/store-support/summary", requireAdmin, (req, res) => {
    const all = loadTk().tickets;
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, unread: all.reduce((n, t) => n + (t.unreadAdmin || 0), 0), awaiting: all.filter((t) => t.status === "open").length });
  });

  app.get("/api/admin/store-support/tickets", requireAdmin, (req, res) => {
    const status = String(req.query.status || ""), storeId = String(req.query.storeId || ""), q = String(req.query.q || "").trim().toLowerCase();
    const stores = new Map((loadRestaurants().restaurants || []).map((r) => [String(r.id), r]));
    let list = loadTk().tickets;
    if (X.STATUSES.includes(status)) list = list.filter((t) => t.status === status);
    if (storeId) list = list.filter((t) => String(t.storeId) === storeId);
    if (q) list = list.filter((t) => (t.id + " " + t.subject + " " + ((stores.get(String(t.storeId)) || {}).name ? Object.values(stores.get(String(t.storeId)).name).join(" ") : "")).toLowerCase().includes(q));
    list = list.slice().sort((a, b) => (b.unreadAdmin > 0) - (a.unreadAdmin > 0) || String(b.lastMessageAt).localeCompare(String(a.lastMessageAt)));
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, tickets: list.slice(0, 200).map((t) => X.summary(t, "admin", stores.get(String(t.storeId)))), unread: loadTk().tickets.reduce((n, t) => n + (t.unreadAdmin || 0), 0) });
  });

  app.get("/api/admin/store-support/tickets/:id", requireAdmin, (req, res) => {
    const data = loadTk(); const t = data.tickets.find((x) => x.id === String(req.params.id));
    if (!t) return res.status(404).json({ error: "Not found" });
    const { messages, reset } = X.messagesAfter(t, String(req.query.after || ""));
    if (t.unreadAdmin) { X.markRead(t, "admin"); saveTk(data); }
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, ticket: X.summary(t, "admin", storeOf(t.storeId)), messages, reset, lastId: t.messages.length ? t.messages[t.messages.length - 1].id : null });
  });

  app.post("/api/admin/store-support/tickets/:id/messages", requireAdmin, (req, res) => {
    const data = loadTk(); const t = data.tickets.find((x) => x.id === String(req.params.id));
    if (!t) return res.status(404).json({ error: "Not found" });
    const r = X.addMessage(t, { side: "admin", text: req.body && req.body.text, clientId: req.body && req.body.clientId, id: makeId(), by: req.adminRole || "admin" });
    if (!r.ok) return res.status(r.status).json({ error: r.error, code: r.code });
    if (!r.duplicate) { saveTk(data); appendAuditLog({ ...adminActor(req), action: "support.ticket.reply", ticketId: t.id }); }
    res.json({ ok: true, message: r.message, duplicate: !!r.duplicate });
  });

  app.post("/api/admin/store-support/tickets/:id/status", requireAdmin, (req, res) => {
    const data = loadTk(); const t = data.tickets.find((x) => x.id === String(req.params.id));
    if (!t) return res.status(404).json({ error: "Not found" });
    const r = X.setStatus(t, String(req.body && req.body.status), { side: "admin" });
    if (!r.ok) return res.status(r.status).json({ error: r.error, code: r.code });
    saveTk(data);
    appendAuditLog({ ...adminActor(req), action: "support.ticket.status", ticketId: t.id, status: t.status });
    res.json({ ok: true, ticket: X.summary(t, "admin", storeOf(t.storeId)) });
  });
}

module.exports = { registerSupportRoutes };

"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { world, TOK, H } = require("./store-world");

const ADM = { headers: { "X-Admin": "1" } };
const owner = (store = "g1") => H(TOK(["u-own"]), store);
const cashier = () => H(TOK(["u-cash"]), "g1");
const CH = { kind: "whatsapp", label: { ar: "دعم المتاجر", fr: "Support", en: "Support" }, value: "+212 612-345678", audience: ["stores"], hours: "9-18" };

test("admin manages channels; store sees ONLY enabled ones addressed to stores, with server-built links", async () => {
  const w = world();
  const a = await w.call("POST", "/api/admin/support-channels", { ...ADM, body: CH });
  assert.equal(a.status, 201); assert.equal(a.body.channel.value, "+212612345678");
  await w.call("POST", "/api/admin/support-channels", { ...ADM, body: { kind: "phone", label: "Drivers line", value: "0600000001", audience: ["drivers"] } });
  const off = await w.call("POST", "/api/admin/support-channels", { ...ADM, body: { kind: "email", label: "Mail", value: "s@siymon7.com", audience: ["stores"], enabled: false } });
  const st = await w.call("GET", "/api/store/support/channels", { headers: owner() });
  assert.deepEqual(st.body.channels.map((c) => c.href), ["https://wa.me/212612345678"]);
  assert.ok(!("audience" in st.body.channels[0]) && !("enabled" in st.body.channels[0]));
  // enable the email + edit the whatsapp number => the store sees the change at once
  await w.call("PUT", "/api/admin/support-channels/" + off.body.channel.id, { ...ADM, body: { ...off.body.channel, enabled: true } });
  await w.call("PUT", "/api/admin/support-channels/" + a.body.channel.id, { ...ADM, body: { ...CH, value: "0611111111" } });
  const st2 = await w.call("GET", "/api/store/support/channels", { headers: owner("g1") });
  assert.equal(st2.body.channels.length, 2);
  assert.ok(st2.body.channels.some((c) => c.value === "0611111111"));
  // delete
  assert.equal((await w.call("DELETE", "/api/admin/support-channels/" + a.body.channel.id, ADM)).status, 200);
  assert.equal((await w.call("GET", "/api/store/support/channels", { headers: owner() })).body.channels.length, 1);
  assert.equal((await w.call("POST", "/api/admin/support-channels", { ...ADM, body: { kind: "phone", label: "x", value: "bad" } })).status, 400);
  assert.equal(w.audits.filter((x) => String(x.action).startsWith("support.channel")).length >= 4, true, "changes are audited");
});

test("channels: not reachable without admin / store login", async () => {
  const w = world();
  assert.equal((await w.call("POST", "/api/admin/support-channels", { headers: {}, body: CH })).status, 401);
  assert.equal((await w.call("GET", "/api/store/support/channels", { headers: {} })).status, 401);
});

test("store opens a ticket: unique number, idempotent by clientId, open limit, visible to admin", async () => {
  const w = world();
  const mk = (extra = {}) => w.call("POST", "/api/store/support/tickets", { headers: owner(), body: { subject: "Payout missing", text: "Where is my payout?", category: "payments", ...extra } });
  assert.equal((await w.call("POST", "/api/store/support/tickets", { headers: owner(), body: { subject: "x", text: "" } })).status, 400);
  const a = await mk({ clientId: "client-12345" });
  assert.equal(a.status, 201); assert.match(a.body.ticket.id, /^TK-[A-Z0-9]{8}$/);
  const b = await mk({ clientId: "client-12345" });
  assert.equal(b.body.duplicate, true); assert.equal(b.body.ticket.id, a.body.ticket.id); assert.equal(w.files.supt.tickets.length, 1);
  for (let i = 0; i < 4; i++) assert.equal((await mk()).status, 201);
  assert.equal((await mk()).status, 429);
  const list = await w.call("GET", "/api/admin/store-support/tickets", ADM);
  assert.equal(list.body.tickets.length, 5); assert.equal(list.body.unread, 5);
  assert.equal(list.body.tickets[0].storeId, "g1");
  assert.equal((await w.call("GET", "/api/admin/store-support/summary", ADM)).body.awaiting, 5);
});

test("tenant isolation: a store never sees or writes another store's ticket", async () => {
  const w = world();
  const t = await w.call("POST", "/api/store/support/tickets", { headers: owner("g1"), body: { subject: "Mine only", text: "secret" } });
  const id = t.body.ticket.id;
  const other = H(TOK(["u-own2"]), "r1"); // same person owns another store
  assert.equal((await w.call("GET", "/api/store/support/tickets/" + id, { headers: other })).status, 404);
  assert.equal((await w.call("POST", "/api/store/support/tickets/" + id + "/messages", { headers: other, body: { text: "x" } })).status, 404);
  assert.equal((await w.call("POST", "/api/store/support/tickets/" + id + "/close", { headers: other })).status, 404);
  assert.equal((await w.call("GET", "/api/store/support/tickets", { headers: other })).body.tickets.length, 0);
  assert.equal((await w.call("GET", "/api/store/support/tickets/" + id, { headers: owner("p1") })).status, 403, "not a member of that store at all");
});

test("conversation: admin replies, store reads incrementally, unread counters, retry never duplicates", async () => {
  const w = world();
  const id = (await w.call("POST", "/api/store/support/tickets", { headers: owner(), body: { subject: "Need help", text: "Hello" } })).body.ticket.id;
  const first = await w.call("GET", "/api/admin/store-support/tickets/" + id, ADM);
  assert.equal(first.body.messages.length, 1); assert.equal(first.body.ticket.unread, 0, "opening marks it read for the admin");
  const r1 = await w.call("POST", "/api/admin/store-support/tickets/" + id + "/messages", { ...ADM, body: { text: "We are on it", clientId: "adm-123456" } });
  assert.equal(r1.status, 200);
  assert.equal((await w.call("POST", "/api/admin/store-support/tickets/" + id + "/messages", { ...ADM, body: { text: "We are on it", clientId: "adm-123456" } })).body.duplicate, true);
  const lst = await w.call("GET", "/api/store/support/tickets", { headers: owner() });
  assert.equal(lst.body.unread, 1); assert.equal(lst.body.tickets[0].status, "answered");
  const th = await w.call("GET", "/api/store/support/tickets/" + id, { headers: owner() });
  assert.equal(th.body.messages.length, 2); assert.equal(th.body.messages[1].by, "", "staff identity is not shown to stores");
  assert.equal((await w.call("GET", "/api/store/support/tickets", { headers: owner() })).body.unread, 0);
  const inc = await w.call("GET", "/api/store/support/tickets/" + id, { headers: owner(), query: { after: th.body.lastId } });
  assert.equal(inc.body.messages.length, 0);
  // store replies twice with the same clientId (lost response) => one message
  const body = { text: "Thank you", clientId: "store-aaaaaa" };
  await w.call("POST", "/api/store/support/tickets/" + id + "/messages", { headers: owner(), body });
  const dup = await w.call("POST", "/api/store/support/tickets/" + id + "/messages", { headers: owner(), body });
  assert.equal(dup.body.duplicate, true);
  const th2 = await w.call("GET", "/api/admin/store-support/tickets/" + id, ADM);
  assert.equal(th2.body.messages.length, 3); assert.equal(th2.body.ticket.status, "open");
});

test("close / reopen: store can only close; closed tickets refuse store messages; admin can reopen", async () => {
  const w = world();
  const id = (await w.call("POST", "/api/store/support/tickets", { headers: owner(), body: { subject: "Close me", text: "hi" } })).body.ticket.id;
  assert.equal((await w.call("POST", "/api/store/support/tickets/" + id + "/close", { headers: cashier() })).body.ticket.status, "closed");
  const m = await w.call("POST", "/api/store/support/tickets/" + id + "/messages", { headers: owner(), body: { text: "again?" } });
  assert.equal(m.status, 409); assert.equal(m.body.code, "TICKET_CLOSED");
  assert.equal((await w.call("POST", "/api/admin/store-support/tickets/" + id + "/status", { ...ADM, body: { status: "bogus" } })).status, 400);
  assert.equal((await w.call("POST", "/api/admin/store-support/tickets/" + id + "/status", { ...ADM, body: { status: "open" } })).body.ticket.status, "open");
  assert.equal((await w.call("POST", "/api/store/support/tickets/" + id + "/messages", { headers: owner(), body: { text: "thanks" } })).status, 200);
  // admin list filters
  assert.equal((await w.call("GET", "/api/admin/store-support/tickets", { ...ADM, query: { status: "closed" } })).body.tickets.length, 0);
  assert.equal((await w.call("GET", "/api/admin/store-support/tickets", { ...ADM, query: { q: "close me" } })).body.tickets.length, 1);
});

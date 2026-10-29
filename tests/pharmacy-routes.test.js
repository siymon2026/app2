"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { world, TOK, H } = require("./store-world");

const IMG = "data:image/jpeg;base64,/9j/4AAQ";
const CUST = { name: "Ali", phone: "0611111111", addr: "Rabat, Agdal", lat: 34.02, lng: -6.84 };
const C = (id) => ({ headers: { "X-Cust": id } });
const ph = () => H(TOK(["u-ph"]), "p1");

async function createReq(w, cid = "c1", extra = {}) {
  const r = await w.call("POST", "/api/customer/pharmacy/requests", { ...C(cid), body: { storeId: "p1", text: "Doliprane 1000", customer: CUST, ...extra } });
  return r;
}
const QUOTE = { available: true, lines: [{ name: "Doliprane 1000mg", qty: 2, price: 12.5 }, { name: "Vitamine C", qty: 1, price: 30 }], validMinutes: 30 };

test("customer creates a request: unique number, not an order, pharmacist gets a message + pending count", async () => {
  const w = world();
  const r = await createReq(w);
  assert.equal(r.status, 201);
  assert.match(r.body.request.id, /^PH-[A-Z0-9]{8}$/);
  assert.equal(r.body.request.status, "pending");
  assert.equal(w.orderLog.length, 0, "no order exists yet");
  assert.equal(w.files.orders.orders.some((o) => o.pharmacyRequestId), false);
  const st = await w.call("GET", "/api/store/stats", { headers: ph() });
  assert.equal(st.body.stats.pendingPharmacy, 1);
  assert.equal(st.body.stats.unreadMessages, 1);
  const chats = await w.call("GET", "/api/store/chats", { headers: ph() });
  assert.equal(chats.body.chats.length, 1);
  assert.equal(chats.body.chats[0].customerName, "Ali");
  const list = await w.call("GET", "/api/store/pharmacy/requests", { headers: ph() });
  assert.equal(list.body.requests.length, 1);
  assert.equal(list.body.requests[0].customer.phone, "0611111111"); // owner may contact customers
  w.files.users.users.push({ id: "u-phc", restaurantId: "p1", role: "cashier", phone: "0600000077", password: "pw", isActive: true });
  const cl = await w.call("GET", "/api/store/pharmacy/requests", { headers: H(TOK(["u-phc"]), "p1") });
  assert.equal(cl.body.requests[0].customer.phone.includes("0611"), false, "cashier sees a masked phone");
});

test("validation + only pharmacies accept requests + idempotent clientId + open-request limit", async () => {
  const w = world();
  assert.equal((await w.call("POST", "/api/customer/pharmacy/requests", { ...C("c1"), body: { storeId: "p1", customer: CUST } })).status, 400);
  assert.equal((await w.call("POST", "/api/customer/pharmacy/requests", { ...C("c1"), body: { storeId: "g1", text: "x", customer: CUST } })).status, 404); // grocery
  assert.equal((await w.call("POST", "/api/customer/pharmacy/requests", { headers: {}, body: { storeId: "p1", text: "x", customer: CUST } })).status, 401);
  const a = await createReq(w, "c1", { clientId: "client-123456" });
  const b = await createReq(w, "c1", { clientId: "client-123456" });
  assert.equal(b.body.duplicate, true);
  assert.equal(b.body.request.id, a.body.request.id);
  assert.equal(w.files.pharm.requests.length, 1);
  for (let i = 0; i < 4; i++) assert.equal((await createReq(w)).status, 201);
  assert.equal((await createReq(w)).status, 429);
  assert.equal((await createReq(w, "c2")).status, 201); // limit is per customer
});

test("prescription: private, owner customer + this pharmacy only, bad files refused, view audited", async () => {
  const w = world();
  const bad = await createReq(w, "c1", { text: "", prescription: "data:text/html;base64,PHNjcmlwdD4=" });
  assert.equal(bad.status, 400);
  const r = await createReq(w, "c1", { text: "", prescription: IMG });
  assert.equal(r.status, 201);
  assert.equal(r.body.request.hasPrescription, true);
  const id = r.body.request.id;
  assert.equal(JSON.stringify(r.body).includes(".jpg"), false, "file name never exposed");
  assert.equal((await w.call("GET", `/api/customer/pharmacy/requests/${id}/prescription`, C("c1"))).status, 200);
  assert.equal((await w.call("GET", `/api/customer/pharmacy/requests/${id}/prescription`, C("c2"))).status, 404);
  const sr = await w.call("GET", `/api/store/pharmacy/requests/${id}/prescription`, { headers: ph() });
  assert.equal(sr.status, 200);
  assert.equal(sr.headers["cache-control"], "private, no-store");
  assert.equal(sr.headers["x-content-type-options"], "nosniff");
  assert.ok(w.audits.some((a) => a.action === "pharmacy.prescription.view" && a.requestId === id));
  // another pharmacy's staff / a grocery's staff cannot see it
  w.files.restaurants.restaurants.push({ id: "p2", name: { ar: "ص2" }, type: "pharmacy", isActive: true });
  w.files.users.users.push({ id: "u-p2", restaurantId: "p2", role: "owner", phone: "0600000009", password: "pw", isActive: true });
  assert.equal((await w.call("GET", `/api/store/pharmacy/requests/${id}/prescription`, { headers: H(TOK(["u-p2"]), "p2") })).status, 404);
  assert.equal((await w.call("GET", `/api/store/pharmacy/requests/${id}`, { headers: H(TOK(["u-p2"]), "p2") })).status, 404);
  assert.equal((await w.call("GET", `/api/store/pharmacy/requests/${id}/prescription`, { headers: H(TOK(["u-cash"]), "g1") })).status, 404);
  assert.equal((await w.call("GET", "/api/store/pharmacy/requests", { headers: H(TOK(["u-cash"]), "g1") })).status, 404);
});

test("full cycle: request -> quote -> customer sees price -> accept -> order (not before)", async () => {
  const w = world();
  const id = (await createReq(w)).body.request.id;
  // nothing to accept yet
  assert.equal((await w.call("POST", `/api/customer/pharmacy/requests/${id}/accept`, { ...C("c1"), body: {} })).status, 409);
  // pharmacist quotes
  const q = await w.call("POST", `/api/store/pharmacy/requests/${id}/quote`, { headers: ph(), body: QUOTE });
  assert.equal(q.status, 200);
  assert.equal(q.body.request.status, "quoted");
  assert.equal(q.body.request.quote.medicinesTotal, 55);
  assert.equal(w.notes.filter((n) => n.type === "pharmacy_quote").length, 1);
  // customer sees availability, price and the server-computed delivery/total
  const d = await w.call("GET", `/api/customer/pharmacy/requests/${id}`, C("c1"));
  assert.equal(d.body.request.canAccept, true);
  assert.equal(d.body.request.delivery.fee, 10);
  assert.equal(d.body.request.total, 65);
  assert.equal(w.orderLog.length, 0, "still no order / nothing for drivers");
  // wrong customer cannot accept; stale price refused
  assert.equal((await w.call("POST", `/api/customer/pharmacy/requests/${id}/accept`, { ...C("c2"), body: {} })).status, 404);
  const stale = await w.call("POST", `/api/customer/pharmacy/requests/${id}/accept`, { ...C("c1"), body: { expectTotal: 50 } });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.code, "PRICE_CHANGED");
  assert.equal((await w.call("POST", `/api/customer/pharmacy/requests/${id}/accept`, { ...C("c1"), body: { paymentMethod: "visa" } })).status, 400);
  // accept (double tap = one order)
  const ok = await w.call("POST", `/api/customer/pharmacy/requests/${id}/accept`, { ...C("c1"), body: { expectTotal: 65 } });
  const again = await w.call("POST", `/api/customer/pharmacy/requests/${id}/accept`, { ...C("c1"), body: { expectTotal: 65 } });
  assert.equal(ok.status, 200);
  assert.equal(again.body.already, true);
  assert.equal(again.body.orderId, ok.body.orderId);
  assert.equal(w.orderLog.length, 1);
  const o = w.files.orders.orders.find((x) => x.id === ok.body.orderId);
  assert.equal(o.total, 65);
  assert.equal(o.pharmacyRequestId, id);
  assert.equal(o.status, "admin_accepted"); // goes to the store, then ready -> existing dispatch
  // the order shows up in the pharmacy's normal orders list, as "preparing"
  const orders = await w.call("GET", "/api/store/orders", { headers: ph() });
  assert.ok(orders.body.orders.some((x) => x.id === o.id && x.stage === "preparing"));
  // pharmacist can mark it ready through the normal store flow -> driver dispatch hook
  const ready = await w.call("PATCH", `/api/store/orders/${o.id}`, { headers: ph(), body: { action: "ready" } });
  assert.equal(ready.status, 200);
  assert.ok(w.notes.some((n) => n.ready === o.id));
  // closed requests cannot be re-quoted
  assert.equal((await w.call("POST", `/api/store/pharmacy/requests/${id}/quote`, { headers: ph(), body: QUOTE })).status, 409);
  assert.equal((await w.call("GET", "/api/store/stats", { headers: ph() })).body.stats.pendingPharmacy, 0);
});

test("unavailable answer ends the request and never creates an order; decline/cancel work and are final", async () => {
  const w = world();
  const a = (await createReq(w)).body.request.id;
  assert.equal((await w.call("POST", `/api/store/pharmacy/requests/${a}/quote`, { headers: ph(), body: { available: false } })).status, 400); // reason needed
  assert.equal((await w.call("POST", `/api/store/pharmacy/requests/${a}/quote`, { headers: ph(), body: { available: false, reason: "Rupture de stock" } })).status, 200);
  const da = await w.call("GET", `/api/customer/pharmacy/requests/${a}`, C("c1"));
  assert.equal(da.body.request.status, "unavailable");
  assert.equal(da.body.request.quote.reason, "Rupture de stock");
  assert.equal((await w.call("POST", `/api/customer/pharmacy/requests/${a}/accept`, { ...C("c1"), body: {} })).status, 409);
  const b = (await createReq(w)).body.request.id;
  await w.call("POST", `/api/store/pharmacy/requests/${b}/quote`, { headers: ph(), body: QUOTE });
  assert.equal((await w.call("POST", `/api/customer/pharmacy/requests/${b}/decline`, { ...C("c1"), body: { reason: "trop cher" } })).status, 200);
  assert.equal((await w.call("POST", `/api/customer/pharmacy/requests/${b}/accept`, { ...C("c1"), body: {} })).status, 409);
  const c = (await createReq(w)).body.request.id;
  assert.equal((await w.call("POST", `/api/customer/pharmacy/requests/${c}/cancel`, C("c1"))).status, 200);
  assert.equal((await w.call("POST", `/api/store/pharmacy/requests/${c}/quote`, { headers: ph(), body: QUOTE })).status, 409);
  assert.equal(w.orderLog.length, 0);
});

test("expired offer cannot be accepted; routing failure blocks acceptance without creating an order", async () => {
  const w = world();
  const id = (await createReq(w)).body.request.id;
  await w.call("POST", `/api/store/pharmacy/requests/${id}/quote`, { headers: ph(), body: QUOTE });
  world.deliveryFail = true;
  const f = await w.call("POST", `/api/customer/pharmacy/requests/${id}/accept`, { ...C("c1"), body: {} });
  world.deliveryFail = false;
  assert.equal(f.status, 503);
  assert.equal(w.orderLog.length, 0);
  assert.equal(w.files.pharm.requests[0].status, "quoted", "still can be accepted later");
  w.files.pharm.requests[0].quote.expiresAt = new Date(Date.now() - 1000).toISOString();
  const e = await w.call("POST", `/api/customer/pharmacy/requests/${id}/accept`, { ...C("c1"), body: {} });
  assert.equal(e.status, 410); // offer expired
  assert.equal((await w.call("GET", `/api/customer/pharmacy/requests/${id}`, C("c1"))).body.request.status, "expired");
});

test("chat works on the request id for both sides; other customers cannot read it", async () => {
  const w = world();
  const id = (await createReq(w)).body.request.id;
  const sh = ph();
  assert.equal((await w.call("POST", `/api/store/chats/${id}`, { headers: sh, body: { text: "Quel dosage ?" } })).status, 200);
  const cm = await w.call("GET", `/api/customer/store-chats/${id}`, C("c1"));
  assert.equal(cm.body.messages.length, 2); // the request message + the pharmacist's question
  assert.equal((await w.call("POST", `/api/customer/store-chats/${id}`, { ...C("c1"), body: { text: "1000mg", clientId: "cid-123456" } })).status, 200);
  assert.equal((await w.call("GET", `/api/customer/store-chats/${id}`, C("c2"))).status, 404);
  assert.equal((await w.call("GET", `/api/store/chats/${id}`, { headers: H(TOK(["u-own"]), "g1") })).status, 404);
});

test("public list of pharmacies only contains pharmacies", async () => {
  const w = world();
  const r = await w.call("GET", "/api/pharmacy/stores", {});
  assert.deepEqual(r.body.stores.map((s) => s.id), ["p1"]);
});

test("sections: only pharmacy-type stores get the pharmacy section", async () => {
  const w = world();
  const p = await w.call("GET", "/api/store/me", { headers: ph() });
  assert.ok(p.body.sections.includes("pharmacy"));
  const g = await w.call("GET", "/api/store/me", { headers: H(TOK(["u-own"]), "g1") });
  assert.equal(g.body.sections.includes("pharmacy"), false);
});

"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const adminRoles = require("../lib/admin-roles");
const { registerFeedbackRoutes } = require("../lib/feedback-routes");
const support = require("../lib/support");

/* minimal express stand-in; auth is header driven: x-cust, x-drv, x-store, x-role */
function world() {
  const routes = [];
  const reg = (method) => (path, ...h) => routes.push({ method, path, h: h.flat() });
  const app = { get: reg("GET"), post: reg("POST"), put: reg("PUT"), delete: reg("DELETE") };
  const clock = { t: Date.parse("2026-10-27T12:00:00Z") };
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const hrs = (n) => new Date(clock.t - n * 3600e3).toISOString();
  const files = {
    orders: { orders: [
      { id: "o1", status: "delivered", restaurantId: "s1", driverId: "d1", customerId: "c1", customer: { name: "Ali Benjelloun", phone: "0611111111", address: "Rue 1" }, deliveredAt: hrs(2), createdAt: hrs(4) },
      { id: "o2", status: "delivered", restaurantId: "s2", driverId: "d2", customerId: "c2", customer: { name: "Sara K" }, deliveredAt: hrs(2), createdAt: hrs(4) },
      { id: "o3", status: "on_the_way", restaurantId: "s1", driverId: "d1", customerId: "c1", customer: { name: "Ali" }, createdAt: hrs(1) },
      { id: "o4", status: "new", restaurantId: "s1", customerId: "c1", customer: { name: "Ali" }, createdAt: hrs(1) },
      { id: "o5", status: "delivered", restaurantId: "s1", customerId: "c1", customer: { name: "Ali" }, deliveredAt: hrs(2), createdAt: hrs(4) },
    ] },
    restaurants: { restaurants: [{ id: "s1", name: { ar: "متجر 1" } }, { id: "s2", name: { ar: "متجر 2" } }] },
    drivers: { drivers: [{ id: "d1", name: "Driver One" }, { id: "d2", name: "Driver Two" }] },
    fb: { complaints: [], settings: {} },
    channels: { channels: [
      { id: "ch1", kind: "phone", label: { ar: "هاتف" }, value: "+212600000000", audience: ["customers"], enabled: true },
      { id: "ch2", kind: "email", label: { ar: "بريد" }, value: "stores@x.com", audience: ["stores"], enabled: true },
    ] },
  };
  const audits = [], notes = [], caseLog = [];
  const exceptions = {
    openCase: (i) => { const id = "EX-" + (caseLog.length + 1); caseLog.push({ op: "open", id, ...i }); return { ok: true, case: { id } }; },
    resolveCase: (id, i) => { caseLog.push({ op: "resolve", id, ...i }); return { ok: true }; },
  };
  const requireCustomer = (req, res, next) => { const c = req.header("x-cust"); if (!c) return res.status(401).json({ error: "Unauthorized" }); req.customerId = c; next(); };
  const requireDriver = (req, res, next) => { const c = req.header("x-drv"); if (!c) return res.status(401).json({ error: "Unauthorized" }); req.driverId = c; next(); };
  const requireStore = () => (req, res, next) => { const c = req.header("x-store"); if (!c) return res.status(401).json({ error: "Unauthorized" }); req.storeId = c; req.storeUserId = "u-" + c; req.store = { name: { ar: "متجر " + c } }; next(); };
  const requireAdmin = (req, res, next) => {
    const role = req.header("x-role"); if (!role) return res.status(401).json({ error: "Unauthorized" });
    const a = adminRoles.authorize(role, req.method, req.originalUrl);
    if (!a.ok) return res.status(a.status).json({ error: a.error });
    req.adminRole = role; req.adminId = "adm-" + role; next();
  };
  const api = registerFeedbackRoutes(app, {
    requireCustomer, requireDriver, requireStore, requireAdmin,
    loadOrders: () => clone(files.orders), saveOrders: (v) => { files.orders = clone(v); },
    loadRestaurants: () => clone(files.restaurants), loadDrivers: () => clone(files.drivers),
    readJson: (f, fb) => (f === "fb" ? clone(files.fb) : f === "channels" ? clone(files.channels) : fb), writeJson: (f, v) => { if (f === "fb") files.fb = clone(v); },
    file: "fb", ownsOrder: (req, o) => String(o.customerId) === String(req.customerId),
    appendAuditLog: (e) => audits.push(e), adminRoles, notifyCustomer: (n) => notes.push(n), exceptions,
    channels: () => files.channels.channels, publicChannels: support.publicChannels, now: () => clock.t,
  });
  async function call(method, url, { as = {}, body = {}, query = {} } = {}) {
    const [pathOnly, qs] = url.split("?");
    const q = { ...Object.fromEntries(new URLSearchParams(qs || "")), ...query };
    for (const r of routes) {
      if (r.method !== method) continue;
      const rp = r.path.split("/"), up = pathOnly.split("/");
      if (rp.length !== up.length) continue;
      const params = {};
      if (!rp.every((seg, i) => (seg.startsWith(":") ? ((params[seg.slice(1)] = up[i]), true) : seg === up[i]))) continue;
      const hdr = Object.fromEntries(Object.entries(as).map(([k, v]) => [k.toLowerCase(), v]));
      const req = { params, body, query: q, method, originalUrl: url, header: (k) => hdr[k.toLowerCase()] };
      return await new Promise((resolve) => {
        const res = { code: 200, status(c) { this.code = c; return this; }, setHeader() {}, json(o) { resolve({ status: this.code, body: o }); } };
        let i = 0;
        const next = () => { const fn = r.h[i++]; if (fn) Promise.resolve(fn(req, res, next)).catch((e) => resolve({ status: 500, body: { error: String(e) } })); };
        next();
      });
    }
    throw new Error(`no route ${method} ${url}`);
  }
  return { call, files, audits, notes, caseLog, clock, api };
}
const C1 = { "x-cust": "c1" }, C2 = { "x-cust": "c2" };
const body = (o = {}) => ({ orderId: "o1", against: "store", category: "missing_items", text: "The fries were missing from my bag", clientId: "cl-000001", ...o });

/* ---------------- rating ---------------- */

test("rate store: stars count at once, comment pending; other customers / undelivered / bad stars are refused", async () => {
  const w = world();
  assert.equal((await w.call("POST", "/api/customer/orders/o1/rate", { body: { stars: 5 } })).status, 401);
  assert.equal((await w.call("POST", "/api/customer/orders/o1/rate", { as: C2, body: { stars: 5 } })).status, 403, "not your order");
  assert.equal((await w.call("POST", "/api/customer/orders/o3/rate", { as: C1, body: { stars: 5 } })).status, 409, "not delivered");
  assert.equal((await w.call("POST", "/api/customer/orders/o1/rate", { as: C1, body: { stars: 9 } })).status, 400);
  assert.equal((await w.call("POST", "/api/customer/orders/zzz/rate", { as: C1, body: { stars: 5 } })).status, 404);
  const ok = await w.call("POST", "/api/customer/orders/o1/rate", { as: C1, body: { stars: 4, comment: "tasty but late" } });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.rating.commentStatus, "pending");
  assert.equal(w.files.orders.orders[0].customerRating.stars, 4);
  w.clock.t += 8 * 86400e3;
  assert.equal((await w.call("POST", "/api/customer/orders/o1/rate", { as: C1, body: { stars: 1 } })).status, 410, "window closed");
});

test("moderation: comment is hidden from the store until a supervisor publishes it; decision is audited", async () => {
  const w = world();
  await w.call("POST", "/api/customer/orders/o1/rate", { as: C1, body: { stars: 4, comment: "tasty but late" } });
  const S1 = { "x-store": "s1" };
  let fb = await w.call("GET", "/api/store/feedback", { as: S1 });
  assert.deepEqual([fb.body.rating.count, fb.body.rating.avg, fb.body.reviews.length], [1, 4, 0]);

  const q = await w.call("GET", "/api/admin/feedback/moderation", { as: { "x-role": "support" } });
  assert.equal(q.body.items.length, 1);
  assert.equal(q.body.items[0].storeName, "متجر 1");
  assert.ok(!JSON.stringify(q.body).includes("0611111111"), "no phone in the queue");

  const noReason = await w.call("POST", "/api/admin/feedback/moderation", { as: { "x-role": "support" }, body: { orderId: "o1", kind: "store", decision: "reject" } });
  assert.equal(noReason.status, 400); assert.equal(noReason.body.code, "REASON_REQUIRED");
  const pub = await w.call("POST", "/api/admin/feedback/moderation", { as: { "x-role": "support" }, body: { orderId: "o1", kind: "store", decision: "publish" } });
  assert.equal(pub.status, 200);
  assert.equal(pub.body.item.moderation.by, "adm-support");
  fb = await w.call("GET", "/api/store/feedback", { as: S1 });
  assert.equal(fb.body.reviews.length, 1);
  assert.equal(fb.body.reviews[0].name, "Ali B.");
  assert.ok(w.audits.some((a) => a.action === "feedback.moderate" && a.next === "published" && a.actorId === "adm-support"));
  // the other store never sees it
  assert.equal((await w.call("GET", "/api/store/feedback", { as: { "x-store": "s2" } })).body.reviews.length, 0);
});

test("moderation permissions: accountant and driver supervisor are refused; anonymous is 401", async () => {
  const w = world();
  const b = { orderId: "o1", kind: "store", decision: "publish" };
  assert.equal((await w.call("GET", "/api/admin/feedback/moderation", { as: {} })).status, 401);
  for (const role of ["accountant", "driver_supervisor"]) {
    assert.equal((await w.call("GET", "/api/admin/feedback/moderation", { as: { "x-role": role } })).status, 403, role);
    assert.equal((await w.call("POST", "/api/admin/feedback/moderation", { as: { "x-role": role }, body: b })).status, 403, role);
  }
  assert.equal((await w.call("GET", "/api/admin/feedback/moderation", { as: { "x-role": "order_supervisor" } })).status, 200);
});

/* ---------------- complaints ---------------- */

test("filing: must be your own order, accepted, matching target; idempotent; one open per target", async () => {
  const w = world();
  const f = (b, as = C1) => w.call("POST", "/api/customer/complaints", { as, body: b });
  assert.equal((await f(body(), {})).status, 401);
  assert.equal((await f(body({ orderId: "o2" }))).status, 404, "someone else's order looks like it does not exist");
  assert.equal((await f(body({ orderId: "o4" }))).status, 409, "order not accepted yet");
  assert.equal((await f(body({ orderId: "o5", against: "driver", clientId: "cl-000009" }))).body.code, "NO_DRIVER");
  assert.equal((await f(body({ text: "short" }))).status, 400);
  const a = await f(body());
  assert.equal(a.status, 201);
  assert.equal(a.body.complaint.status, "with_party");
  assert.ok(/^CP-[A-Z0-9]{8}$/.test(a.body.complaint.id));
  const again = await f(body()); // same clientId (lost response / double tap)
  assert.equal(again.body.duplicate, true);
  assert.equal(w.files.fb.complaints.length, 1);
  const dup = await f(body({ clientId: "cl-000002" }));
  assert.equal(dup.status, 409); assert.equal(dup.body.code, "ALREADY_OPEN");
  assert.equal(w.notes.filter((n) => n.type === "complaint_filed").length, 1, "one notification per event");
});

test("routing: the store sees ONLY its own complaints, without customer identity; another store gets 404", async () => {
  const w = world();
  const id = (await w.call("POST", "/api/customer/complaints", { as: C1, body: body() })).body.complaint.id;
  await w.call("POST", "/api/customer/complaints", { as: C2, body: body({ orderId: "o2", clientId: "cl-000003" }) });
  const list = await w.call("GET", "/api/store/complaints", { as: { "x-store": "s1" } });
  assert.equal(list.body.complaints.length, 1);
  assert.equal(list.body.awaiting, 1);
  const raw = JSON.stringify(list.body);
  assert.ok(!raw.includes("0611111111") && !raw.includes("Rue 1") && !raw.includes('"c1"'), "no customer phone / address / id");
  assert.equal((await w.call("GET", "/api/store/complaints/" + id, { as: { "x-store": "s2" } })).status, 404);
  assert.equal((await w.call("POST", `/api/store/complaints/${id}/respond`, { as: { "x-store": "s2" }, body: { text: "not my order at all" } })).status, 404);
  assert.equal((await w.call("GET", "/api/store/complaints", { as: {} })).status, 401);
});

test("a store does not see complaints about the driver or the platform on its orders", async () => {
  const w = world();
  await w.call("POST", "/api/customer/complaints", { as: C1, body: body({ against: "driver", clientId: "cl-000004" }) });
  await w.call("POST", "/api/customer/complaints", { as: C1, body: body({ against: "platform", clientId: "cl-000005" }) });
  assert.equal((await w.call("GET", "/api/store/complaints", { as: { "x-store": "s1" } })).body.complaints.length, 0);
});

test("full cycle: store answers -> customer accepts; notifications once per transition; audited", async () => {
  const w = world();
  const id = (await w.call("POST", "/api/customer/complaints", { as: C1, body: body() })).body.complaint.id;
  assert.equal((await w.call("POST", `/api/customer/complaints/${id}/accept`, { as: C1 })).body.code, "NOT_ANSWERED");
  assert.equal((await w.call("POST", `/api/store/complaints/${id}/respond`, { as: { "x-store": "s1" }, body: { text: "x" } })).status, 400);
  const r = await w.call("POST", `/api/store/complaints/${id}/respond`, { as: { "x-store": "s1" }, body: { text: "Sorry, we will refund the fries" } });
  assert.equal(r.status, 200); assert.equal(r.body.complaint.status, "party_responded");
  assert.equal((await w.call("POST", `/api/store/complaints/${id}/respond`, { as: { "x-store": "s1" }, body: { text: "again again" } })).status, 409);
  assert.equal(w.notes.filter((n) => n.type === "complaint_responded").length, 1);
  assert.equal((await w.call("POST", `/api/customer/complaints/${id}/accept`, { as: C2 })).status, 404, "another customer cannot act on it");
  const acc = await w.call("POST", `/api/customer/complaints/${id}/accept`, { as: C1 });
  assert.equal(acc.body.complaint.status, "resolved");
  assert.equal(acc.body.complaint.resolution.outcome, "resolved_by_party");
  assert.equal((await w.call("POST", `/api/customer/complaints/${id}/accept`, { as: C1 })).status, 409, "no double completion");
  const mine = await w.call("GET", "/api/customer/complaints", { as: C1 });
  assert.deepEqual(mine.body.complaints[0].timeline.map((e) => e.kind), ["filed", "routed", "party_response", "customer_accept"]);
});

test("driver complaints: only the accused driver sees and answers; supervisor roles are scoped", async () => {
  const w = world();
  const id = (await w.call("POST", "/api/customer/complaints", { as: C1, body: body({ against: "driver", category: "driver_behavior", clientId: "cl-000006" }) })).body.complaint.id;
  assert.equal((await w.call("GET", "/api/driver/complaints", { as: { "x-drv": "d1" } })).body.complaints.length, 1);
  assert.equal((await w.call("GET", "/api/driver/complaints", { as: { "x-drv": "d2" } })).body.complaints.length, 0);
  assert.equal((await w.call("POST", `/api/driver/complaints/${id}/respond`, { as: { "x-drv": "d2" }, body: { text: "not mine to answer" } })).status, 404);
  assert.equal((await w.call("POST", `/api/driver/complaints/${id}/respond`, { as: { "x-drv": "d1" }, body: { text: "I was polite, the customer insisted" } })).body.complaint.status, "party_responded");
  // the driver supervisor can read driver complaints but not manage; the accountant sees nothing
  assert.equal((await w.call("GET", "/api/admin/complaints", { as: { "x-role": "driver_supervisor" } })).body.complaints.length, 1);
  assert.equal((await w.call("POST", `/api/admin/complaints/${id}/note`, { as: { "x-role": "driver_supervisor" }, body: { text: "hello" } })).status, 403);
  assert.equal((await w.call("GET", "/api/admin/complaints", { as: { "x-role": "accountant" } })).status, 403);
});

test("a store complaint is invisible to the driver supervisor", async () => {
  const w = world();
  const id = (await w.call("POST", "/api/customer/complaints", { as: C1, body: body() })).body.complaint.id;
  assert.equal((await w.call("GET", "/api/admin/complaints", { as: { "x-role": "driver_supervisor" } })).body.complaints.length, 0);
  assert.equal((await w.call("GET", "/api/admin/complaints/" + id, { as: { "x-role": "driver_supervisor" } })).status, 404);
});

test("escalation opens ONE linked exception case; resolving needs outcome + note and closes the case; internal notes stay internal", async () => {
  const w = world();
  const id = (await w.call("POST", "/api/customer/complaints", { as: C1, body: body() })).body.complaint.id;
  await w.call("POST", `/api/store/complaints/${id}/respond`, { as: { "x-store": "s1" }, body: { text: "We disagree, the bag was complete" } });
  assert.equal((await w.call("POST", `/api/customer/complaints/${id}/escalate`, { as: C1, body: { reason: "" } })).body.code, "REASON_REQUIRED");
  const esc = await w.call("POST", `/api/customer/complaints/${id}/escalate`, { as: C1, body: { reason: "Still missing fries, the store denies it" } });
  assert.equal(esc.body.complaint.status, "escalated");
  assert.equal(w.caseLog.filter((c) => c.op === "open").length, 1);
  assert.equal(w.caseLog[0].type, "complaint_dispute");
  assert.equal(w.files.fb.complaints[0].exceptionCaseId, "EX-1");
  assert.equal(w.notes.filter((n) => n.type === "complaint_escalated").length, 1);

  const SUP = { "x-role": "support" };
  assert.equal((await w.call("POST", `/api/admin/complaints/${id}/resolve`, { as: SUP, body: { outcome: "fixed", note: "" } })).body.code, "RESOLUTION_REQUIRED");
  assert.equal(w.files.fb.complaints[0].status, "escalated", "a refused close changes nothing");
  assert.equal((await w.call("POST", `/api/admin/complaints/${id}/take`, { as: SUP })).body.complaint.status, "in_review");
  await w.call("POST", `/api/admin/complaints/${id}/note`, { as: SUP, body: { text: "INTERNAL: store owner is known to dispute everything" } });
  const cust = await w.call("GET", `/api/customer/complaints/${id}`, { as: C1 });
  assert.ok(!JSON.stringify(cust.body).includes("INTERNAL"));
  assert.ok(!JSON.stringify((await w.call("GET", `/api/store/complaints/${id}`, { as: { "x-store": "s1" } })).body).includes("INTERNAL"));
  const done = await w.call("POST", `/api/admin/complaints/${id}/resolve`, { as: SUP, body: { outcome: "compensated", note: "Credit of 10 MAD agreed" } });
  assert.equal(done.status, 200); assert.equal(done.body.complaint.status, "resolved");
  assert.equal(w.caseLog.filter((c) => c.op === "resolve").length, 1);
  assert.equal(w.caseLog.at(-1).outcome, "compensated");
  assert.ok(w.audits.some((a) => a.action === "feedback.complaint.resolve" && a.actorId === "adm-support"));
  assert.equal((await w.call("POST", `/api/admin/complaints/${id}/resolve`, { as: SUP, body: { outcome: "fixed", note: "again please" } })).status, 409, "final");
  assert.equal(w.notes.filter((n) => n.type === "complaint_resolved").length, 1);
});

test("platform complaints skip the party and land with the supervisor immediately", async () => {
  const w = world();
  const r = await w.call("POST", "/api/customer/complaints", { as: C1, body: body({ against: "platform", category: "payment", clientId: "cl-000007" }) });
  assert.equal(r.body.complaint.status, "escalated");
  assert.equal(w.caseLog.filter((c) => c.op === "open").length, 1);
});

test("deadlines are applied on read: silent store => automatic escalation (one case, one notification); silent customer => auto-closed", async () => {
  const w = world();
  const id = (await w.call("POST", "/api/customer/complaints", { as: C1, body: body() })).body.complaint.id;
  w.clock.t += 25 * 3600e3;
  const v = await w.call("GET", `/api/customer/complaints/${id}`, { as: C1 });
  assert.equal(v.body.complaint.status, "escalated");
  await w.call("GET", `/api/customer/complaints/${id}`, { as: C1 });
  await w.call("GET", "/api/admin/complaints", { as: { "x-role": "support" } });
  assert.equal(w.caseLog.filter((c) => c.op === "open").length, 1);
  assert.equal(w.notes.filter((n) => n.type === "complaint_escalated").length, 1);
  assert.equal(v.body.complaint.timeline.at(-1).kind, "auto_escalated");

  const w2 = world();
  const id2 = (await w2.call("POST", "/api/customer/complaints", { as: C1, body: body() })).body.complaint.id;
  await w2.call("POST", `/api/store/complaints/${id2}/respond`, { as: { "x-store": "s1" }, body: { text: "We sent a replacement" } });
  w2.clock.t += 73 * 3600e3;
  assert.equal(w2.api.age(), 1, "the background timer applies the same rule");
  const done = await w2.call("GET", `/api/customer/complaints/${id2}`, { as: C1 });
  assert.deepEqual([done.body.complaint.status, done.body.complaint.resolution.outcome], ["resolved", "no_customer_reply"]);
});

test("withdraw only while with the party; afterwards the supervisor decides", async () => {
  const w = world();
  const id = (await w.call("POST", "/api/customer/complaints", { as: C1, body: body() })).body.complaint.id;
  const wd = await w.call("POST", `/api/customer/complaints/${id}/withdraw`, { as: C1 });
  assert.equal(wd.body.complaint.resolution.outcome, "withdrawn");
  const id2 = (await w.call("POST", "/api/customer/complaints", { as: C1, body: body({ clientId: "cl-000008", against: "platform" }) })).body.complaint.id;
  assert.equal((await w.call("POST", `/api/customer/complaints/${id2}/withdraw`, { as: C1 })).status, 409);
});

test("deadline settings: readable by supervisors, changed ONLY by the system admin, bounded, audited", async () => {
  const w = world();
  assert.equal((await w.call("PUT", "/api/admin/complaints/settings", { as: { "x-role": "support" }, body: { partyResponseHours: 12 } })).status, 403);
  assert.equal((await w.call("PUT", "/api/admin/complaints/settings", { as: { "x-role": "system_admin" }, body: { partyResponseHours: 0 } })).status, 400);
  const ok = await w.call("PUT", "/api/admin/complaints/settings", { as: { "x-role": "system_admin" }, body: { partyResponseHours: 12 } });
  assert.equal(ok.body.settings.partyResponseHours, 12);
  assert.ok(w.audits.some((a) => a.action === "feedback.complaint.settings" && a.previous.partyResponseHours === 24 && a.next.partyResponseHours === 12));
  assert.equal((await w.call("GET", "/api/admin/complaints/settings", { as: { "x-role": "support" } })).status, 200);
  const id = (await w.call("POST", "/api/customer/complaints", { as: C1, body: body() })).body.complaint.id;
  assert.equal(Date.parse(w.files.fb.complaints[0].respondBy) - w.clock.t, 12 * 3600e3, "new complaints use the new deadline");
  assert.ok(id);
});

test("support centre: customers get only the channels the admin published for customers", async () => {
  const w = world();
  const r = await w.call("GET", "/api/support/channels");
  assert.deepEqual(r.body.channels.map((c) => c.href), ["tel:+212600000000"]);
  assert.ok(!JSON.stringify(r.body).includes("stores@x.com"));
});

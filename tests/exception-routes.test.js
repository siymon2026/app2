"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const adminRoles = require("../lib/admin-roles");
const { registerExceptionRoutes } = require("../lib/exception-routes");

function makeApp() {
  const routes = [];
  const reg = (method) => (path, ...h) => routes.push({ method, path, h: h.flat() });
  const app = { get: reg("GET"), post: reg("POST"), put: reg("PUT"), delete: reg("DELETE") };
  async function call(method, url, { role = "system_admin", body = {}, query = {}, anon = false } = {}) {
    const [pathOnly] = url.split("?");
    for (const r of routes) {
      if (r.method !== method) continue;
      const rp = r.path.split("/"), up = pathOnly.split("/");
      if (rp.length !== up.length) continue;
      const params = {};
      if (!rp.every((seg, i) => (seg.startsWith(":") ? ((params[seg.slice(1)] = up[i]), true) : seg === up[i]))) continue;
      const req = { params, body, query, adminId: "adm-" + role, adminRole: role, adminName: role + "-user", method, path: pathOnly };
      return await new Promise((resolve) => {
        const res = { code: 200, headersSent: false, status(c) { this.code = c; return this; }, setHeader() {}, json(o) { this.headersSent = true; resolve({ status: this.code, body: o }); } };
        // same gate as server.js requireAdmin: login + role table
        const gate = (rq, rs, next) => {
          if (anon) return rs.status(401).json({ error: "Unauthorized" });
          const a = adminRoles.authorize(rq.adminRole, rq.method, rq.path);
          if (!a.ok) return rs.status(a.status).json({ error: a.error });
          next();
        };
        const chain = [gate, ...r.h.slice(1)];
        let i = 0;
        const next = () => { const fn = chain[i++]; if (fn) Promise.resolve(fn(req, res, next)).catch((e) => resolve({ status: 500, body: { error: String(e) } })); };
        next();
      });
    }
    throw new Error(`no route ${method} ${url}`);
  }
  return { app, call };
}

function world(extraOrders = []) {
  const files = { ex: { cases: [], settings: {} }, orders: { orders: [
    { id: "o1", status: "restaurant_ready", readyAt: new Date(Date.now() - 20 * 60000).toISOString(), restaurantId: "s1", customerId: "c1" },
    { id: "o2", status: "accepted", driverId: "d1", restaurantId: "s1", customerId: "c2" },
    { id: "o3", status: "on_the_way", driverId: "d2", restaurantId: "s2", customerId: "c3", deliveryFailedAt: "2026-10-27T10:00:00Z", deliveryFailReason: "no answer" },
    { id: "o4", status: "done" },
    ...extraOrders,
  ] } };
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const audits = []; const dispatch = { reset: [], offer: [], offerResult: { ok: true } };
  const { app, call } = makeApp();
  registerExceptionRoutes(app, {
    requireAdmin: (req, res, next) => next(),
    readJson: () => clone(files.ex), writeJson: (_f, v) => { files.ex = clone(v); },
    file: "ex.json",
    loadOrders: () => files.orders, saveOrders: (v) => { files.orders = v; },
    dispatchService: { resetOrder: (id, a) => { dispatch.reset.push([id, a]); return { ok: true }; }, dispatchOrder: (id, o) => { dispatch.offer.push([id, o]); return dispatch.offerResult; } },
    appendAuditLog: (e) => audits.push(e), adminRoles,
  });
  return { call, files, audits, dispatch };
}

test("no login => 401; unlisted/forbidden roles => 403", async () => {
  const w = world();
  assert.equal((await w.call("GET", "/api/admin/exceptions", { anon: true })).status, 401);
  assert.equal((await w.call("GET", "/api/admin/exceptions", { role: "driver_supervisor" })).status, 200); // read only
  assert.equal((await w.call("POST", "/api/admin/exceptions/scan", { role: "driver_supervisor" })).status, 403);
  assert.equal((await w.call("PUT", "/api/admin/exceptions/settings", { role: "order_supervisor", body: { prepDelayMin: 20 } })).status, 403);
});

test("scan creates cases from real orders and is idempotent", async () => {
  const w = world();
  const a = await w.call("POST", "/api/admin/exceptions/scan");
  assert.equal(a.body.created, 2); // o1 unassigned, o3 failed delivery
  const b = await w.call("POST", "/api/admin/exceptions/scan");
  assert.equal(b.body.created, 0);
  assert.equal(w.files.ex.cases.length, 2);
  const list = await w.call("GET", "/api/admin/exceptions");
  assert.equal(list.body.counts.active, 2);
  assert.deepEqual(list.body.cases.map((c) => c.type).sort(), ["failed_delivery", "unassigned_order"]);
});

test("manual case: validation, order must exist, duplicates are not created twice", async () => {
  const w = world();
  assert.equal((await w.call("POST", "/api/admin/exceptions", { body: { type: "x", reason: "r" } })).status, 400);
  assert.equal((await w.call("POST", "/api/admin/exceptions", { body: { type: "complaint_dispute", orderId: "nope", reason: "r" } })).status, 404);
  const a = await w.call("POST", "/api/admin/exceptions", { body: { type: "complaint_dispute", orderId: "o4", reason: "cold food" } });
  assert.equal(a.status, 201);
  const b = await w.call("POST", "/api/admin/exceptions", { body: { type: "complaint_dispute", orderId: "o4", reason: "cold food again" } });
  assert.equal(b.body.duplicate, true);
  assert.equal(w.files.ex.cases.length, 1);
});

test("cannot close without resolution; closing records outcome and is final; actions are audited with before/after", async () => {
  const w = world();
  await w.call("POST", "/api/admin/exceptions/scan");
  const id = w.files.ex.cases.find((c) => c.type === "unassigned_order").id;
  const bad = await w.call("POST", `/api/admin/exceptions/${id}/resolve`, { body: {} });
  assert.equal(bad.status, 400); assert.equal(bad.body.code, "RESOLUTION_REQUIRED");
  assert.equal(w.files.ex.cases.find((c) => c.id === id).status, "open");
  const ok = await w.call("POST", `/api/admin/exceptions/${id}/resolve`, { body: { outcome: "reassigned", note: "driver 7 took it" } });
  assert.equal(ok.status, 200); assert.equal(ok.body.case.resolution.outcome, "reassigned");
  const again = await w.call("POST", `/api/admin/exceptions/${id}/contact`, { body: { party: "store", note: "x" } });
  assert.equal(again.status, 409); assert.equal(again.body.code, "CASE_CLOSED");
  const au = w.audits.find((a) => a.action === "exception.resolve");
  assert.equal(au.previous.status, "open"); assert.equal(au.next.status, "resolved"); assert.equal(au.actorId, "adm-system_admin");
});

test("assign, contact, escalate, priority build the timeline", async () => {
  const w = world();
  await w.call("POST", "/api/admin/exceptions/scan");
  const id = w.files.ex.cases[0].id;
  assert.equal((await w.call("POST", `/api/admin/exceptions/${id}/assign`, { body: { to: "me" } })).status, 200);
  assert.equal((await w.call("POST", `/api/admin/exceptions/${id}/contact`, { body: { party: "customer", note: "called" } })).status, 200);
  assert.equal((await w.call("POST", `/api/admin/exceptions/${id}/contact`, { body: { party: "ghost", note: "x" } })).status, 400);
  assert.equal((await w.call("POST", `/api/admin/exceptions/${id}/escalate`, { body: { to: "support", reason: "angry customer" } })).status, 200);
  assert.equal((await w.call("POST", `/api/admin/exceptions/${id}/priority`, { body: { priority: "urgent" } })).status, 200);
  const d = await w.call("GET", `/api/admin/exceptions/${id}`);
  assert.deepEqual(d.body.case.timeline.map((e) => e.kind), ["opened", "assigned", "contact", "escalated", "priority"]);
  assert.equal(d.body.case.responsible.role, "support");
});

test("redelivery follows the configured attempts then escalates; order flag cleared so rescan does not reopen", async () => {
  const w = world();
  await w.call("PUT", "/api/admin/exceptions/settings", { body: { maxRedeliveryAttempts: 1 } });
  await w.call("POST", "/api/admin/exceptions/scan");
  const id = w.files.ex.cases.find((c) => c.type === "failed_delivery").id;
  assert.equal((await w.call("POST", `/api/admin/exceptions/${id}/redeliver`, { body: {} })).status, 400); // reason required
  const r1 = await w.call("POST", `/api/admin/exceptions/${id}/redeliver`, { body: { reason: "customer absent" } });
  assert.equal(r1.body.decision, "redeliver");
  assert.equal(w.files.orders.orders.find((o) => o.id === "o3").deliveryFailedAt, undefined);
  assert.equal(w.files.orders.orders.find((o) => o.id === "o3").redeliveryAttempts, 1);
  const r2 = await w.call("POST", `/api/admin/exceptions/${id}/redeliver`, { body: { reason: "phone off" } });
  assert.equal(r2.body.decision, "escalate");
  assert.equal(r2.body.case.status, "escalated"); assert.equal(r2.body.case.priority, "urgent");
  assert.equal((await w.call("POST", "/api/admin/exceptions/scan")).body.created, 0);
});

test("reassign: only before pickup, needs dispatch.manage, restarts dispatch, records result", async () => {
  const w = world();
  const c1 = await w.call("POST", "/api/admin/exceptions", { body: { type: "driver_failure", orderId: "o2", reason: "driver phone off" } });
  const id = c1.body.case.id;
  const r = await w.call("POST", `/api/admin/exceptions/${id}/reassign`);
  assert.equal(r.status, 200);
  const o2 = w.files.orders.orders.find((o) => o.id === "o2");
  assert.equal(o2.driverId, null); assert.equal(o2.status, "restaurant_ready");
  assert.deepEqual(w.dispatch.reset[0], ["o2", "exception:" + id]);
  assert.equal(w.dispatch.offer.length, 1);
  // after pickup: refused, order untouched, attempt logged
  const c2 = await w.call("POST", "/api/admin/exceptions", { body: { type: "driver_failure", orderId: "o3", reason: "flat tyre" } });
  const r2 = await w.call("POST", `/api/admin/exceptions/${c2.body.case.id}/reassign`);
  assert.equal(r2.status, 409); assert.equal(r2.body.code, "NOT_REASSIGNABLE");
  assert.equal(w.files.orders.orders.find((o) => o.id === "o3").driverId, "d2");
  assert.equal(w.files.ex.cases.find((c) => c.id === c2.body.case.id).actions.at(-1).ok, false);
  // support role may manage cases but has no dispatch permission
  const c3 = await w.call("POST", "/api/admin/exceptions", { body: { type: "complaint_dispute", orderId: "o4", reason: "x" } });
  assert.equal((await w.call("POST", `/api/admin/exceptions/${c3.body.case.id}/reassign`, { role: "support" })).status, 403);
});

test("role isolation: accountant sees only money cases, support only complaints/escalated to it", async () => {
  const w = world();
  await w.call("POST", "/api/admin/exceptions", { body: { type: "payment_error", reason: "webhook mismatch" } });
  const comp = await w.call("POST", "/api/admin/exceptions", { body: { type: "complaint_dispute", orderId: "o4", reason: "late" } });
  const unas = await w.call("POST", "/api/admin/exceptions", { body: { type: "unassigned_order", orderId: "o1", reason: "none" } });
  const acc = await w.call("GET", "/api/admin/exceptions", { role: "accountant" });
  assert.deepEqual(acc.body.cases.map((c) => c.type), ["payment_error"]);
  const sup = await w.call("GET", "/api/admin/exceptions", { role: "support" });
  assert.deepEqual(sup.body.cases.map((c) => c.type), ["complaint_dispute"]);
  assert.equal((await w.call("GET", `/api/admin/exceptions/${unas.body.case.id}`, { role: "accountant" })).status, 404);
  const ord = await w.call("GET", "/api/admin/exceptions", { role: "order_supervisor" });
  assert.equal(ord.body.cases.some((c) => c.type === "payment_error"), false);
  // escalate the unassigned case to support => support now sees it
  await w.call("POST", `/api/admin/exceptions/${unas.body.case.id}/escalate`, { body: { to: "support", reason: "customer calling" } });
  assert.equal((await w.call("GET", "/api/admin/exceptions", { role: "support" })).body.cases.length, 2);
  assert.ok(comp.body.ok);
});

test("closing a financial case needs finance permission", async () => {
  const w = world();
  const pe = await w.call("POST", "/api/admin/exceptions", { body: { type: "payment_error", reason: "dup callback" } });
  const id = pe.body.case.id;
  await w.call("POST", `/api/admin/exceptions/${id}/escalate`, { body: { to: "support", reason: "x" } });
  // support cannot even see/act on a payment case unless escalated to it; once escalated it still cannot close money
  const r = await w.call("POST", `/api/admin/exceptions/${id}/resolve`, { role: "support", body: { outcome: "fixed", note: "done ok" } });
  assert.equal(r.status, 403); assert.equal(r.body.code, "FINANCE_PERMISSION");
  const ok = await w.call("POST", `/api/admin/exceptions/${id}/resolve`, { role: "accountant", body: { outcome: "fixed", note: "reconciled" } });
  assert.equal(ok.status, 200); // payment cases stay visible to the accountant, who holds finance.write
  assert.equal(ok.body.case.status, "resolved");
});

test("settings: only system_admin writes, values validated, change audited with previous/new", async () => {
  const w = world();
  assert.equal((await w.call("PUT", "/api/admin/exceptions/settings", { body: { prepDelayMin: 1 } })).status, 400);
  assert.equal((await w.call("PUT", "/api/admin/exceptions/settings", { body: { prepDelayMin: 25 } })).status, 200);
  const au = w.audits.find((a) => a.action === "exception.settings");
  assert.equal(au.previous.prepDelayMin, 15); assert.equal(au.next.prepDelayMin, 25);
  assert.equal((await w.call("GET", "/api/admin/exceptions/settings", { role: "order_supervisor" })).body.settings.prepDelayMin, 25);
});

test("list survives legacy/malformed case records (regression: HTTP 500 on the Exceptions button)", async () => {
  const w = world();
  w.files.ex.cases = [
    null, "junk", { id: "EX-OLD1", type: "rejected_order", status: "open", priority: "normal", orderId: "o9" }, // no reasons/timeline
    { id: "EX-OLD2", type: "delayed_preparation", status: "open", priority: "high", orderId: "o8", reasons: null, timeline: "x", actions: 5 },
  ];
  const list = await w.call("GET", "/api/admin/exceptions?status=active");
  assert.equal(list.status, 200); assert.equal(list.body.cases.length, 2);
  const search = await w.call("GET", "/api/admin/exceptions?q=ex-old");
  assert.equal(search.status, 200);
  const one = await w.call("GET", "/api/admin/exceptions/EX-OLD2");
  assert.equal(one.status, 200); assert.deepEqual(one.body.case.reasons, []);
});

"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const adminRoles = require("../lib/admin-roles");
const { createAuditLog } = require("../lib/audit-log");
const DP = require("../lib/data-protection");
const { registerBackupRoutes } = require("../lib/backup-routes");

const KEY = "r".repeat(40);

function world(dpExtra = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "br-"));
  const dataDir = path.join(root, "data");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, "orders.json"), JSON.stringify({ orders: [{ id: "o1" }] }));
  fs.writeFileSync(path.join(root, "config.json"), "{}");
  const auditLog = createAuditLog({ dir: path.join(dataDir, "audit") });
  const dp = DP.createDataProtection({ rootDir: root, dataDir, configFile: path.join(root, "config.json"), uploadsDir: path.join(root, "uploads"), backupDir: path.join(root, "backups"), env: {}, encryptionKey: KEY, requireEncryption: true, audit: auditLog, ...dpExtra });
  const routes = [];
  const app = {};
  for (const m of ["get", "post", "put", "delete"]) app[m] = (p, ...h) => routes.push({ method: m.toUpperCase(), re: new RegExp("^" + p.replace(/:[^/]+/g, "([^/]+)") + "$"), keys: (p.match(/:[^/]+/g) || []).map((k) => k.slice(1)), handlers: h });
  const requireAdmin = (req, res, next) => {
    if (!req.headers["x-role"]) return res.status(401).json({ error: "Unauthorized" });
    const az = adminRoles.authorize(req.headers["x-role"], req.method, req.originalUrl);
    if (!az.ok) return res.status(az.status).json({ error: az.error });
    req.adminRole = req.headers["x-role"]; req.adminId = "adm-1"; req.ip = "10.0.0.7";
    next();
  };
  registerBackupRoutes(app, { requireAdmin, dp, auditLog, actorOf: (req) => ({ id: req.adminId, role: req.adminRole, ip: req.ip }) });
  async function call(method, url, { role = "system_admin", body, query = {} } = {}) {
    const [p] = url.split("?");
    const r = routes.find((x) => x.method === method && x.re.test(p));
    if (!r) return { status: 404, body: null };
    const m = p.match(r.re);
    const req = { method, originalUrl: url, params: Object.fromEntries(r.keys.map((k, i) => [k, m[i + 1]])), query, body, headers: role ? { "x-role": role } : {} };
    let out = { status: 200, body: null };
    const res = { status(c) { out.status = c; return this; }, json(b) { out.body = b; return this; } };
    let i = 0;
    const pending = [];
    const next = () => { const h = r.handlers[i++]; if (h) pending.push(Promise.resolve(h(req, res, next))); };
    next();
    while (pending.length) await pending.shift();
    return out;
  }
  return { call, dp, auditLog, root, dataDir };
}

test("only system_admin may use the backup API; everyone else is refused and unauthenticated calls get 401", async () => {
  const w = world();
  for (const role of ["order_supervisor", "driver_supervisor", "accountant", "support"]) {
    assert.equal((await w.call("GET", "/api/admin/backups", { role })).status, 403, role);
    assert.equal((await w.call("POST", "/api/admin/backups", { role, body: { reason: "nope nope" } })).status, 403, role);
    assert.equal((await w.call("GET", "/api/admin/data-integrity", { role })).status, 403, role);
    assert.equal((await w.call("GET", "/api/admin/backups/events", { role })).status, 403, role);
  }
  assert.equal((await w.call("GET", "/api/admin/backups", { role: null })).status, 401);
  assert.equal((await w.call("GET", "/api/admin/backups", { role: "system_admin" })).status, 200);
  assert.ok(adminRoles.EXPLICIT_ONLY.includes("backup.read") && adminRoles.EXPLICIT_ONLY.includes("backup.create"));
  assert.equal(Object.values(adminRoles.PERMISSIONS).flat().some((p) => p.startsWith("backup.")), false, "granted to no role");
  assert.equal(w.dp.listBackups().length, 0, "refused calls created nothing");
});

test("create: reason required, 201 only after verification; list/verify/events/integrity work; everything is audited", async () => {
  const w = world();
  const bad = await w.call("POST", "/api/admin/backups", { body: { reason: " " } });
  assert.equal(bad.status, 400); assert.equal(bad.body.code, "REASON_REQUIRED");
  const c = await w.call("POST", "/api/admin/backups", { body: { reason: "before releasing v2" } });
  assert.equal(c.status, 201, JSON.stringify(c.body));
  assert.equal(c.body.backup.encrypted, true); assert.ok(c.body.backup.verifiedAt);
  assert.ok(!JSON.stringify(c.body).includes(KEY));
  const id = c.body.backup.id;

  const list = await w.call("GET", "/api/admin/backups");
  assert.equal(list.body.backups.length, 1); assert.equal(list.body.backups[0].verified.ok, true);
  assert.equal(list.body.status.encryptionConfigured, true);
  assert.ok(!("file" in list.body.backups[0]) && !JSON.stringify(list.body).includes(w.root), "no server paths are exposed");

  const v = await w.call("POST", `/api/admin/backups/${id}/verify`);
  assert.equal(v.status, 200); assert.equal(v.body.ok, true);
  assert.equal((await w.call("POST", "/api/admin/backups/siymon-backup-20200101T000000Z-aaaaaa/verify")).status, 404);
  assert.equal((await w.call("POST", "/api/admin/backups/..%2Fetc/verify")).status, 400);

  const ev = await w.call("GET", "/api/admin/backups/events");
  assert.equal(ev.body.integrity.ok, true);
  assert.ok(ev.body.events.some((e) => e.event === "backup.created" && e.actor.id === "adm-1" && e.actor.role === "system_admin"));

  const di = await w.call("GET", "/api/admin/data-integrity");
  assert.equal(di.body.report.ok, true); assert.equal(di.body.report.baseline.backupId, id);

  const actions = w.auditLog.query({ limit: 100 }).logs.map((l) => l.action);
  for (const a of ["backup.created", "backup.view", "data.integrity.check"]) assert.ok(actions.includes(a), a);
  assert.equal(w.auditLog.verify().ok, true);
});

test("create reports honest failures: no key in production => 422, nothing stored; a parallel request => 409", async () => {
  const w = world({ encryptionKey: "" });
  const r = await w.call("POST", "/api/admin/backups", { body: { reason: "should fail" } });
  assert.equal(r.status, 422); assert.equal(r.body.code, "ENCRYPTION_KEY_REQUIRED");
  assert.equal(w.dp.listBackups().length, 0);
  assert.equal((await w.call("GET", "/api/admin/backups")).body.status.encryptionConfigured, false);

  const w2 = world();
  const [a, b] = await Promise.all([w2.call("POST", "/api/admin/backups", { body: { reason: "first one" } }), w2.call("POST", "/api/admin/backups", { body: { reason: "second one" } })]);
  assert.deepEqual([a.status, b.status].sort(), [201, 409]);

  const w3 = world();
  const db = await w3.call("POST", "/api/admin/backups", { body: { reason: "needs database", includeDatabase: true } });
  assert.equal(db.status, 422); assert.equal(db.body.code, "DATABASE_NOT_CONFIGURED");
});

test("there is no route to download, restore or delete a backup", async () => {
  const w = world();
  const c = await w.call("POST", "/api/admin/backups", { body: { reason: "exists now" } });
  const id = c.body.backup.id;
  for (const [m, u] of [["GET", `/api/admin/backups/${id}`], ["GET", `/api/admin/backups/${id}/download`], ["POST", `/api/admin/backups/${id}/restore`], ["DELETE", `/api/admin/backups/${id}`], ["PUT", `/api/admin/backups/${id}`]]) {
    assert.equal((await w.call(m, u)).status, 404, m + " " + u);
  }
});

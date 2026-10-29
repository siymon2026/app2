"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const adminRoles = require("../lib/admin-roles");
const { createAuditLog } = require("../lib/audit-log");
const SS = require("../lib/system-settings");
const { registerSettingsRoutes } = require("../lib/settings-routes");
const core = require("../lib/dispatch-core");
const grid = require("../lib/hexgrid");
const { createDispatchService } = require("../lib/dispatch-service");

const clone = (x) => JSON.parse(JSON.stringify(x));

function world({ auditBroken = false, writeBroken = false, env = {} } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ss-"));
  const realAudit = createAuditLog({ dir });
  const audit = auditBroken ? { append: () => null, query: realAudit.query, verify: realAudit.verify } : realAudit;
  const files = { config: { currency: "MAD" }, ex: { cases: [], settings: {} }, cp: { complaints: [], settings: {} }, dispatch: {} };
  const readJson = (f, fb) => (files[f] ? clone(files[f]) : fb);
  const writeJson = (f, v) => { if (writeBroken) throw new Error("disk full"); files[f] = clone(v); };
  const loadConfig = () => clone(files.config);
  const updateConfig = (patch) => { if (writeBroken) throw new Error("disk full"); Object.assign(files.config, clone(patch)); };
  const dispatchService = createDispatchService({
    core, grid, file: "dispatch", readJson, writeJson, loadOrders: () => ({ orders: [] }), saveOrders() {}, loadDrivers: () => ({ drivers: [] }),
    loadRestaurants: () => ({ restaurants: [] }), loadConfig, onAccepted() {},
  });
  const settings = SS.createSystemSettings({
    loadConfig, updateConfig, deliveryPricing: require("../lib/delivery-pricing"), driverEarnings: require("../lib/driver-earnings"), dispatchService,
    exceptionsLib: require("../lib/exceptions"), complaintsLib: require("../lib/complaints"), readJson, writeJson,
    exceptionsFile: "ex", complaintsFile: "cp", audit, env,
  });
  return { settings, audit, files, dir };
}
const can = (role) => (perm) => adminRoles.can(role, perm);
const actor = (role = "system_admin") => ({ id: "adm-1", role, ip: "10.0.0.5" });
const last = (audit, action = "settings.update") => audit.query({ action, limit: 50 }).logs;

test("price per km: valid change is applied and audited with actor, role, previous, new value and result", () => {
  const { settings, audit, files } = world();
  const r = settings.update("delivery_pricing", { mode: "distance", pricePerKm: 3.5 }, actor(), can("system_admin"));
  assert.equal(r.ok, true);
  assert.deepEqual(r.changed.sort(), ["mode", "pricePerKm"]);
  assert.equal(files.config.deliveryPricePerKm, 3.5);
  const recs = last(audit);
  const ok = recs.find((x) => x.result === "ok");
  assert.equal(ok.actorId, "adm-1"); assert.equal(ok.role, "system_admin"); assert.equal(ok.group, "delivery_pricing");
  assert.equal(ok.previous.pricePerKm, 0); assert.equal(ok.next.pricePerKm, 3.5); assert.ok(ok.at);
  assert.ok(recs.find((x) => x.result === "applying" && x.seq < ok.seq), "intent recorded before the outcome");
});

test("default base delivery fee stays 0 (spec 10) and safe bounds are enforced, not clamped", () => {
  const { settings, files, audit } = world();
  assert.equal(settings.GROUPS.delivery_pricing.get().baseFee, 0);
  for (const bodyBad of [{ pricePerKm: 51 }, { pricePerKm: -1 }, { pricePerKm: "abc" }, { maxKm: 0 }, { maxKm: 61 }, { baseFee: 101 }]) {
    const r = settings.update("delivery_pricing", bodyBad, actor(), can("system_admin"));
    assert.equal(r.ok, false, JSON.stringify(bodyBad)); assert.equal(r.status, 400);
  }
  assert.equal(files.config.deliveryPricePerKm, undefined); // nothing leaked into storage
  const rej = last(audit).filter((x) => x.result === "rejected");
  assert.equal(rej.length, 6);
  assert.equal(rej[0].actorId, "adm-1");
  assert.ok(rej[0].previous && rej[0].attempted);
});

test("unknown keys are rejected (no arbitrary config writes through the settings API)", () => {
  const { settings, files } = world();
  for (const g of ["delivery_pricing", "driver_earnings", "dispatch", "limits", "i18n"]) {
    const r = settings.update(g, { adminPassword: "pwned", __proto__x: 1 }, actor(), can("system_admin"));
    assert.equal(r.ok, false); assert.equal(r.code, "UNKNOWN_SETTING");
  }
  assert.equal(files.config.adminPassword, undefined);
  assert.equal(settings.update("nope", {}, actor(), can("system_admin")).status, 404);
});

test("driver base pay + per-km: bounds and audit", () => {
  const { settings, audit, files } = world();
  assert.equal(settings.update("driver_earnings", { mode: "formula", base: 8, perKm: 1.5 }, actor(), can("system_admin")).ok, true);
  assert.equal(files.config.driverEarningBase, 8);
  assert.equal(settings.update("driver_earnings", { base: 500 }, actor(), can("system_admin")).ok, false);
  assert.equal(settings.update("driver_earnings", { mode: "magic" }, actor(), can("system_admin")).ok, false);
  assert.ok(last(audit).some((x) => x.group === "driver_earnings" && x.result === "ok" && x.next.base === 8));
});

test("permissions: accountant may read pricing but not change it; denial is audited; restricted roles never see limits/i18n", () => {
  const { settings, audit, files } = world();
  const snap = settings.snapshot(can("accountant"));
  const ids = snap.map((g) => g.id);
  assert.ok(ids.includes("delivery_pricing") && ids.includes("driver_earnings"));
  assert.ok(!ids.includes("limits") && !ids.includes("i18n") && !ids.includes("dispatch"));
  assert.equal(snap.find((g) => g.id === "delivery_pricing").canWrite, false);
  const r = settings.update("delivery_pricing", { pricePerKm: 9 }, actor("accountant"), can("accountant"));
  assert.equal(r.status, 403);
  assert.equal(files.config.deliveryPricePerKm, undefined);
  const den = last(audit).find((x) => x.result === "denied");
  assert.equal(den.role, "accountant"); assert.equal(den.permission, "settings.write");
  // nobody except system_admin holds the explicit-only permissions
  for (const role of ["order_supervisor", "driver_supervisor", "accountant", "support"]) {
    for (const perm of ["settings.write", "settings.dispatch", "settings.read", "audit.read"]) assert.equal(adminRoles.can(role, perm), false, role + " " + perm);
  }
  assert.equal(adminRoles.can("system_admin", "settings.dispatch"), true);
});

test("dispatch rules: H3 search rings, offer timeout, mode — strict bounds; read-through matches what dispatch-service consumes", () => {
  const { settings, files } = world();
  assert.equal(settings.update("dispatch", { rings: 4, ttlSec: 45, mode: "offers", auto: false }, actor(), can("system_admin")).ok, true);
  assert.equal(files.config.dispatchRings, 4); assert.equal(files.config.dispatchOfferTtlMs, 45000);
  const g = settings.GROUPS.dispatch.get();
  assert.deepEqual([g.rings, g.ttlSec, g.mode, g.auto], [4, 45, "offers", false]);
  for (const b of [{ rings: 0 }, { rings: 6 }, { rings: 2.5 }, { ttlSec: 9 }, { ttlSec: 121 }, { mode: "chaos" }, { pickup: { lat: 999, lng: 0 } }]) {
    assert.equal(settings.update("dispatch", b, actor(), can("system_admin")).ok, false, JSON.stringify(b));
  }
  assert.equal(settings.GROUPS.dispatch.get().rings, 4); // unchanged by the rejected attempts
});

test("preparation-time thresholds, alert timers, redelivery attempts and complaint deadlines go to their real files", () => {
  const { settings, files } = world();
  assert.equal(settings.update("exceptions", { prepDelayMin: 20, maxRedeliveryAttempts: 3 }, actor(), can("system_admin")).ok, true);
  assert.equal(files.ex.settings.prepDelayMin, 20); assert.equal(files.ex.settings.maxRedeliveryAttempts, 3);
  assert.equal(settings.update("exceptions", { prepDelayMin: 2 }, actor(), can("system_admin")).ok, false);
  assert.equal(settings.update("exceptions", { maxRedeliveryAttempts: 6 }, actor(), can("system_admin")).ok, false);
  assert.equal(settings.update("complaints", { partyResponseHours: 48 }, actor(), can("system_admin")).ok, true);
  assert.equal(files.cp.settings.partyResponseHours, 48);
  assert.equal(settings.update("complaints", { customerReplyHours: 5 }, actor(), can("system_admin")).ok, false);
});

test("security/operational limits: bounds, env default, and a hand-edited config can never switch a limiter off", () => {
  const { settings, files } = world({ env: { ADMIN_RATE_LIMIT_MAX: "900" } });
  assert.deepEqual(settings.GROUPS.limits.get(), { adminRateLimitMax: 900, apiRateLimitMax: 3000, loginMaxAttempts: 10 });
  assert.equal(settings.update("limits", { loginMaxAttempts: 5, adminRateLimitMax: 300 }, actor(), can("system_admin")).ok, true);
  assert.equal(files.config.loginMaxAttempts, 5);
  assert.equal(SS.limitsFromConfig(files.config, {}).loginMaxAttempts, 5);
  for (const b of [{ loginMaxAttempts: 2 }, { loginMaxAttempts: 31 }, { adminRateLimitMax: 49 }, { apiRateLimitMax: 20001 }, { apiRateLimitMax: 1.5 }, { loginMaxAttempts: true }]) {
    assert.equal(settings.update("limits", b, actor(), can("system_admin")).ok, false, JSON.stringify(b));
  }
  // a hand-edited config outside the bounds can never switch the limiter off
  assert.equal(SS.limitsFromConfig({ loginMaxAttempts: 100000, apiRateLimitMax: 0 }, {}).loginMaxAttempts, 10);
  assert.equal(SS.limitsFromConfig({ apiRateLimitMax: 0 }, {}).apiRateLimitMax, 3000);
});

test("languages and global text: validated; default language can never be a disabled language; markup stripped", () => {
  const { settings, files } = world();
  assert.deepEqual(settings.GROUPS.i18n.get().supportedLanguages, ["ar", "fr", "en"]);
  assert.equal(settings.update("i18n", { supportedLanguages: ["xx"] }, actor(), can("system_admin")).ok, false);
  assert.equal(settings.update("i18n", { supportedLanguages: [] }, actor(), can("system_admin")).ok, false);
  assert.equal(settings.update("i18n", { defaultLanguage: "en", supportedLanguages: ["ar", "fr"] }, actor(), can("system_admin")).ok, false);
  const r = settings.update("i18n", { supportedLanguages: ["fr", "en"] }, actor(), can("system_admin"));
  assert.equal(r.ok, true); assert.equal(r.next.defaultLanguage, "fr"); // 'ar' was default but is now disabled -> falls back
  assert.equal(settings.update("i18n", { announcement: { ar: "x".repeat(281) } }, actor(), can("system_admin")).ok, false);
  assert.equal(settings.update("i18n", { announcement: { de: "hallo" } }, actor(), can("system_admin")).ok, false);
  const t = settings.update("i18n", { announcement: { fr: "<b>Fermé</b> demain" } }, actor(), can("system_admin"));
  assert.equal(t.ok, true);
  assert.equal(files.config.globalAnnouncement.fr, "b Fermé /b demain"); // < and > removed, spaces collapsed
  assert.equal(files.config.globalAnnouncement.ar, ""); // untouched languages keep their value
});

test("FAIL-CLOSED: if the audit log cannot be written the setting is NOT changed", () => {
  const { settings, files } = world({ auditBroken: true });
  const r = settings.update("delivery_pricing", { pricePerKm: 4 }, actor(), can("system_admin"));
  assert.equal(r.ok, false); assert.equal(r.status, 503); assert.equal(r.code, "AUDIT_UNAVAILABLE");
  assert.equal(files.config.deliveryPricePerKm, undefined);
});

test("a failing write is reported as failed in the audit trail (no silent success)", () => {
  const { settings, audit } = world({ writeBroken: true });
  const r = settings.update("delivery_pricing", { pricePerKm: 4 }, actor(), can("system_admin"));
  assert.equal(r.status, 500);
  const recs = last(audit);
  assert.ok(recs.some((x) => x.result === "applying")); assert.ok(recs.some((x) => x.result === "failed"));
  assert.ok(!recs.some((x) => x.result === "ok"));
});

test("two-phase begin/finish (used by PUT /api/config) records intent then outcome; secrets in values are masked", () => {
  const { settings, audit, dir } = world();
  const intent = settings.begin(actor(), "general", { bankAccount: "MA64001122334455" }, { next: { bankAccount: "MA64999988887777" } });
  assert.ok(intent);
  settings.finish(intent, actor(), "general", { bankAccount: "MA64001122334455" }, { bankAccount: "MA64999988887777" });
  const ok = last(audit).find((x) => x.result === "ok");
  assert.deepEqual(ok.changed, ["bankAccount"]);
  assert.equal(ok.previous.bankAccount, "****4455"); assert.equal(ok.next.bankAccount, "****7777");
  const raw = fs.readFileSync(path.join(dir, fs.readdirSync(dir).find((f) => f.endsWith(".jsonl"))), "utf-8");
  assert.ok(!raw.includes("MA64001122334455") && !raw.includes("MA64999988887777"));
  assert.equal(audit.verify().ok, true);
});

/* ---------------- routes ---------------- */

function routesWorld(opts) {
  const w = world(opts);
  const routes = [];
  const reg = (method) => (p, ...h) => routes.push({ method, path: p, h: h.flat() });
  const app = { get: reg("GET"), put: reg("PUT"), post: reg("POST"), delete: reg("DELETE") };
  const requireAdmin = () => {};
  let changed = 0;
  registerSettingsRoutes(app, { requireAdmin, auditLog: w.audit, settings: w.settings, adminRoles, onSettingsChanged: () => { changed++; } });
  async function call(method, url, { role = "system_admin", body = {}, query = {} } = {}) {
    const [pathOnly] = url.split("?");
    for (const r of routes) {
      if (r.method !== method) continue;
      const rp = r.path.split("/"), up = pathOnly.split("/");
      if (rp.length !== up.length) continue;
      const params = {};
      if (!rp.every((seg, i) => (seg.startsWith(":") ? ((params[seg.slice(1)] = up[i]), true) : seg === up[i]))) continue;
      const req = { params, body, query, adminId: "adm-" + role, adminRole: role, method, path: pathOnly, ip: "10.1.1.1" };
      return await new Promise((resolve) => {
        const headers = {};
        const res = { code: 200, status(c) { this.code = c; return this; }, setHeader(k, v) { headers[k] = v; }, json(o) { resolve({ status: this.code, body: o, headers }); }, send(t) { resolve({ status: this.code, text: t, headers }); } };
        const gated = r.h[0] === requireAdmin;
        if (gated) { const a = adminRoles.authorize(req.adminRole, req.method, req.path); if (!a.ok) return resolve({ status: a.status, body: { error: a.error } }); }
        r.h.filter((f) => f !== requireAdmin)[0](req, res);
      });
    }
    throw new Error("no route " + method + " " + url);
  }
  return { ...w, call, changed: () => changed };
}

test("routes: system_admin lists groups and changes one; onSettingsChanged fires", async () => {
  const w = routesWorld();
  const g = await w.call("GET", "/api/admin/settings");
  assert.equal(g.status, 200);
  assert.deepEqual(g.body.groups.map((x) => x.id).sort(), ["complaints", "delivery_pricing", "dispatch", "driver_earnings", "exceptions", "i18n", "limits"]);
  const p = await w.call("PUT", "/api/admin/settings/delivery_pricing", { body: { pricePerKm: 2 } });
  assert.equal(p.status, 200); assert.equal(p.body.values.pricePerKm, 2); assert.equal(w.changed(), 1);
  const bad = await w.call("PUT", "/api/admin/settings/delivery_pricing", { body: { pricePerKm: 999 } });
  assert.equal(bad.status, 400); assert.equal(w.changed(), 1);
});

test("routes: restricted roles get 403 on writes, and see only what they may read", async () => {
  const w = routesWorld();
  for (const role of ["order_supervisor", "driver_supervisor", "accountant", "support"]) {
    const r = await w.call("PUT", "/api/admin/settings/limits", { role, body: { loginMaxAttempts: 30 } });
    assert.equal(r.status, 403, role);
  }
  assert.equal(w.settings.GROUPS.limits.get().loginMaxAttempts, 10);
  const acct = await w.call("GET", "/api/admin/settings", { role: "accountant" });
  assert.deepEqual(acct.body.groups.map((x) => x.id).sort(), ["delivery_pricing", "driver_earnings", "exceptions"]);
  assert.ok(acct.body.groups.every((x) => x.canWrite === false));
  assert.ok(w.audit.query({ result: "denied", limit: 50 }).total >= 4);
});

test("routes: audit log is system_admin only; viewing, verifying and exporting are themselves audited", async () => {
  const w = routesWorld();
  await w.call("PUT", "/api/admin/settings/driver_earnings", { body: { base: 5 } });
  for (const role of ["order_supervisor", "driver_supervisor", "accountant", "support"]) {
    for (const u of ["/api/admin/audit-logs", "/api/admin/audit-logs/verify", "/api/admin/audit-logs/export.csv"]) {
      assert.equal((await w.call("GET", u, { role })).status, 403, role + " " + u);
    }
  }
  const list = await w.call("GET", "/api/admin/audit-logs", { query: { action: "settings.*", result: "ok" } });
  assert.equal(list.status, 200); assert.equal(list.body.total, 1); assert.equal(list.body.logs[0].group, "driver_earnings");
  const ver = await w.call("GET", "/api/admin/audit-logs/verify");
  assert.equal(ver.body.integrity.ok, true);
  await w.call("GET", "/api/admin/audit-logs/export.csv");
  const accessed = w.audit.query({ action: "audit.*", limit: 50 }).logs.map((x) => x.action).sort();
  assert.deepEqual(accessed, ["audit.export", "audit.verify", "audit.view"]);
});

test("routes: there is no way to modify or delete audit records over HTTP", async () => {
  const w = routesWorld();
  await w.call("PUT", "/api/admin/settings/driver_earnings", { body: { base: 5 } });
  for (const m of ["PUT", "POST", "DELETE", "PATCH"]) {
    await assert.rejects(() => w.call(m, "/api/admin/audit-logs"), /no route/);
    await assert.rejects(() => w.call(m, "/api/admin/audit-logs/1"), /no route/);
  }
  assert.equal(w.audit.verify().ok, true);
});

test("routes: CSV export neutralizes spreadsheet formulas and keeps secrets out", async () => {
  const w = routesWorld();
  w.audit.append({ action: "x", actorId: "=HYPERLINK(\"http://evil\")", result: "ok", password: "p@ss" });
  const r = await w.call("GET", "/api/admin/audit-logs/export.csv");
  assert.equal(r.headers["Content-Type"], "text/csv; charset=utf-8");
  assert.ok(r.text.includes("\"'=HYPERLINK"));
  assert.ok(!r.text.includes("p@ss"));
});

test("routes: public i18n endpoint needs no login and exposes only languages + announcement", async () => {
  const w = routesWorld();
  await w.call("PUT", "/api/admin/settings/i18n", { body: { announcement: { en: "Closed Friday" } } });
  const r = await w.call("GET", "/api/public/i18n", { role: "nobody" });
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(r.body).sort(), ["announcement", "defaultLanguage", "ok", "supportedLanguages"]);
  assert.equal(r.body.announcement.en, "Closed Friday");
});

test("admin-roles: dispatch RULES need settings.dispatch (system_admin); offer/reset interventions stay with supervisors", () => {
  assert.equal(adminRoles.authorize("order_supervisor", "POST", "/api/admin/dispatch/settings").ok, false);
  assert.equal(adminRoles.authorize("driver_supervisor", "POST", "/api/admin/dispatch/settings").ok, false);
  assert.equal(adminRoles.authorize("system_admin", "POST", "/api/admin/dispatch/settings").ok, true);
  assert.equal(adminRoles.authorize("order_supervisor", "POST", "/api/admin/dispatch/orders/o1/offer").ok, true);
  assert.equal(adminRoles.authorize("order_supervisor", "POST", "/api/admin/dispatch/orders/o1/reset").ok, true);
  assert.equal(adminRoles.authorize("order_supervisor", "GET", "/api/admin/dispatch/state").ok, true);
  assert.equal(adminRoles.authorize("accountant", "GET", "/api/admin/audit-logs").ok, false);
  assert.equal(adminRoles.authorize("system_admin", "GET", "/api/admin/audit-logs/verify").ok, true);
});

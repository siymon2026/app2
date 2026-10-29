"use strict";
/**
 * TEST-ONLY harness: serves /public and a minimal admin API that enforces the REAL role table
 * (lib/admin-roles.js authorize) exactly like requireAdmin does, and records every request, so browser tests can
 * assert "no forbidden request was ever made" and "the page keeps polling". NOT used in production.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const roles = require("../lib/admin-roles");
const { registerSupportRoutes } = require("../lib/support-routes");
const { registerExceptionRoutes } = require("../lib/exception-routes");
const { registerReportRoutes } = require("../lib/report-routes");
const fin = require("../lib/finance");
const os = require("os");
const { createAuditLog } = require("../lib/audit-log");
const { createSystemSettings } = require("../lib/system-settings");
const { registerSettingsRoutes } = require("../lib/settings-routes");
const PUB = path.join(__dirname, "..", "public");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json", ".mp3": "audio/mpeg" };
const TOKENS = { "tok-system": "system_admin", "tok-support": "support", "tok-accountant": "accountant", "tok-driversup": "driver_supervisor", "tok-ordersup": "order_supervisor" };

function create() {
  // REAL lib/support-routes.js on in-memory data (store side authenticated by the X-Store-Id header in this harness only)
  const files = { sch: { channels: [] }, stk: { tickets: [] } }; const FILES = { SC: "sch", ST: "stk" }; let seq = 0;
  const sroutes = [];
  const reg = (m) => (pth, ...h) => sroutes.push({ m, pth, h: h.flat() });
  registerSupportRoutes({ get: reg("GET"), post: reg("POST"), put: reg("PUT"), delete: reg("DELETE") }, {
    requireStore: () => (q, r, n) => { q.storeId = q.header("x-store-id"); q.storeUserId = "u1"; q.storeRole = "owner"; q.store = { name: { ar: "متجر " + q.storeId } }; n(); },
    requireAdmin: (q, r, n) => { q.adminId = "a1"; q.adminRole = q.__role; n(); },
    readJson: (f, fb) => JSON.parse(JSON.stringify(files[FILES[f]] || fb)), writeJson: (f, d) => { files[FILES[f]] = JSON.parse(JSON.stringify(d)); },
    loadRestaurants: () => ({ restaurants: [{ id: "g1", name: { ar: "بقالة الأمل", fr: "Epicerie", en: "Hope" } }, { id: "p1", name: { ar: "صيدلية النور", fr: "Pharmacie", en: "Nour" } }] }),
    makeId: () => "m" + ++seq, appendAuditLog: () => {}, channelsFile: "SC", ticketsFile: "ST",
  });
  function runSupport(req, res, u, role, send) {
    let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => {
      let body = {}; try { body = JSON.parse(d || "{}"); } catch (_e) {}
      for (const r of sroutes) {
        if (r.m !== req.method) continue;
        const rp = r.pth.split("/"), up = u.pathname.split("/"); if (rp.length !== up.length) continue;
        const params = {}; if (!rp.every((sg, i) => (sg.startsWith(":") ? ((params[sg.slice(1)] = decodeURIComponent(up[i])), true) : sg === up[i]))) continue;
        const q = { params, body, query: Object.fromEntries(u.searchParams), header: (k) => req.headers[k.toLowerCase()], __role: role };
        const rs = { code: 200, status(c) { this.code = c; return this; }, setHeader() {}, json(o) { send(res, this.code, o); } };
        let i = 0; const next = () => { const f = r.h[i++]; if (f) f(q, rs, next); }; return next();
      }
      send(res, 404, { error: "nf" });
    });
  }
  // REAL lib/exception-routes.js on in-memory data (TEST-ONLY seed orders, separate from the orders list above)
  const minAgo = (m) => new Date(Date.now() - m * 60000).toISOString();
  const exFiles = { ex: { cases: [], settings: {} }, orders: { orders: [
    { id: "X-UNASSIGNED", status: "restaurant_ready", readyAt: minAgo(25), restaurantId: "g1", customerId: "c1" },
    { id: "X-FAILED", status: "on_the_way", driverId: "d2", restaurantId: "g1", customerId: "c2", deliveryFailedAt: minAgo(5), deliveryFailReason: "customer not answering" },
    { id: "X-ASSIGNED", status: "accepted", driverId: "d1", restaurantId: "g1", customerId: "c3" },
  ] } };
  const xroutes = [];
  const xreg = (m) => (pth, ...h) => xroutes.push({ m, pth, h: h.flat() });
  const exCalls = { reset: [], offer: [] };
  registerExceptionRoutes({ get: xreg("GET"), post: xreg("POST"), put: xreg("PUT"), delete: xreg("DELETE") }, {
    requireAdmin: (q, r, n) => { q.adminId = "a1"; q.adminRole = q.__role; n(); },
    readJson: (f, fb) => JSON.parse(JSON.stringify(exFiles.ex)), writeJson: (f, d) => { exFiles.ex = JSON.parse(JSON.stringify(d)); },
    file: "EX", loadOrders: () => exFiles.orders, saveOrders: (d) => { exFiles.orders = d; },
    dispatchService: { resetOrder: (id, a) => { exCalls.reset.push([id, a]); return { ok: true }; }, dispatchOrder: (id) => { exCalls.offer.push(id); return { ok: false, error: "no_candidates" }; } },
    appendAuditLog: () => {}, adminRoles: roles,
  });
  function runEx(req, res, u, role, send) {
    let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => {
      let body = {}; try { body = JSON.parse(d || "{}"); } catch (_e) {}
      for (const r of xroutes) {
        if (r.m !== req.method) continue;
        const rp = r.pth.split("/"), up = u.pathname.split("/"); if (rp.length !== up.length) continue;
        const params = {}; if (!rp.every((sg, i) => (sg.startsWith(":") ? ((params[sg.slice(1)] = decodeURIComponent(up[i])), true) : sg === up[i]))) continue;
        const q = { params, body, query: Object.fromEntries(u.searchParams), header: (k) => req.headers[k.toLowerCase()], __role: role };
        const rs = { code: 200, headersSent: false, status(c) { this.code = c; return this; }, setHeader() {}, json(o) { this.headersSent = true; send(res, this.code, o); } };
        let i = 0; const next = () => { const f = r.h[i++]; if (f) Promise.resolve(f(q, rs, next)); }; return next();
      }
      send(res, 404, { error: "nf" });
    });
  }
  // REAL lib/report-routes.js + lib/reports.js on seeded in-memory records (TEST-ONLY data)
  const mkO = (id, store, sub, fee, daysAgo, drv) => {
    const at = new Date(Date.now() - daysAgo * 86400000).toISOString();
    const o = { id, restaurantId: store, status: "delivered", createdAt: at, deliveredAt: at, subtotal: sub, deliveryFee: fee, total: sub + fee, paymentMethod: "cod", driverId: drv, customer: { name: "PRIVATE-NAME", phone: "0600PRIVATE" } };
    o.financials = fin.orderFinancials({ order: o, store: { commission: { type: "percent", value: 10 } }, driverEarning: fee });
    fin.finalize(o);
    return o;
  };
  const repData = {
    orders: [mkO("R1", "g1", 100, 10, 1, "d1"), mkO("R2", "g1", 60, 10, 2, "d1"), mkO("R3", "p1", 80, 12, 1, "d2"), mkO("R4", "g1", 40, 8, 40, "d2")],
    stores: [{ id: "g1", name: { ar: "بقالة الأمل", fr: "Epicerie", en: "Hope" }, type: "grocery" }, { id: "p1", name: { ar: "صيدلية النور", fr: "Pharmacie", en: "Noor" }, type: "pharmacy" }],
    drivers: [{ id: "d1", name: "Ali" }, { id: "d2", name: "Omar" }],
  };
  const rroutes = [];
  const rreg = (m) => (pth, ...h) => rroutes.push({ m, pth, h: h.flat() });
  registerReportRoutes({ get: rreg("GET") }, {
    requireAdmin: (q, r, n) => { q.adminId = "a1"; q.adminRole = q.__role; n(); },
    requireStore: () => (q, r, n) => { const sid = q.header("x-store-id"); if (!sid) return r.status(401).json({ error: "Unauthorized" }); q.storeId = sid; q.storeRole = "owner"; q.storeUserId = "u1"; n(); },
    adminRoles: roles, appendAuditLog: () => {}, getConfig: () => ({ currency: "MAD" }),
    loaders: { orders: () => repData.orders, stores: () => repData.stores, drivers: () => repData.drivers, customers: () => [], settlements: () => [], topups: () => [], exceptions: () => ({ cases: [], settings: {} }) },
  });
  function runReports(req, res, u, role, send) {
    const q = { params: {}, query: Object.fromEntries(u.searchParams), headers: req.headers, originalUrl: req.url, header: (k) => req.headers[k.toLowerCase()], __role: role };
    for (const r of rroutes) {
      const rp = r.pth.split("/"), up = u.pathname.split("/"); if (rp.length !== up.length) continue;
      if (!rp.every((sg, i) => { if (!sg.startsWith(":")) return sg === up[i]; q.params[sg.slice(1).replace(/\(.*$/, "")] = up[i]; return true; })) continue;
      const hd = {};
      const rs = { code: 200, status(c) { this.code = c; return this; }, setHeader(k, v) { hd[k] = v; }, json(o) { send(res, this.code, o); }, send(b) { res.writeHead(this.code, hd); res.end(b); } };
      let i = 0; const next = () => { const f = r.h[i++]; if (f) f(q, rs, next); }; return next();
    }
    send(res, 404, { error: "nf" });
  }
  // REAL lib/settings-routes.js + system-settings.js + audit-log.js (real files in a temp dir; in-memory config)
  const sFiles = { config: { currency: "MAD" }, ex: { cases: [], settings: {} }, cp: { complaints: [], settings: {} }, dispatch: {} };
  const cl = (x) => JSON.parse(JSON.stringify(x));
  const sRead = (f, fb) => (sFiles[f] ? cl(sFiles[f]) : fb), sWrite = (f, v) => { sFiles[f] = cl(v); };
  const auditLog = createAuditLog({ dir: fs.mkdtempSync(path.join(os.tmpdir(), "mock-audit-")) });
  const sDispatch = require("../lib/dispatch-service").createDispatchService({ core: require("../lib/dispatch-core"), grid: require("../lib/hexgrid"), file: "dispatch", readJson: sRead, writeJson: sWrite, loadOrders: () => ({ orders: [] }), saveOrders() {}, loadDrivers: () => ({ drivers: [] }), loadRestaurants: () => ({ restaurants: [] }), loadConfig: () => cl(sFiles.config), onAccepted() {} });
  const settingsSvc = createSystemSettings({ loadConfig: () => cl(sFiles.config), updateConfig: (pt) => Object.assign(sFiles.config, cl(pt)), deliveryPricing: require("../lib/delivery-pricing"), driverEarnings: require("../lib/driver-earnings"), dispatchService: sDispatch, exceptionsLib: require("../lib/exceptions"), complaintsLib: require("../lib/complaints"), readJson: sRead, writeJson: sWrite, exceptionsFile: "ex", complaintsFile: "cp", audit: auditLog });
  const sroutes2 = [];
  const sreg = (m) => (pth, ...h) => sroutes2.push({ m, pth, h: h.flat() });
  const sMarker = () => {};
  registerSettingsRoutes({ get: sreg("GET"), put: sreg("PUT") }, { requireAdmin: sMarker, auditLog, settings: settingsSvc, adminRoles: roles });
  function runSettings(req, res, u, role, send) {
    let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => {
      let body = {}; try { body = JSON.parse(d || "{}"); } catch (_e) {}
      for (const r of sroutes2) {
        if (r.m !== req.method) continue;
        const rp = r.pth.split("/"), up = u.pathname.split("/"); if (rp.length !== up.length) continue;
        const params = {}; if (!rp.every((sg, i) => (sg.startsWith(":") ? ((params[sg.slice(1)] = decodeURIComponent(up[i])), true) : sg === up[i]))) continue;
        const q = { params, body, query: Object.fromEntries(u.searchParams), adminId: "adm-" + role, adminRole: role, ip: "127.0.0.1" };
        const hd = {};
        const rs = { code: 200, status(c) { this.code = c; return this; }, setHeader(k, v) { hd[k] = v; }, json(o) { send(res, this.code, o); }, send(b) { res.writeHead(this.code, hd); res.end(b); } };
        return r.h.filter((f) => f !== sMarker)[0](q, rs);
      }
      send(res, 404, { error: "nf" });
    });
  }
  const log = [];           // {method, path, status, role}
  const hang = new Set();   // path prefixes that never answer (to simulate a stuck loader)
  const state = { orders: [{ id: "O1", createdAt: new Date().toISOString(), status: "new", customer: { name: "Test", phone: "0600", addr: "Rabat" }, items: [{ id: "i1", name: "Pizza", qty: 1, price: 50 }], total: 50, deliveryFee: 0 }] };
  const send = (res, code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, "http://x"); const p = u.pathname;
    if (!p.startsWith("/api/") && !p.startsWith("/__t/")) {
      let f = path.join(PUB, p); if (p.endsWith("/")) f = path.join(f, "index.html");
      if (!f.startsWith(PUB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end("nf"); }
      res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-store" });
      return res.end(fs.readFileSync(f));
    }
    if (p.startsWith("/__t/")) { // test control endpoints
      const q = u.searchParams;
      if (p === "/__t/denied") return send(res, 200, log.filter((r) => r.status === 403));
      if (p === "/__t/count") { const re = new RegExp(q.get("re")); return send(res, 200, { n: log.filter((r) => re.test(r.path)).length }); }
      if (p === "/__t/ex") return send(res, 200, { cases: exFiles.ex.cases, orders: exFiles.orders.orders, calls: exCalls });
      if (p === "/__t/config") return send(res, 200, sFiles.config);
      if (p === "/__t/hang") { hang.add(q.get("p")); return send(res, 200, {}); }
      if (p === "/__t/unhang") { hang.clear(); return send(res, 200, {}); }
    }
    if (p.startsWith("/api/store/support/")) return runSupport(req, res, u, null, send);
    if (p.startsWith("/api/store/reports")) return runReports(req, res, u, null, send);
    const tok = req.headers["x-admin-token"]; const role = TOKENS[tok];
    const rec = { method: req.method, path: p, status: 200, role: role || null };
    log.push(rec);
    if (p === "/api/admin/login") { rec.status = 400; return send(res, 400, { error: "n/a" }); }
    if (!role) { rec.status = 401; return send(res, 401, { error: "Unauthorized" }); }
    const az = roles.authorize(role, req.method, req.url);
    if (!az.ok) { rec.status = 403; return send(res, 403, { error: "Forbidden" }); }
    if ([...hang].some((h) => p.startsWith(h))) return; // never answers
    if (/^\/api\/admin\/(support-channels|store-support)/.test(p)) return runSupport(req, res, u, role, send);
    if (/^\/api\/admin\/(settings|audit-logs)/.test(p)) return runSettings(req, res, u, role, send);
    if (/^\/api\/admin\/exceptions/.test(p)) return runEx(req, res, u, role, send);
    if (/^\/api\/admin\/reports/.test(p)) return runReports(req, res, u, role, send);
    if (p === "/api/admin/me") return send(res, 200, { id: "a1", role, permissions: roles.permissionsOf(role), email: role + "@t.t", name: role });
    if (p === "/api/config") return send(res, 200, { couriers: [], wifiPrinter: { ip: "", port: 9100 }, wifiPrintEnabled: true, currency: "MAD", restaurantMode: "auto" });
    if (p === "/api/orders") return send(res, 200, { orders: state.orders });
    if (p === "/api/admin/drivers") return send(res, 200, { drivers: [] });
    if (p === "/api/admin/support/conversations") return send(res, 200, { conversations: [] });
    if (p === "/api/admin/topups") return send(res, 200, { topups: [] });
    if (p === "/api/admin/customers") return send(res, 200, { customers: [] });
    if (p === "/api/admin/restaurants") return send(res, 200, { restaurants: [] });
    return send(res, 200, {});
  });
  return {
    server, log, hang, state,
    listen: (port) => new Promise((ok) => server.listen(port, "127.0.0.1", ok)),
    close: () => new Promise((ok) => server.close(ok)),
    count: (re, sinceIdx = 0) => log.slice(sinceIdx).filter((r) => re.test(r.path)).length,
    denied: (sinceIdx = 0) => log.slice(sinceIdx).filter((r) => r.status === 403),
  };
}
if (require.main === module) { const s = create(); s.listen(Number(process.env.PORT || 4021)).then(() => console.log("admin mock on", process.env.PORT || 4021)); }
module.exports = { create, TOKENS };

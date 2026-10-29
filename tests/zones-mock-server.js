/* Test server for the supervisor zones page: serves /public statically and runs the REAL lib/service-zone-routes.js and the
   REAL role table (lib/admin-roles.js) on plain http (no express in the sandbox). Data lives in memory. Port 4031.
   Tokens: tok-system (system_admin), tok-ordersup (order_supervisor), tok-accountant (accountant). */
"use strict";
const http = require("http"), fs = require("fs"), path = require("path");
const roles = require("../lib/admin-roles");
const { registerServiceZoneRoutes } = require("../lib/service-zone-routes");
const PORT = Number(process.env.PORT || 4031), PUB = path.join(__dirname, "..", "public");
const TOKENS = { "tok-system": "system_admin", "tok-ordersup": "order_supervisor", "tok-accountant": "accountant" };
const files = {}, audit = [], routes = [];
const reg = (m) => (p, ...h) => routes.push({ m, p, h: h.flat() });
const app = { get: reg("GET"), post: reg("POST"), put: reg("PUT"), delete: reg("DELETE") };
const requireAdmin = (req, res, next) => {
  const role = TOKENS[req.headers["x-admin-token"]];
  if (!role) return res.status(401).json({ error: "Unauthorized" });
  const az = roles.authorize(role, req.method, req.originalUrl);
  if (!az.ok) return res.status(az.status).json({ error: az.error });
  req.adminRole = role; req.adminId = "id-" + role; next();
};
registerServiceZoneRoutes(app, {
  requireAdmin, adminRoles: roles, file: "zones",
  readJson: (f, fb) => (files[f] == null ? fb : JSON.parse(JSON.stringify(files[f]))),
  writeJson: (f, d) => { files[f] = JSON.parse(JSON.stringify(d)); },
  appendAuditLog: (e) => audit.push(e),
  getStore: () => null,
});
app.get("/api/admin/me", requireAdmin, (req, res) => res.json({ role: req.adminRole, permissions: roles.permissionsOf(req.adminRole) }));
app.get("/api/map-config", (_q, res) => res.json({ tileUrl: "https://tiles.test/{z}/{x}/{y}.png", attribution: "test" }));
app.get("/__audit", (_q, res) => res.json(audit));
app.post("/__reset", (_q, res) => { for (const k of Object.keys(files)) delete files[k]; audit.length = 0; res.json({ ok: true }); });
app.post("/__seed", (req, res) => { files.zones = req.body; res.json({ ok: true }); });
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json" };
http.createServer((req, res) => {
  const u = new URL(req.url, "http://x"); let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const r = routes.find((x) => x.m === req.method && match(x.p, u.pathname));
    if (r) {
      let body = {}; try { body = raw ? JSON.parse(raw) : {}; } catch (_e) { /* ignore */ }
      const rq = { method: req.method, originalUrl: u.pathname + u.search, params: match(r.p, u.pathname), body, query: Object.fromEntries(u.searchParams), headers: req.headers };
      const rs = { code: 200, h: {}, set(k, v) { this.h[k] = v; return this; }, status(c) { this.code = c; return this; }, json(o) { res.writeHead(this.code, { "Content-Type": "application/json", ...this.h }); res.end(JSON.stringify(o)); } };
      let i = 0; const next = () => { const f = r.h[i++]; if (f) f(rq, rs, next); }; return next();
    }
    let f = path.join(PUB, decodeURIComponent(u.pathname)); if (!f.startsWith(PUB)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
    if (!fs.existsSync(f)) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" }); res.end(fs.readFileSync(f));
  });
}).listen(PORT, "127.0.0.1", () => console.log("zones mock on " + PORT));
function match(pattern, p) {
  const a = pattern.split("/"), b = p.split("/"); if (a.length !== b.length) return null; const params = {};
  for (let i = 0; i < a.length; i++) { if (a[i].startsWith(":")) params[a[i].slice(1)] = b[i]; else if (a[i] !== b[i]) return null; }
  return params;
}

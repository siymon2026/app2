"use strict";
/** TEST-ONLY: serves /public with just enough /api for the driver app boot and the customer orders page.
 *  The rating-prompted route uses the REAL lib/extras-routes.js logic (same state on the order). */
const http = require("http"), fs = require("fs"), path = require("path"), Module = require("node:module");
const orig = Module._load; Module._load = function (r, ...a) { return r === "express-rate-limit" ? () => (_q, _s, n) => n() : orig.call(this, r, ...a); };
const { registerExtrasRoutes } = require("../lib/extras-routes"); Module._load = orig;
const PUB = path.join(__dirname, "..", "public");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".mp3": "audio/mpeg" };
const ago = (h) => new Date(Date.now() - h * 3600e3).toISOString();
const data = { orders: [
  { id: "O-NEW", customerId: "c1", driverId: "D1", status: "delivered", deliveredAt: ago(1), updatedAt: ago(1), createdAt: ago(3), items: [], total: 40, customer: { name: "A", phone: "0611111111", addr: "x" }, restaurantId: "r1" },
] };
const state = { saves: 0, posts: [] };
const routes = {};
registerExtrasRoutes({ get: (p, ...h) => (routes["GET " + p] = h), post: (p, ...h) => (routes["POST " + p] = h) }, {
  requireCustomer: "c", requireDriver: "d", requireApprovedDriver: "a", loadOrders: () => data, saveOrders: () => { state.saves++; },
  dispatchService: { driverFix: () => null }, routeService: {},
});
const fb = require("../lib/driver-feedback");
const send = (res, code, o) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(o)); };
http.createServer((req, res) => {
  const u = new URL(req.url, "http://x"), p = u.pathname;
  let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => {
    if (p === "/__t/state") return send(res, 200, { state, order: data.orders[0] });
    if (p === "/__t/reset") { delete data.orders[0].ratingPromptedAt; delete data.orders[0].driverRating; state.saves = 0; state.posts = []; return send(res, 200, {}); }
    if (p.startsWith("/api/driver/")) {
      if (p === "/api/driver/me") return send(res, 200, { driver: { id: "D1", name: "Driver", status: "approved", phone: "0600000000" } });
      if (p === "/api/driver/orders") return send(res, 200, { available: [], mine: [], stats: {} });
      if (p === "/api/driver/notifications") return send(res, 200, { notifications: [] });
      return send(res, 200, {});
    }
    if (p === "/api/customer/me") return send(res, 200, { customer: { id: "c1", firstName: "A", lastName: "B", phone: "0611111111" } });
    if (p === "/api/customer/notifications") return send(res, 200, { notifications: [], unread: 0 });
    if (p === "/api/customer/orders") return send(res, 200, { orders: data.orders.map((o) => { const cr = fb.canRateDriver(o, Date.now()); return { ...o, canRateDriver: cr.ok, ratingPrompted: !!o.ratingPromptedAt, driverName: "Driver" }; }) });
    const m = p.match(/^\/api\/customer\/orders\/([^/]+)\/(rating-prompted|rate-driver)$/);
    if (m && req.method === "POST") {
      state.posts.push(m[2]);
      const fn = routes["POST /api/customer/orders/:id/" + m[2]].slice(-1)[0];
      const r = { code: 200, status(c) { this.code = c; return this; }, set() {}, json(b) { send(res, this.code, b); } };
      return fn({ params: { id: m[1] }, customerId: "c1", body: JSON.parse(d || "{}") }, r);
    }
    if (p.startsWith("/api/")) return send(res, 200, {});
    let f = path.join(PUB, p); if (p.endsWith("/")) f = path.join(f, "index.html");
    if (!f.startsWith(PUB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end("nf"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-store" }); res.end(fs.readFileSync(f));
  });
}).listen(Number(process.env.PORT || 4015), "127.0.0.1", () => console.log("driver-rate server"));

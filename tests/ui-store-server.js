"use strict";
/* TEST-ONLY: serves /public and the REAL lib/store-routes.js over http with in-memory data
 * (no express needed). Not used in production. */
const http = require("http"), fs = require("fs"), path = require("path");
const catalogLib = require("../lib/catalog");
const { registerStoreRoutes } = require("../lib/store-routes");
const PUB = path.join(__dirname, "..", "public");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".json": "application/json" };
const clone = (x) => JSON.parse(JSON.stringify(x));
const now = Date.now();
const iso = (m) => new Date(now - m * 60000).toISOString();
const files = {
  types: { types: [] }, chats: { conversations: [] }, pharm: { requests: [] }, sch: { channels: [] }, stk: { tickets: [] },
  restaurants: { restaurants: [
    { id: "g1", name: { ar: "بقالة الأمل", fr: "Épicerie Espoir", en: "Hope" }, type: "grocery", isActive: true, minOrder: 30, deliveryFee: 10 },
    { id: "p1", name: { ar: "صيدلية النور", fr: "Pharmacie Nour", en: "Nour" }, type: "pharmacy", isActive: true },
    { id: "r1", name: { ar: "مطعم السلام", fr: "Resto Salam", en: "Salam" }, type: "restaurant", isActive: true },
  ] },
  menu: { items: [
    { id: "i1", restaurantId: "g1", name: { ar: "حليب", fr: "Lait", en: "Milk" }, price: 8, salePrice: 7, stock: 3, cat: "dairy", catLabel: { ar: "ألبان", fr: "Laitiers", en: "Dairy" }, isAvailable: true, attrs: { brand: "Jibal" } },
    { id: "i2", restaurantId: "g1", name: { ar: "سكر", fr: "Sucre", en: "Sugar" }, price: 12, stock: 50, cat: "dry", catLabel: { ar: "جافة", fr: "Sec", en: "Dry" }, isAvailable: true },
    { id: "i3", restaurantId: "r1", name: { ar: "بيتزا", fr: "Pizza", en: "Pizza" }, price: 50, cat: "main", isAvailable: true },
  ] },
  orders: { orders: [
    { id: "ORD100001", restaurantId: "g1", status: "admin_accepted", customerId: "c1", customer: { name: "علي", phone: "0611111111", addr: "حي السلام 12", notes: "الطابق 2" }, items: [{ id: "i1", name: "حليب", qty: 2, price: 7 }], subtotal: 14, deliveryFee: 10, total: 24, paymentMethod: "cod", createdAt: iso(5) },
    { id: "ORD100002", restaurantId: "g1", status: "delivered", customerId: "c2", customer: { name: "Sara", phone: "0622222222", addr: "Rue 5" }, items: [{ id: "i2", name: "سكر", qty: 3, price: 12 }], subtotal: 36, deliveryFee: 10, total: 46, createdAt: iso(300) },
    { id: "ORD200001", restaurantId: "r1", status: "admin_accepted", customerId: "c3", customer: { name: "Other", phone: "0633333333", addr: "x" }, items: [], subtotal: 50, deliveryFee: 0, total: 50, createdAt: iso(10) },
  ] },
  users: { users: [
    { id: "u1", restaurantId: "g1", role: "owner", email: "boss@x.com", password: "pw", isActive: true },
    { id: "u2", restaurantId: "p1", role: "owner", email: "boss@x.com", password: "pw", isActive: true },
    { id: "u3", restaurantId: "g1", role: "cashier", phone: "0600000009", password: "pw", isActive: true },
  ] },
};
const FILES = { "T": "types", "C": "chats", "P": "pharm", "SC": "sch", "ST": "stk" };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const rx = new Map();
const routes = [];
const reg = (m) => (p, ...h) => routes.push({ m, p, h: h.flat() });
const app = { get: reg("GET"), post: reg("POST"), put: reg("PUT"), delete: reg("DELETE"), patch: reg("PATCH") };
let seq = 0;
registerStoreRoutes({
  app, requireAdmin: (q, r, n) => (q.header("X-Admin-Token") === "adm" ? n() : r.status(401).json({ error: "Unauthorized" })),
  requireCustomer: (req, res, next) => { const a = String(req.header("Authorization") || ""); const c = req.header("X-Cust") || (a.startsWith("Bearer cust-") ? a.slice(12) : ""); if (!c) return res.status(401).json({ error: "Unauthorized" }); req.customerId = c; next(); },
  signToken: (p) => "tok:" + Buffer.from(JSON.stringify(p)).toString("base64"),
  verifyToken: (t) => { try { return t && t.startsWith("tok:") ? JSON.parse(Buffer.from(t.slice(4), "base64")) : null; } catch { return null; } },
  verifyPassword: (p, rec) => p === rec, normalizeEmail: (e) => String(e || "").trim().toLowerCase(),
  getRestaurantIdFromToken: () => null,
  loadRestaurants: () => clone(files.restaurants), saveRestaurants: (d) => { files.restaurants = clone(d); },
  loadMenu: () => clone(files.menu), saveMenu: (d) => { files.menu = clone(d); },
  loadOrders: () => clone(files.orders), saveOrders: (d) => { files.orders = clone(d); },
  loadRestaurantUsers: () => clone(files.users),
  readJson: (f, fb) => (files[FILES[f]] ? clone(files[FILES[f]]) : fb), writeJson: (f, d) => { files[FILES[f]] = clone(d); },
  typesFile: "T", chatsFile: "C", makeId: () => "id" + ++seq,
  asI18nText: (v, fb = "") => (typeof v === "string" || !v ? { ar: v || fb, en: v || fb, fr: v || fb } : { ar: v.ar || fb, en: v.en || v.ar || fb, fr: v.fr || v.ar || fb }),
  saveProductImage: (d) => (/^data:image\/(jpeg|png|webp);base64,/.test(String(d || "")) ? "/uploads/menu/test.jpg" : null),
  cleanImgUrl: (v) => (/^(\/uploads\/|https:\/\/)/.test(String(v || "")) ? String(v) : ""),
  catalogLib, safeRestaurant: (r) => { const { password, ...x } = r; return x; },
  support: { channelsFile: "SC", ticketsFile: "ST" },
  pharmacy: {
    file: "P", privateDir: "/rx",
    saveImagePrivate: (d, dir, base) => { if (!/^data:image\/(jpeg|png|webp);base64,/.test(String(d))) return null; rx.set(base + ".png", PNG); return { file: base + ".png", mime: "image/png" }; },
    readPrivate: (f) => rx.get(f) || null,
    isPublicStore: () => true, canReceive: () => ({ ok: true }),
    resolvePayment: () => ({ ok: true, method: "cod" }),
    deliveryFor: async (st) => ({ ok: true, fee: Number(st.deliveryFee || 10), km: 2, snapshot: null }),
    createOrder: ({ request, store, deliveryFee, payment, total }) => { const o = { id: "ORD-" + request.id, status: "admin_accepted", storeAcceptedAt: new Date().toISOString(), restaurantId: store.id, customerId: request.customerId, customer: request.customer, items: request.quote.lines, subtotal: request.quote.medicinesTotal, deliveryFee, total, paymentMethod: payment.method, createdAt: new Date().toISOString() }; files.orders.orders.unshift(o); return o; },
  },
});
app.post("/api/admin/restaurant-users", (q, r, n) => (q.header("X-Admin-Token") === "adm" ? n() : r.status(401).json({ error: "Unauthorized" })), (q, r) => {
  const b = q.body; if (!b.password || b.password.length < 6) return r.status(400).json({ error: "Invalid password" });
  const u = { id: "u" + ++seq, restaurantId: b.restaurantId, role: b.role || "owner", email: b.email || null, phone: b.phone || null, password: b.password, isActive: true };
  files.users.users.push(u); r.json({ ok: true, user: { ...u, password: undefined } });
});
app.patch("/api/admin/restaurant-users/:id", (q, r, n) => (q.header("X-Admin-Token") === "adm" ? n() : r.status(401).json({ error: "Unauthorized" })), (q, r) => {
  const u = files.users.users.find((x) => x.id === q.params.id); if (!u) return r.status(404).json({ error: "nf" });
  if (q.body.role) u.role = q.body.role; if (q.body.isActive !== undefined) u.isActive = q.body.isActive; if (q.body.password) u.password = q.body.password;
  r.json({ ok: true });
});
http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname.startsWith("/api/")) {
    let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => {
      let body = {}; try { body = JSON.parse(d || "{}"); } catch {}
      const query = Object.fromEntries(u.searchParams);
      for (const r of routes) {
        if (r.m !== req.method) continue;
        const rp = r.p.split("/"), up = u.pathname.split("/");
        if (rp.length !== up.length) continue;
        const params = {};
        if (!rp.every((s, i) => (s.startsWith(":") ? ((params[s.slice(1)] = decodeURIComponent(up[i])), true) : s === up[i]))) continue;
        const q = { params, body, query, header: (k) => req.headers[k.toLowerCase()] };
        const s = { code: 200, status(c) { this.code = c; return this; }, setHeader(k, v) { res.setHeader(k, v); }, end(b) { res.writeHead(this.code); res.end(b); }, json(o) { res.writeHead(this.code, { "Content-Type": "application/json" }); res.end(JSON.stringify(o)); } };
        let i = 0; const next = () => { const f = r.h[i++]; if (f) f(q, s, next); }; return next();
      }
      // stand-ins for the two server.js customer routes the pharmacy page reads (test-only)
      if (u.pathname === "/api/customer/me" && req.method === "GET" && /^Bearer cust-/.test(req.headers.authorization || "")) { res.writeHead(200, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ customer: { id: "c1", firstName: "علي", lastName: "الإدريسي", phone: "0611111111" } })); }
      if (u.pathname === "/api/customer/addresses" && req.method === "GET") { res.writeHead(200, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ addresses: [{ id: "a1", label: "المنزل", city: "الرباط", hood: "أكدال", street: "شارع 5", bldg: "12", lat: 34.01, lng: -6.83 }] })); }
      if (u.pathname === "/api/admin/restaurants" && req.method === "GET") { res.writeHead(200, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ ok: true, restaurants: [...files.restaurants.restaurants.map((r) => ({ ...r, loginEmail: "a@b.c", hasPassword: true })), { id: "old1", name: { ar: "مطعم قديم", fr: "Vieux", en: "Old" }, type: "pizza", isActive: true, loginEmail: "z@z.z", hasPassword: true }] })); }
      if (u.pathname === "/api/admin/menu" && req.method === "GET") { res.writeHead(200, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ ok: true, items: files.menu.items })); }
      if (u.pathname.startsWith("/api/admin/") && req.method === "GET") { res.writeHead(200, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ ok: true, orders: [], items: [], users: [], notifications: [], categories: [], banners: [], sections: [] })); }
      res.writeHead(404, { "Content-Type": "application/json" }); res.end('{"error":"nf"}');
    });
    return;
  }
  if (u.pathname === "/admin-harness") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><link rel="stylesheet" href="/admin/admin-store-types.css"><style>body{font-family:sans-serif;background:#fff;color:#111}.btn{padding:6px 10px;border:1px solid #888;border-radius:8px;background:#eee}</style></head><body>
<div id="storesFilterBar"><button id="stTypesBtn" class="btn">types</button></div>
<button class="btn" data-action="store-profile" data-id="g1" id="prof">profile</button>
<script>let lang="ar";function toast(m){window.__toast=m}
async function api(url,o={}){const r=await fetch(url,{...o,headers:{"Content-Type":"application/json","X-Admin-Token":"adm"}});let b=null;try{b=await r.json()}catch(e){}if(!r.ok){throw new Error((b&&b.error)||"HTTP "+r.status)}return b}
window.storesReloadTypes=function(){window.__reloaded=(window.__reloaded||0)+1}</script>
<script src="/admin/admin-store-types.js"></script></body></html>`);
  }
  let f = path.join(PUB, u.pathname === "/" ? "index.html" : u.pathname);
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  if (!f.startsWith(PUB) || !fs.existsSync(f)) { res.writeHead(404); return res.end("nf"); }
  res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
}).listen(Number(process.env.PORT || 4010), () => console.log("ui-store-server ready"));

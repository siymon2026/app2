"use strict";
const catalogLib = require("../lib/catalog");
const { registerStoreRoutes } = require("../lib/store-routes");

/* ---- minimal express stand-in ---- */
function makeApp() {
  const routes = [];
  const reg = (method) => (path, ...h) => routes.push({ method, path, h: h.flat() });
  const app = { get: reg("GET"), post: reg("POST"), put: reg("PUT"), delete: reg("DELETE"), patch: reg("PATCH") };
  async function call(method, url, { headers = {}, body = {}, query = {} } = {}) {
    for (const r of routes) {
      if (r.method !== method) continue;
      const rp = r.path.split("/"), up = url.split("/");
      if (rp.length !== up.length) continue;
      const params = {};
      if (!rp.every((seg, i) => (seg.startsWith(":") ? ((params[seg.slice(1).replace(/\(.*$/, "")] = up[i]), true) : seg === up[i]))) continue;
      const hdr = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
      const req = { params, body, query, header: (k) => hdr[k.toLowerCase()] };
      return await new Promise((resolve) => {
        const hdrs = {}; const res = { code: 200, status(c) { this.code = c; return this; }, json(o) { resolve({ status: this.code, body: o }); }, setHeader(k, v) { hdrs[k.toLowerCase()] = v; }, send(buf) { resolve({ status: this.code, buffer: buf, headers: hdrs }); }, end(buf) { resolve({ status: this.code, buffer: buf, headers: hdrs }); } };
        let i = 0;
        const next = () => { const fn = r.h[i++]; if (fn) fn(req, res, next); };
        next();
      });
    }
    throw new Error(`no route ${method} ${url}`);
  }
  return { app, call };
}

/* ---- in-memory world ---- */
function world() {
  const files = {
    types: { types: [] }, chats: { conversations: [] }, pharm: { requests: [] }, supc: { channels: [] }, supt: { tickets: [] },
    restaurants: { restaurants: [
      { id: "r1", name: { ar: "مطعم", en: "R", fr: "R" }, type: "restaurant", isActive: true },
      { id: "g1", name: { ar: "بقالة", en: "G", fr: "G" }, type: "grocery", isActive: true },
      { id: "p1", name: { ar: "صيدلية", en: "P", fr: "P" }, type: "pharmacy", isActive: true },
    ] },
    menu: { items: [
      { id: "i-r1", restaurantId: "r1", name: { ar: "بيتزا", en: "Pizza", fr: "Pizza" }, price: 50, cat: "main", stock: 5 },
      { id: "i-g1", restaurantId: "g1", name: { ar: "حليب", en: "Milk", fr: "Lait" }, price: 8, cat: "dairy" },
    ] },
    orders: { orders: [
      { id: "o-r1", restaurantId: "r1", status: "admin_accepted", customerId: "c1", customer: { name: "Ali", phone: "0611111111" }, items: [{ id: "i-r1", qty: 2, price: 50 }], total: 100, createdAt: new Date().toISOString() },
      { id: "o-g1", restaurantId: "g1", status: "admin_accepted", customerId: "c2", customer: { name: "Sara", phone: "0622222222" }, items: [], total: 30, createdAt: new Date().toISOString() },
      { id: "o-new", restaurantId: "r1", status: "new", customerId: "c3", customer: { name: "Z", phone: "0633333333" }, items: [], total: 5, createdAt: new Date().toISOString() },
    ] },
    users: { users: [
      { id: "u-own", restaurantId: "g1", role: "owner", email: "boss@x.com", password: "pw", isActive: true },
      { id: "u-own2", restaurantId: "r1", role: "owner", email: "boss@x.com", password: "pw", isActive: true },
      { id: "u-cash", restaurantId: "g1", role: "cashier", phone: "0600000001", password: "pw", isActive: true },
      { id: "u-off", restaurantId: "g1", role: "manager", phone: "0600000002", password: "pw", isActive: false },
      { id: "u-ph", restaurantId: "p1", role: "owner", phone: "0600000003", password: "pw", isActive: true },
    ] },
  };
  const FILES = { "T.json": "types", "C.json": "chats", "P.json": "pharm", "SC.json": "supc", "ST.json": "supt" };
  const rxFiles = new Map(); const orderLog = [];
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const { app, call } = makeApp();
  const notes = [];
  const audits = [];
  let seq = 0;
  const storeApi = registerStoreRoutes({
    app, requireAdmin: (req, res, next) => (req.header("X-Admin") === "1" ? next() : res.status(401).json({ error: "Unauthorized" })),
    requireCustomer: (req, res, next) => { const c = req.header("X-Cust"); if (!c) return res.status(401).json({ error: "Unauthorized" }); req.customerId = c; next(); },
    signToken: (p) => "tok:" + Buffer.from(JSON.stringify(p)).toString("base64"),
    verifyToken: (t) => { try { return t.startsWith("tok:") ? JSON.parse(Buffer.from(t.slice(4), "base64")) : null; } catch { return null; } },
    verifyPassword: (p, rec) => p === rec,
    normalizeEmail: (e) => String(e || "").trim().toLowerCase(),
    getRestaurantIdFromToken: (t) => (t === "legacy-r1" ? "r1" : null),
    loadRestaurants: () => clone(files.restaurants), saveRestaurants: (d) => { files.restaurants = clone(d); },
    loadMenu: () => clone(files.menu), saveMenu: (d) => { files.menu = clone(d); },
    loadOrders: () => clone(files.orders), saveOrders: (d) => { files.orders = clone(d); },
    loadRestaurantUsers: () => clone(files.users), saveRestaurantUsers: (d) => { files.users = clone(d); },
    hashPassword: (p) => "h:" + p, appendAuditLog: (e) => audits.push(e),
    readJson: (f, fb) => (files[FILES[f]] ? clone(files[FILES[f]]) : fb), writeJson: (f, d) => { files[FILES[f]] = clone(d); },
    typesFile: "T.json", chatsFile: "C.json", support: { channelsFile: "SC.json", ticketsFile: "ST.json" },
    makeId: () => "id" + ++seq,
    asI18nText: (v, fb = "") => (typeof v === "string" || !v ? { ar: v || fb, en: v || fb, fr: v || fb } : { ar: v.ar || fb, en: v.en || v.ar || fb, fr: v.fr || v.ar || fb }),
    saveProductImage: (d) => (/^data:image\/(jpeg|png|webp);base64,/.test(String(d || "")) ? "/uploads/menu/t.jpg" : null),
    cleanImgUrl: (v) => (/^(\/uploads\/|https:\/\/)/.test(String(v || "")) ? String(v) : ""),
    catalogLib, safeRestaurant: (r) => { const { password, ...x } = r; return x; },
    notifyCustomer: (n) => notes.push(n), onOrderReady: (o) => notes.push({ ready: o.id }),
    pharmacy: {
      file: "P.json", privateDir: "/rx",
      saveImagePrivate: (d, dir, base) => { if (!/^data:image\/(jpeg|png|webp);base64,/.test(String(d))) return null; const f = base + ".jpg"; rxFiles.set(f, Buffer.from("IMG")); return { file: f, mime: "image/jpeg" }; },
      readPrivate: (f) => rxFiles.get(f) || null,
      isPublicStore: () => true,
      canReceive: () => ({ ok: true }),
      resolvePayment: (m) => ((m || "cod") === "cod" ? { ok: true, method: "cod" } : { ok: false, error: "Online payment unavailable", code: "ONLINE_UNAVAILABLE", method: m }),
      deliveryFor: async (st, c, sub) => (world.deliveryFail ? { ok: false, status: 503, code: "ROUTING_UNAVAILABLE", error: "no route" } : { ok: true, fee: (world.fee ?? 10), km: 3, snapshot: null }),
      createOrder: ({ request, store, deliveryFee, payment, total }) => { const o = { id: "ord-" + request.id, status: "admin_accepted", storeAcceptedAt: new Date().toISOString(), restaurantId: store.id, customerId: request.customerId, customer: request.customer, items: request.quote.lines, subtotal: request.quote.medicinesTotal, deliveryFee, total, paymentMethod: payment.method, createdAt: new Date().toISOString(), pharmacyRequestId: request.id }; files.orders.orders.unshift(o); orderLog.push(o.id); return o; },
    },
  });
  return { files, call, notes, audits, rxFiles, orderLog, app, storeApi };
}


world.fee = 10;
const TOK = (uids, role = "store_user") => "tok:" + Buffer.from(JSON.stringify({ role, uids, id: uids[0], restaurantId: "g1" })).toString("base64");
const H = (token, store) => ({ Authorization: "Bearer " + token, ...(store ? { "X-Store-Id": store } : {}) });
module.exports = { makeApp, world, TOK, H };

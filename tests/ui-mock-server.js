"use strict";
/**
 * TEST-ONLY mock of the Siymon API (no express needed). It serves /public and
 * implements the store/menu/catalog/order endpoints with the SAME logic module
 * (lib/catalog.js) as server.js, so browser UI can be tested where
 * node_modules cannot be installed. NOT used in production.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const cat = require("../lib/catalog");
const pay = require("../lib/payments");
const geo = require("../lib/geocode");
const addrLib = require("../lib/addresses");
const searchLib = require("../lib/search");

const PUB = path.join(__dirname, "..", "public");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json" };
const i18n = (v) => { if (!v) return { ar: "", en: "", fr: "" }; if (typeof v === "string") return { ar: v, en: v, fr: v }; const ar = String(v.ar || ""); const en = String(v.en || ar); return { ar, en, fr: String(v.fr || en) }; };
const cleanImg = (u) => { u = String(u || "").trim(); return /^(\/uploads\/|https:\/\/)/.test(u) && u.length < 600 ? u : ""; };
let n = 0; const makeId = () => "T" + Date.now().toString(36) + (++n);

function create(seed) {
  const state = {
    restaurants: JSON.parse(JSON.stringify(seed.restaurants)),
    items: JSON.parse(JSON.stringify(seed.items)),
    catalog: cat.defaultCatalog(),
    orders: [],
    accountAddresses: [],
    geocodeCalls: [],
  };
  const ADMIN = "test-admin-token";
  const send = (res, code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };
  const body = (req) => new Promise((ok) => { let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => { try { ok(JSON.parse(d || "{}")); } catch { ok({}); } }); });
  const adminRest = (r) => { const { password, ...x } = r; return { ...x, hasPassword: !!password }; };

  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, "http://x");
    const p = u.pathname;
    if (p.startsWith("/api/")) {
      const isAdmin = req.headers["x-admin-token"] === ADMIN;
      const b = req.method === "GET" ? {} : await body(req);
      if (p.startsWith("/api/admin/") && !isAdmin && p !== "/api/admin/login") return send(res, 401, { error: "Unauthorized" });
      const m = (re) => p.match(re);
      if (p === "/api/restaurants") return send(res, 200, { ok: true, restaurants: state.restaurants.filter(cat.isPublic).map((s) => cat.publicStore(s)).sort((a, c) => a.sortOrder - c.sortOrder) });
      if (p === "/api/menu") {
        const pub = new Set(state.restaurants.filter(cat.isPublic).map((r) => String(r.id)));
        let items = state.items.filter((x) => cat.itemOrderable(x) && pub.has(String(x.restaurantId)));
        const rid = u.searchParams.get("restaurantId"); if (rid) items = items.filter((x) => String(x.restaurantId) === rid);
        return send(res, 200, { ok: true, items: items.map((x) => ({ ...x, salePrice: cat.unitPrice(x) !== Number(x.price) ? cat.unitPrice(x) : null })).sort((a, c) => (a.sortOrder || 0) - (c.sortOrder || 0)) });
      }
      if (p === "/api/search") return send(res, 200, { ok: true, ...searchLib.search({ q: String(u.searchParams.get("q") || "").slice(0, 60), items: state.items, stores: state.restaurants.filter(cat.isPublic), limit: Number(u.searchParams.get("limit")) || 12, storeId: String(u.searchParams.get("storeId") || "") }) });
      // customer account stand-ins for the wallet UI tests (test-only; the real routes live in server.js)
      if (p === "/api/customer/wallet" && req.method === "GET") {
        const tk = (req.headers.authorization || "").replace(/^Bearer /i, "") || req.headers["x-customer-token"];
        if (tk !== "ctok") return send(res, 401, { error: "Unauthorized" });
        // Same shape as the real GET /api/customer/wallet (see customerWalletView in server.js).
        const t1 = new Date().toISOString(), t2 = new Date(Date.now() - 3600e3).toISOString();
        const history = [
          { id: "h1", ref: "order:O1:wallet", type: "order_payment", amount: -20, orderId: "O1", status: "succeeded", createdAt: t2 },
          { id: "h2", ref: "topup:t1", type: "topup", amount: 100, topupId: "t1", methodId: "cih", reference: "REF12345", status: "succeeded", createdAt: t1 },
        ];
        return send(res, 200, {
          ok: true, currency: "MAD", walletBalance: 125.5, available: 125.5,
          wallet: { balance: 125.5, currency: "MAD", enabled: true, minTopup: 10, maxTopup: 20000, feePercent: 0, feeFixed: 0, presets: [50, 100, 200, 500], ledgerEntries: 2 },
          totals: { added: 100, used: 20, refunded: 0, loyaltyAdded: 0, adjustedIn: 45.5, adjustedOut: 0, totalIn: 145.5, totalOut: 20, net: 125.5 },
          transactions: [
            { id: "h1", type: "order_payment", direction: "debit", amount: 20, signedAmount: -20, currency: "MAD", status: "succeeded", at: t2, orderId: "O1" },
            { id: "h2", type: "topup", direction: "credit", amount: 100, signedAmount: 100, currency: "MAD", status: "succeeded", at: t1, reference: "REF12345", methodName: { ar: "تحويل بنكي", fr: "Virement", en: "Bank transfer" } },
          ],
          topups: [{ id: "t1", amount: 100, creditAmount: 100, status: "approved", createdAt: t1, reference: "REF12345", methodId: "cih" }],
          loyalty: {
            program: { enabled: true, earn: { enabled: true, unitAmount: 10, pointsPerUnit: 1, rule: "10 MAD = 1 point" }, redeem: { enabled: true, pointsPerCurrencyUnit: 100, minPoints: 100, maxPointsPerTx: 0, rate: 0.01 }, expiry: { enabled: false, days: 365 }, campaigns: [], terms: "terms", customTerms: "" },
            balances: { earnedTotal: 320, adjustments: 0, available: 300, pending: 20, used: 0, expired: 0, reversed: 0, debt: 0 },
            valueMAD: 3, canRedeem: true, minPoints: 100, pointsPerCurrencyUnit: 100, maxPointsPerTx: 0,
            entries: [{ id: "e1", ref: "loyalty:earn:O1", direction: "credit", kind: "earn", points: 320, status: "available", reason: "Order #O1", at: t1 }],
          },
          walletHistory: history,
        });
      }
      if (p === "/api/payment-methods") return send(res, 200, { ok: true, methods: [] });
      if (p === "/api/customer/me" && req.method === "GET") return send(res, 200, { ok: true, customer: { id: "c1", firstName: "علي", lastName: "الإدريسي", phone: "0611111111" } });
      if (p === "/api/customer/orders" && req.method === "GET") return send(res, 200, { ok: true, orders: [] });
      if (p === "/api/customer/notifications") return send(res, 200, { ok: true, notifications: [], unread: 0 });
      if (p === "/api/home") return send(res, 200, { ok: true, ...cat.buildHome({ catalog: state.catalog, stores: state.restaurants, items: state.items }) });
      if (p === "/api/orders" && req.method === "POST") {
        const pm = pay.resolvePaymentMethod(b.paymentMethod);
        if (!pm.ok) return send(res, 400, { error: pm.error, code: pm.code, method: pm.method });
        const st = state.restaurants.find((r) => r.id === b.restaurantId);
        if (!st || st.isActive === false) return send(res, 400, { error: "Invalid restaurantId" });
        const byId = new Map(state.items.filter((x) => x.restaurantId === st.id).map((x) => [String(x.id), x]));
        const pr = cat.computePricing({ store: st, lines: (b.items || []).map((x) => ({ id: x.id, qty: Number(x.qty) })), byId, nameOf: (x) => x.name.ar });
        if (!pr.ok) { const { status, ...rest } = pr; return send(res, status, rest); }
        const o = { id: makeId(), restaurantId: st.id, items: pr.items, subtotal: pr.subtotal, deliveryFee: pr.deliveryFee, total: pr.total, customer: b.customer, paymentMethod: pm.method, status: "new" };
        state.orders.unshift(o); cat.applyStock({ items: state.items }, pr.items);
        return send(res, 200, { ok: true, id: o.id });
      }
      if (p === "/api/geocode/reverse" && req.method === "POST") {
        // Real parsing/validation from lib/geocode.js with a FAKE Nominatim (tests only).
        state.geocodeCalls.push({ lat: b.lat, lng: b.lng });
        const fakeFetch = async (url) => {
          const u = new URL(url); const lat = Number(u.searchParams.get("lat"));
          if (lat < 20) return { ok: false, json: async () => ({}) };            // provider failure
          if (lat > 40) return { ok: true, json: async () => ({ error: "Unable to geocode" }) };
          return { ok: true, json: async () => ({ display_name: "x", address: { suburb: "حي السلام", road: "شارع محمد الخامس", house_number: "12", town: "برشيد" } }) };
        };
        const r = await geo.reverseGeocode({ lat: b.lat, lng: b.lng, lang: b.lang, fetchImpl: fakeFetch });
        if (!r.ok) return send(res, r.status, { error: r.error });
        const { ok, ...d } = r; return send(res, 200, { ok: true, ...d });
      }
      if (p === "/api/customer/addresses") {
        if (req.headers.authorization !== "Bearer cust-token") return send(res, 401, { error: "Unauthorized" });
        if (req.method === "PUT") { state.accountAddresses = addrLib.sanitizeList(b.addresses); state.putCount = (state.putCount || 0) + 1; }
        return send(res, 200, { ok: true, addresses: addrLib.sanitizeList(state.accountAddresses) });
      }
      if (p === "/api/__state") return send(res, 200, { accountAddresses: state.accountAddresses, geocodeCalls: state.geocodeCalls, putCount: state.putCount || 0 });
      if (p === "/api/__seed_account" && req.method === "POST") { state.accountAddresses = b.addresses || []; return send(res, 200, { ok: true }); }
      if (p === "/api/admin/login") return send(res, 200, { ok: true, token: ADMIN });
      if (p === "/api/admin/restaurants") {
        if (req.method === "GET") return send(res, 200, { ok: true, restaurants: state.restaurants.map(adminRest) });
        const r = { id: makeId(), name: i18n(b.name), phone: String(b.phone || ""), address: String(b.address || ""), isActive: true, createdAt: new Date().toISOString(), ...cat.pickStoreMeta(b, i18n, cleanImg) };
        state.restaurants.push(r); return send(res, 200, { ok: true, restaurant: adminRest(r) });
      }
      let mm = m(/^\/api\/admin\/restaurants\/([^/]+)$/);
      if (mm) {
        const i = state.restaurants.findIndex((x) => x.id === decodeURIComponent(mm[1]));
        if (i < 0) return send(res, 404, { error: "Not found" });
        if (req.method === "PUT") { const cur = state.restaurants[i]; if (b.name !== undefined) cur.name = i18n(b.name); if (b.phone !== undefined) cur.phone = String(b.phone); if (b.address !== undefined) cur.address = String(b.address); Object.assign(cur, cat.pickStoreMeta(b, i18n, cleanImg)); return send(res, 200, { ok: true, restaurant: adminRest(cur) }); }
        if (req.method === "DELETE") { if (state.orders.some((o) => o.restaurantId === state.restaurants[i].id)) return send(res, 409, { error: "Restaurant has orders; archive it instead (status: archived)" }); state.restaurants.splice(i, 1); return send(res, 200, { ok: true }); }
      }
      if (p === "/api/admin/menu") {
        if (req.method === "GET") return send(res, 200, { ok: true, items: state.items });
        const it = { id: makeId(), restaurantId: String(b.restaurantId), cat: String(b.cat || "general"), catLabel: i18n(b.catLabel), price: Number(b.price || 0), img: String(b.img || ""), name: i18n(b.name), desc: i18n(b.desc), isAvailable: b.isAvailable !== false, ...cat.pickItemMeta(b) };
        state.items.unshift(it); return send(res, 200, { ok: true, item: it });
      }
      mm = m(/^\/api\/admin\/menu\/([^/]+)$/);
      if (mm) {
        const it = state.items.find((x) => x.id === decodeURIComponent(mm[1]));
        if (!it) return send(res, 404, { error: "Not found" });
        if (req.method === "PUT") { if (b.price !== undefined) it.price = Number(b.price); if (b.name !== undefined) it.name = i18n(b.name); if (b.isAvailable !== undefined) it.isAvailable = b.isAvailable !== false; Object.assign(it, cat.pickItemMeta(b)); return send(res, 200, { ok: true, item: it }); }
      }
      if (p === "/api/admin/catalog") {
        if (req.method === "PUT") state.catalog = cat.sanitizeCatalog(b, { i18n, cleanImg, makeId });
        return send(res, 200, { ok: true, ...state.catalog });
      }
      if (p === "/api/admin/upload/banner-image") return send(res, 200, { ok: true, url: "/uploads/banner/test.webp" });
      if (p === "/api/admin/orders") return send(res, 200, { ok: true, orders: [] });
      return send(res, 200, { ok: true, orders: [], items: [], drivers: [], config: {} });
    }
    let f = path.normalize(path.join(PUB, p === "/" ? "index.html" : p));
    if (!f.startsWith(PUB)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
    if (!fs.existsSync(f) && p.startsWith("/uploads/")) {
      let hsh = 0; for (const ch of p) hsh = (hsh * 31 + ch.charCodeAt(0)) % 360;
      res.writeHead(200, { "Content-Type": "image/svg+xml" });
      return res.end(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="hsl(${hsh},65%,55%)"/><circle cx="200" cy="150" r="70" fill="rgba(255,255,255,.35)"/></svg>`);
    }
    if (!fs.existsSync(f)) { res.writeHead(404); return res.end("nf"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" });
    fs.createReadStream(f).pipe(res);
  });
  return { server, state, ADMIN };
}
module.exports = { create };
if (require.main === module) {
  const data = (process.env.SEED_DIR || "") && process.env.SEED_DIR || path.join(__dirname, "..", "data");
  const seed = { restaurants: require(path.join(data, "restaurants.json")).restaurants, items: require(path.join(data, "menu.json")).items };
  const { server } = create(seed);
  server.listen(Number(process.env.PORT || 4010), () => console.log("mock on", server.address().port));
}

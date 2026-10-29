"use strict";
const test = require("node:test");
const assert = require("node:assert");
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
      if (!rp.every((seg, i) => (seg.startsWith(":") ? ((params[seg.slice(1)] = up[i]), true) : seg === up[i]))) continue;
      const hdr = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
      const req = { params, body, query, header: (k) => hdr[k.toLowerCase()] };
      return await new Promise((resolve) => {
        const res = { code: 200, status(c) { this.code = c; return this; }, json(o) { resolve({ status: this.code, body: o }); } };
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
    types: { types: [] }, chats: { conversations: [] },
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
  const FILES = { "T.json": "types", "C.json": "chats" };
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const { app, call } = makeApp();
  const notes = [];
  const audits = [];
  let seq = 0;
  registerStoreRoutes({
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
    typesFile: "T.json", chatsFile: "C.json",
    makeId: () => "id" + ++seq,
    asI18nText: (v, fb = "") => (typeof v === "string" || !v ? { ar: v || fb, en: v || fb, fr: v || fb } : { ar: v.ar || fb, en: v.en || v.ar || fb, fr: v.fr || v.ar || fb }),
    saveProductImage: (d) => (/^data:image\/(jpeg|png|webp);base64,/.test(String(d || "")) ? "/uploads/menu/t.jpg" : null),
    cleanImgUrl: (v) => (/^(\/uploads\/|https:\/\/)/.test(String(v || "")) ? String(v) : ""),
    catalogLib, safeRestaurant: (r) => { const { password, ...x } = r; return x; },
    notifyCustomer: (n) => notes.push(n), onOrderReady: (o) => notes.push({ ready: o.id }),
  });
  return { files, call, notes, audits };
}

const TOK = (uids, role = "store_user") => "tok:" + Buffer.from(JSON.stringify({ role, uids, id: uids[0], restaurantId: "g1" })).toString("base64");
const H = (token, store) => ({ Authorization: "Bearer " + token, ...(store ? { "X-Store-Id": store } : {}) });

test("login: one account -> several stores, disabled users excluded, wrong pw rejected", async () => {
  const w = world();
  const ok = await w.call("POST", "/api/store/login", { body: { identifier: "boss@x.com", password: "pw" } });
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.body.stores.map((s) => s.id).sort(), ["g1", "r1"]);
  assert.equal((await w.call("POST", "/api/store/login", { body: { identifier: "boss@x.com", password: "bad" } })).status, 401);
  assert.equal((await w.call("POST", "/api/store/login", { body: { identifier: "0600000002", password: "pw" } })).status, 401); // disabled
});

test("multi-store user must pick a store; cannot pick one they don't belong to", async () => {
  const w = world();
  const t = TOK(["u-own", "u-own2"]);
  const none = await w.call("GET", "/api/store/stats", { headers: H(t) });
  assert.equal(none.status, 400);
  assert.equal(none.body.error, "store_required");
  assert.equal((await w.call("GET", "/api/store/stats", { headers: H(t, "p1") })).status, 403);
  assert.equal((await w.call("GET", "/api/store/stats", { headers: H(t, "g1") })).status, 200);
});

test("role comes from the DB record, not the token (forged uids of a disabled user rejected)", async () => {
  const w = world();
  assert.equal((await w.call("GET", "/api/store/me", { headers: H(TOK(["u-off"])) })).status, 401);
  assert.equal((await w.call("GET", "/api/store/me", { headers: H(TOK(["nope"])) })).status, 401);
  assert.equal((await w.call("GET", "/api/store/me", { headers: {} })).status, 401);
});

test("legacy restaurant token still works as owner of its restaurant only", async () => {
  const w = world();
  const r = await w.call("GET", "/api/store/orders", { headers: { "X-Restaurant-Token": "legacy-r1" } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.orders.map((o) => o.id), ["o-r1"]); // "new" hidden (admin reviews first)
  assert.equal((await w.call("GET", "/api/store/orders", { headers: { "X-Restaurant-Token": "legacy-r1", "X-Store-Id": "g1" } })).status, 403);
});

test("TENANT ISOLATION: orders, products, customers, chats of other stores unreachable", async () => {
  const w = world();
  const h = H(TOK(["u-own"]), "g1");
  const orders = await w.call("GET", "/api/store/orders", { headers: h });
  assert.deepEqual(orders.body.orders.map((o) => o.id), ["o-g1"]);
  assert.equal((await w.call("GET", "/api/store/orders/o-r1", { headers: h })).status, 404);
  assert.equal((await w.call("PATCH", "/api/store/orders/o-r1", { headers: h, body: { action: "ready" } })).status, 404);
  assert.equal((await w.call("PUT", "/api/store/products/i-r1", { headers: h, body: { price: 1 } })).status, 404);
  assert.equal((await w.call("DELETE", "/api/store/products/i-r1", { headers: h })).status, 404);
  assert.equal((await w.call("GET", "/api/store/chats/o-r1", { headers: h })).status, 404);
  assert.equal((await w.call("POST", "/api/store/chats/o-r1", { headers: h, body: { text: "hi" } })).status, 404);
  const prods = await w.call("GET", "/api/store/products", { headers: h });
  assert.deepEqual(prods.body.items.map((i) => i.id), ["i-g1"]);
  const cust = await w.call("GET", "/api/store/customers", { headers: h });
  assert.deepEqual(cust.body.customers.map((c) => c.customerId), ["c2"]);
  assert.equal(w.files.menu.items.find((i) => i.id === "i-r1").price, 50); // untouched
});

test("cashier: can read orders, masked phone, cannot write products/price/settings", async () => {
  const w = world();
  const h = H(TOK(["u-cash"]), "g1");
  const o = await w.call("GET", "/api/store/orders/o-g1", { headers: h });
  assert.equal(o.body.order.customer.phone, "••••••2222");
  assert.equal((await w.call("POST", "/api/store/products", { headers: h, body: { name: "x", price: 1 } })).status, 403);
  assert.equal((await w.call("PUT", "/api/store/settings", { headers: h, body: { minOrder: 1 } })).status, 403);
  assert.equal((await w.call("GET", "/api/store/customers", { headers: h })).status, 403); // cashier has no customers.read
  const owner = await w.call("GET", "/api/store/orders/o-g1", { headers: H(TOK(["u-own"]), "g1") });
  assert.equal(owner.body.order.customer.phone, "0622222222");
});

test("me: sections follow store type and role", async () => {
  const w = world();
  const own = await w.call("GET", "/api/store/me", { headers: H(TOK(["u-own"]), "g1") });
  assert.ok(own.body.sections.includes("inventory") && own.body.sections.includes("settings"));
  const cash = await w.call("GET", "/api/store/me", { headers: H(TOK(["u-cash"]), "g1") });
  assert.ok(!cash.body.sections.includes("settings") && !cash.body.sections.includes("reports"));
  const rest = await w.call("GET", "/api/store/me", { headers: { "X-Restaurant-Token": "legacy-r1" } });
  assert.ok(!rest.body.sections.includes("inventory")); // restaurants don't show inventory
  assert.equal(rest.body.type.flow, "admin_review");
});

test("orders flow: accept -> ready triggers dispatch hook once; reject needs reason, restocks, notifies", async () => {
  const w = world();
  const h = { "X-Restaurant-Token": "legacy-r1" };
  assert.equal((await w.call("PATCH", "/api/store/orders/o-r1", { headers: h, body: { action: "accept" } })).body.order.stage, "preparing");
  assert.equal((await w.call("PATCH", "/api/store/orders/o-r1", { headers: h, body: { action: "teleport" } })).status, 400);
  const rdy = await w.call("PATCH", "/api/store/orders/o-r1", { headers: h, body: { action: "ready" } });
  assert.equal(rdy.body.order.status, "restaurant_ready");
  await w.call("PATCH", "/api/store/orders/o-r1", { headers: h, body: { action: "ready" } }); // idempotent
  assert.equal(w.notes.filter((n) => n.ready).length, 1);
  assert.equal((await w.call("PATCH", "/api/store/orders/o-r1", { headers: h, body: { action: "reject", reason: "no stock" } })).status, 409); // too late

  const w2 = world();
  assert.equal((await w2.call("PATCH", "/api/store/orders/o-r1", { headers: h, body: { action: "reject", reason: "x" } })).status, 400);
  const rj = await w2.call("PATCH", "/api/store/orders/o-r1", { headers: h, body: { action: "reject", reason: "Out of stock" } });
  assert.equal(rj.body.order.stage, "canceled");
  assert.equal(w2.files.menu.items.find((i) => i.id === "i-r1").stock, 7); // 5 + 2 restocked
  assert.equal(w2.notes[0].customerId, "c1");
});

test("products: create with attrs, price rules, sale price, archive vs hard delete", async () => {
  const w = world();
  const own = H(TOK(["u-own"]), "g1");
  const bad = await w.call("POST", "/api/store/products", { headers: own, body: { name: "Tomato", price: 10, attrs: { unit: "tonne" } } });
  assert.equal(bad.status, 400);
  const ok = await w.call("POST", "/api/store/products", { headers: own, body: { name: "Tomato", price: 10, salePrice: 8, stock: 40, cat: "veg", attrs: { unit: "kg", evil: 1 } } });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.item.restaurantId, "g1");
  assert.deepEqual(ok.body.item.attrs, { unit: "kg" });
  assert.equal(ok.body.item.attrs.evil, undefined);
  assert.equal((await w.call("PUT", `/api/store/products/${ok.body.item.id}`, { headers: own, body: { salePrice: 12 } })).status, 400);
  assert.equal((await w.call("POST", "/api/store/products", { headers: own, body: { name: "x", price: -1 } })).status, 400);
  const bodyOwner = { name: "Z", price: 3, restaurantId: "r1" }; // client-sent store id must be ignored
  const z = await w.call("POST", "/api/store/products", { headers: own, body: bodyOwner });
  assert.equal(z.body.item.restaurantId, "g1");
  assert.equal((await w.call("DELETE", `/api/store/products/${z.body.item.id}`, { headers: own })).status, 200);
  assert.equal(w.files.menu.items.find((i) => i.id === z.body.item.id).archived, true);
  const mgr = world(); // manager cannot hard-delete
  mgr.files.users.users.push({ id: "u-mgr", restaurantId: "g1", role: "manager", email: "m@x.com", password: "pw", isActive: true });
  assert.equal((await mgr.call("DELETE", "/api/store/products/i-g1", { headers: H(TOK(["u-mgr"]), "g1"), query: { hard: "1" } })).status, 403);
  assert.equal((await mgr.call("DELETE", "/api/store/products/i-g1", { headers: H(TOK(["u-own"]), "g1"), query: { hard: "1" } })).status, 200);
});

test("pharmacy: controlled medicine refused; prescription item saved but forced unavailable", async () => {
  const w = world();
  const h = H(TOK(["u-ph"]), "p1");
  const c = await w.call("POST", "/api/store/products", { headers: h, body: { name: "X", price: 5, attrs: { controlled: true } } });
  assert.equal(c.status, 422);
  const p = await w.call("POST", "/api/store/products", { headers: h, body: { name: "Antibiotic", price: 30, isAvailable: true, attrs: { requiresPrescription: true } } });
  assert.equal(p.status, 200);
  assert.equal(p.body.item.isAvailable, false);
  const re = await w.call("PUT", `/api/store/products/${p.body.item.id}`, { headers: h, body: { isAvailable: true } });
  assert.equal(re.body.item.isAvailable, false); // cannot be re-enabled
});

test("settings: store can pause itself but cannot change type/featured/unpublish", async () => {
  const w = world();
  const h = H(TOK(["u-own"]), "g1");
  const r = await w.call("PUT", "/api/store/settings", { headers: h, body: { status: "paused", minOrder: 20, type: "pharmacy", featured: true, sortOrder: 9 } });
  assert.equal(r.status, 200);
  const g = w.files.restaurants.restaurants.find((x) => x.id === "g1");
  assert.equal(g.status, "paused");
  assert.equal(g.minOrder, 20);
  assert.equal(g.type, "grocery");
  assert.equal(g.featured, undefined);
  assert.equal((await w.call("PUT", "/api/store/settings", { headers: h, body: { status: "unpublished" } })).status, 200);
  assert.equal(w.files.restaurants.restaurants.find((x) => x.id === "g1").status, "paused"); // ignored
});

test("chat: store <-> customer round trip, unread counts, other customers blocked", async () => {
  const w = world();
  const sh = H(TOK(["u-cash"]), "g1");
  assert.equal((await w.call("POST", "/api/store/chats/o-g1", { headers: sh, body: { text: "Votre commande est prête" } })).status, 200);
  assert.equal((await w.call("POST", "/api/store/chats/o-g1", { headers: sh, body: { text: "   " } })).status, 400);
  assert.equal((await w.call("GET", "/api/customer/store-chats", { headers: { "X-Cust": "c2" } })).body.chats[0].unread, 1);
  assert.equal((await w.call("GET", "/api/customer/store-chats/o-g1", { headers: { "X-Cust": "c1" } })).status, 404); // not his order
  assert.equal((await w.call("GET", "/api/customer/store-chats/o-g1", { headers: { "X-Cust": "c2" } })).body.messages.length, 1);
  await w.call("POST", "/api/customer/store-chats/o-g1", { headers: { "X-Cust": "c2" }, body: { text: "Merci" } });
  const st = await w.call("GET", "/api/store/stats", { headers: sh });
  assert.equal(st.body.stats.unreadMessages, 1);
  assert.equal((await w.call("GET", "/api/store/chats", { headers: sh })).body.chats[0].unread, 1);
  await w.call("GET", "/api/store/chats/o-g1", { headers: sh });
  assert.equal((await w.call("GET", "/api/store/stats", { headers: sh })).body.stats.unreadMessages, 0);
  assert.equal(w.notes.filter((n) => n.type === "store_message").length, 1);
  // other store's staff can't see this conversation
  assert.equal((await w.call("GET", "/api/store/chats", { headers: { "X-Restaurant-Token": "legacy-r1" } })).body.chats.length, 0);
});

test("admin: type CRUD, in-use/built-in protection, store overview; non-admin blocked", async () => {
  const w = world();
  const A = { "X-Admin": "1" };
  assert.equal((await w.call("GET", "/api/admin/store-types", {})).status, 401);
  const list = await w.call("GET", "/api/admin/store-types", { headers: A });
  assert.equal(list.body.types.find((t) => t.id === "grocery").stores, 1);
  const c = await w.call("POST", "/api/admin/store-types", { headers: A, body: { id: "toys", name: "ألعاب", flow: "direct", sections: ["orders"], productFields: [{ key: "age", kind: "number", min: 0, max: 18 }] } });
  assert.equal(c.status, 200);
  assert.equal((await w.call("POST", "/api/admin/store-types", { headers: A, body: { id: "toys", name: "x" } })).status, 409);
  assert.equal((await w.call("PUT", "/api/admin/store-types/cafe", { headers: A, body: { enabled: false } })).body.type.enabled, false);
  assert.equal((await w.call("DELETE", "/api/admin/store-types/grocery", { headers: A })).status, 409);
  assert.equal((await w.call("DELETE", "/api/admin/store-types/toys", { headers: A })).status, 200);
  const ov = await w.call("GET", "/api/admin/stores/g1/overview", { headers: A });
  assert.equal(ov.body.type.id, "grocery");
  assert.equal(ov.body.accounts.length, 3);
  assert.equal(ov.body.accounts[0].password, undefined);
  assert.equal(ov.body.stats.newOrders, 1);
});

test("admin: enter-as-store issues a short-lived owner token; non-admin and unknown store refused", async () => {
  const w = world();
  assert.equal((await w.call("POST", "/api/admin/stores/g1/enter", {})).status, 401);
  assert.equal((await w.call("POST", "/api/admin/stores/nope/enter", { headers: { "X-Admin": "1" } })).status, 404);
  const r = await w.call("POST", "/api/admin/stores/g1/enter", { headers: { "X-Admin": "1" } });
  assert.equal(r.status, 200);
  const payload = JSON.parse(Buffer.from(r.body.token.slice(4), "base64"));
  assert.equal(payload.id, "g1");
  assert.equal(payload.role, "restaurant");
  assert.equal(r.body.store.password, undefined);
});

test("merchant uploads a product photo (needs products.write; bad data refused)", async () => {
  const w = world();
  const png = "data:image/png;base64,iVBORw0KGgo=";
  assert.equal((await w.call("POST", "/api/store/upload/image", { body: { image: png } })).status, 401);
  const ok = await w.call("POST", "/api/store/upload/image", { headers: H(TOK(["u-own"]), "g1"), body: { image: png } });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.url, "/uploads/menu/t.jpg");
  assert.equal((await w.call("POST", "/api/store/upload/image", { headers: H(TOK(["u-own"]), "g1"), body: { image: "http://x/y.png" } })).status, 400);
  assert.equal((await w.call("POST", "/api/store/upload/image", { headers: H(TOK(["u-cash"]), "g1"), body: { image: png } })).status, 403);
});

test("staff: owner manages own store's cashiers/managers; not owners, not self, not other stores", async () => {
  const w = world();
  const own = H(TOK(["u-own"]), "g1");
  const cash = H(TOK(["u-cash"]), "g1");
  // a cashier cannot even list or create
  assert.equal((await w.call("GET", "/api/store/members", { headers: cash })).status, 403);
  assert.equal((await w.call("POST", "/api/store/members", { headers: cash, body: { email: "n@x.co", password: "12345678" } })).status, 403);
  // owner lists only own store
  const list = await w.call("GET", "/api/store/members", { headers: own });
  assert.deepEqual(list.body.members.map((m) => m.id).sort(), ["u-cash", "u-off", "u-own"]);
  assert.ok(list.body.members.every((m) => m.password === undefined));
  // create: manager ok, owner refused, weak password refused
  const c = await w.call("POST", "/api/store/members", { headers: own, body: { email: "New@X.co", password: "12345678", role: "manager" } });
  assert.equal(c.status, 200);
  assert.equal(c.body.member.role, "manager");
  assert.equal(w.files.users.users[0].restaurantId, "g1");
  assert.equal(w.files.users.users[0].password, "h:12345678");
  assert.equal((await w.call("POST", "/api/store/members", { headers: own, body: { email: "o@x.co", password: "12345678", role: "owner" } })).status, 400);
  assert.equal((await w.call("POST", "/api/store/members", { headers: own, body: { email: "w@x.co", password: "123" } })).status, 400);
  // update: disable cashier ok; self + owner protected; other store's user is invisible
  assert.equal((await w.call("PATCH", "/api/store/members/u-cash", { headers: own, body: { isActive: false } })).status, 200);
  assert.equal(w.files.users.users.find((u) => u.id === "u-cash").isActive, false);
  assert.equal((await w.call("PATCH", "/api/store/members/u-own", { headers: own, body: { isActive: false } })).status, 403);
  assert.equal((await w.call("PATCH", "/api/store/members/u-ph", { headers: own, body: { isActive: false } })).status, 404);
  assert.equal(w.files.users.users.find((u) => u.id === "u-ph").isActive, true);
  assert.ok(w.audits.some((a) => a.action === "store.member.create"));
  assert.ok(w.audits.some((a) => a.action === "store.member.update"));
});

test("chat: idempotent on clientId (retry/double tap never duplicates), incremental ?after, both sides consistent", async () => {
  const w = world();
  const sh = H(TOK(["u-cash"]), "g1");
  const C = { headers: { "X-Cust": "c2" } };
  const a1 = await w.call("POST", "/api/customer/store-chats/o-g1", { ...C, body: { text: "Bonjour", clientId: "cid-aaaaaa" } });
  const a2 = await w.call("POST", "/api/customer/store-chats/o-g1", { ...C, body: { text: "Bonjour", clientId: "cid-aaaaaa" } }); // retry
  assert.equal(a1.body.duplicate, false);
  assert.equal(a2.body.duplicate, true);
  assert.equal(a2.body.message.id, a1.body.message.id);
  const s1 = await w.call("POST", "/api/store/chats/o-g1", { headers: sh, body: { text: "Oui ?", clientId: "cid-bbbbbb" } });
  await w.call("POST", "/api/store/chats/o-g1", { headers: sh, body: { text: "Oui ?", clientId: "cid-bbbbbb" } });
  // same clientId from the OTHER side is a different message
  await w.call("POST", "/api/customer/store-chats/o-g1", { ...C, body: { text: "ok", clientId: "cid-bbbbbb" } });
  const full = await w.call("GET", "/api/customer/store-chats/o-g1", C);
  assert.equal(full.body.messages.length, 3);
  assert.equal(full.body.store.name, "بقالة");
  assert.equal(full.body.lastId, full.body.messages[2].id);
  // incremental: nothing new -> empty; after the first message -> the other two; store sees the same thread
  assert.equal((await w.call("GET", "/api/customer/store-chats/o-g1", { ...C, query: { after: full.body.lastId } })).body.messages.length, 0);
  const inc = await w.call("GET", "/api/customer/store-chats/o-g1", { ...C, query: { after: a1.body.message.id } });
  assert.deepEqual(inc.body.messages.map((m) => m.text), ["Oui ?", "ok"]);
  const st = await w.call("GET", "/api/store/chats/o-g1", { headers: sh });
  assert.deepEqual(st.body.messages.map((m) => m.id), full.body.messages.map((m) => m.id));
  // unknown anchor -> full list flagged reset (client replaces its list instead of losing messages)
  const rs = await w.call("GET", "/api/customer/store-chats/o-g1", { ...C, query: { after: "gone" } });
  assert.equal(rs.body.reset, true);
  assert.equal(rs.body.messages.length, 3);
  // one notification for the customer (the duplicate POST did not notify twice)
  assert.equal(w.notes.filter((n) => n.type === "store_message").length, 1);
  assert.ok(s1.body.message.clientId === "cid-bbbbbb");
});

test("chat: bad clientId is ignored (not trusted), still delivered; others cannot read; admin can read", async () => {
  const w = world();
  const C = { headers: { "X-Cust": "c2" } };
  const r = await w.call("POST", "/api/customer/store-chats/o-g1", { ...C, body: { text: "x", clientId: "<script>" } });
  assert.equal(r.status, 200);
  assert.equal(r.body.message.clientId, null);
  assert.equal((await w.call("POST", "/api/customer/store-chats/o-g1", { headers: { "X-Cust": "c1" }, body: { text: "hack" } })).status, 404);
  assert.equal((await w.call("POST", "/api/customer/store-chats/o-g1", { ...C, body: { text: "y".repeat(5000) } })).body.message.text.length, 1000);
  const adm = await w.call("GET", "/api/admin/orders/o-g1/store-chat", { headers: { "X-Admin": "1" } });
  assert.equal(adm.status, 200);
  assert.equal(adm.body.messages.length, 2);
  assert.equal((await w.call("GET", "/api/admin/orders/o-g1/store-chat", {})).status, 401);
});

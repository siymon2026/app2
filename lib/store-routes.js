"use strict";
/**
 * /api/store/*  — unified dashboard API for every business type.
 * /api/admin/store-types, /api/admin/stores/:id/overview — super admin.
 * /api/customer/store-chats* — customer side of store<->customer chat.
 *
 * Security model (all enforced here, never in the browser):
 *  - identity comes from a signed token; role/store membership are re-read
 *    from the server-side records on EVERY request;
 *  - the store is chosen with X-Store-Id but only accepted if the caller is a
 *    member of it; every resource is then filtered by that store id.
 */

const S = require("./stores");
const orderState = require("./order-state");
const financeLib = require("./finance");
const M = require("./store-members");

function registerStoreRoutes(deps) {
  const {
    app,
    requireAdmin,
    requireCustomer,
    extraStats = null, // (storeId) => object merged into the dashboard stats (complaints awaiting an answer, ...)
    loginMiddleware = [],
    signToken,
    verifyToken,
    verifyPassword,
    normalizeEmail,
    getRestaurantIdFromToken,
    loadRestaurants,
    saveRestaurants,
    loadMenu,
    saveMenu,
    loadOrders,
    saveOrders,
    loadRestaurantUsers,
    saveRestaurantUsers = null,
    hashPassword = null,
    appendAuditLog = () => {},
    readJson,
    writeJson,
    typesFile,
    chatsFile,
    makeId,
    asI18nText,
    cleanImgUrl,
    saveProductImage = () => null,
    catalogLib,
    safeRestaurant,
    notifyCustomer = () => {},
    onOrderReady = () => {},
    pickupCodeFor = () => null,
    statementFor = null,
    storeTokenTtl = "12h",
    support = null, // see lib/support-routes.js (store<->admin support; optional)
    pharmacy = null, // see lib/pharmacy-routes.js (optional: stores without it simply have no pharmacy requests)
  } = deps;

  /** Order as shown to a store user, plus the pickup code (store-only) when applicable. */
  const storeOrderView = (o, role) => {
    const v = S.orderForStore(o, role);
    const pc = pickupCodeFor(o);
    if (pc) v.pickupCode = pc;
    return v;
  };

  /* ---------------- data helpers ---------------- */

  const loadTypes = () => S.mergeTypes(readJson(typesFile, { types: [] }));
  const saveStoredTypes = (types) => writeJson(typesFile, { types });
  const storedTypes = () => {
    const d = readJson(typesFile, { types: [] });
    return Array.isArray(d.types) ? d.types : [];
  };
  const loadChats = () => {
    const d = readJson(chatsFile, { conversations: [] });
    d.conversations = Array.isArray(d.conversations) ? d.conversations : [];
    return d;
  };
  const saveChats = (d) => writeJson(chatsFile, d);

  const role = (r) => (S.ROLES.includes(String(r)) ? String(r) : "cashier"); // least privilege
  const cleanText = (v, max) => String(v == null ? "" : v).replace(/[<>]/g, "").trim().slice(0, max);

  /* ---------------- auth ---------------- */

  function tokenFromReq(req) {
    const auth = String(req.header("Authorization") || "");
    if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
    return (
      req.header("X-Store-Token") ||
      req.header("X-Restaurant-User-Token") ||
      req.header("X-Restaurant-Token") ||
      ""
    );
  }

  /** -> [{storeId, role, userId}] derived from server-side records. */
  function resolveAccess(token) {
    if (!token) return null;
    const decoded = verifyToken(token);
    if (decoded && (decoded.role === "store_user" || decoded.role === "restaurant_user")) {
      const ids = decoded.role === "store_user" ? (Array.isArray(decoded.uids) ? decoded.uids : []) : [decoded.id];
      const users = loadRestaurantUsers().users || [];
      const out = [];
      for (const uid of ids.map(String)) {
        const u = users.find((x) => String(x.id) === uid);
        if (!u || u.isActive === false) continue;
        if (decoded.role === "restaurant_user" && String(u.restaurantId) !== String(decoded.restaurantId)) continue;
        out.push({ storeId: String(u.restaurantId), role: role(u.role), userId: String(u.id) });
      }
      return out;
    }
    const rid = getRestaurantIdFromToken(token); // legacy single-password restaurant token
    return rid ? [{ storeId: String(rid), role: "owner", userId: null }] : null;
  }

  function requireStore(perm) {
    return (req, res, next) => {
      const access = resolveAccess(tokenFromReq(req));
      if (!access || !access.length) return res.status(401).json({ error: "Unauthorized" });

      const all = loadRestaurants().restaurants || [];
      const usable = access.filter((a) => {
        const r = all.find((x) => String(x.id) === a.storeId);
        return r && r.isActive !== false;
      });
      if (!usable.length) return res.status(403).json({ error: "Store disabled" });

      const wanted = String(req.header("X-Store-Id") || "").trim();
      let pick = null;
      if (wanted) {
        pick = usable.find((a) => a.storeId === wanted);
        if (!pick) return res.status(403).json({ error: "Forbidden" });
      } else if (usable.length === 1) pick = usable[0];
      else {
        return res.status(400).json({
          error: "store_required",
          stores: usable.map((a) => ({ id: a.storeId, role: a.role })),
        });
      }
      if (perm && !S.can(pick.role, perm)) return res.status(403).json({ error: "Forbidden" });

      req.store = all.find((x) => String(x.id) === pick.storeId);
      req.storeId = pick.storeId;
      req.storeRole = pick.role;
      req.storeUserId = pick.userId;
      req.storeAccess = usable;
      req.storeType = S.getType(loadTypes(), req.store.type);
      next();
    };
  }

  const storeBrief = (r, types, rl) => ({
    id: String(r.id),
    name: r.name,
    logo: r.logo || "",
    type: S.getType(types, r.type)?.id,
    role: rl,
  });

  /* ---------------- login (one account, many stores) ---------------- */

  app.post("/api/store/login", ...loginMiddleware, (req, res) => {
    let email = normalizeEmail(req.body?.email);
    let phone = String(req.body?.phone || "").replace(/\D/g, "");
    const identifier = String(req.body?.identifier || "").trim();
    const password = String(req.body?.password || "");
    if (identifier && !email && !phone) {
      if (identifier.includes("@")) email = normalizeEmail(identifier);
      else phone = identifier.replace(/\D/g, "");
    }
    if ((!email && !phone) || !password) return res.status(400).json({ error: "Missing credentials" });

    const users = (loadRestaurantUsers().users || []).filter(
      (u) =>
        (email && normalizeEmail(u.email) === email) ||
        (phone && String(u.phone || "").replace(/\D/g, "") === phone),
    );
    const matched = users.filter((u) => u.isActive !== false && verifyPassword(password, u.password));
    if (!matched.length) return res.status(401).json({ error: "Wrong credentials" });

    const all = loadRestaurants().restaurants || [];
    const live = matched.filter((u) => all.some((r) => String(r.id) === String(u.restaurantId) && r.isActive !== false));
    if (!live.length) return res.status(403).json({ error: "Store disabled" });

    const types = loadTypes();
    const token = signToken({ id: String(live[0].id), role: "store_user", uids: live.map((u) => String(u.id)) }, storeTokenTtl);
    res.json({
      ok: true,
      token,
      stores: live.map((u) => storeBrief(all.find((r) => String(r.id) === String(u.restaurantId)), types, role(u.role))),
    });
  });

  /* ---------------- me / navigation ---------------- */

  app.get("/api/store/me", requireStore(null), (req, res) => {
    const types = loadTypes();
    const all = loadRestaurants().restaurants || [];
    const sections = S.sectionsFor(req.storeType).filter((k) => S.can(req.storeRole, S.SECTIONS[k].perm));
    res.json({
      ok: true,
      store: safeRestaurant(req.store),
      type: req.storeType,
      role: req.storeRole,
      userId: req.storeUserId || null,
      sections,
      permissions: S.PERMISSIONS[req.storeRole] || [],
      stores: req.storeAccess.map((a) => storeBrief(all.find((r) => String(r.id) === a.storeId), types, a.role)),
    });
  });

  /* ---------------- dashboard ---------------- */

  const unreadChatsFor = (storeId) =>
    loadChats()
      .conversations.filter((c) => String(c.storeId) === String(storeId))
      .reduce((n, c) => n + S.unreadForStore(c), 0);

  app.get("/api/store/stats", requireStore("dashboard.read"), (req, res) => {
    const days = Math.min(365, Math.max(1, Math.round(Number(req.query.days) || 7)));
    const from = Date.now() - days * 86400000;
    const stats = S.computeStoreStats({
      orders: loadOrders().orders || [],
      items: loadMenu().items || [],
      storeId: req.storeId,
      from,
    });
    stats.unreadMessages = unreadChatsFor(req.storeId);
    if (pharmacyApi && S.isPharmacyType(req.storeType)) {
      const rq = pharmacyApi.load().requests.filter((r) => String(r.storeId) === String(req.storeId));
      stats.pendingPharmacy = rq.filter((r) => r.status === "pending" && pharmacyApi.P.effectiveStatus(r) === "pending").length;
    }
    if (support && support.ticketsFile) {
      const tk = readJson(support.ticketsFile, { tickets: [] });
      stats.supportUnread = (Array.isArray(tk.tickets) ? tk.tickets : []).filter((t) => String(t.storeId) === String(req.storeId)).reduce((n, t) => n + (Number(t.unreadStore) || 0), 0);
    }
    if (extraStats) { try { Object.assign(stats, extraStats(req.storeId) || {}); } catch (_e) {} }
    res.json({ ok: true, days, stats, currency: "MAD" });
  });

  /* ---------------- orders ---------------- */

  const visibleToStore = (o) => String(o.status || "new") !== "new";
  const stage = (o) => {
    const st = String(o.status || "new");
    if (st === "admin_accepted") return o.storeAcceptedAt ? "preparing" : "new";
    if (st === "restaurant_ready") return "ready";
    if (["accepted", "picked_up", "on_the_way", "sent"].includes(st)) return "on_delivery";
    if (["delivered", "done"].includes(st)) return "done";
    if (st === "canceled") return "canceled";
    return st;
  };
  const myOrders = (storeId) =>
    (loadOrders().orders || []).filter((o) => String(o.restaurantId || "") === String(storeId) && visibleToStore(o));

  app.get("/api/store/orders", requireStore("orders.read"), (req, res) => {
    const want = String(req.query.stage || "").trim();
    const q = String(req.query.q || "").trim().toLowerCase();
    const from = Date.parse(req.query.from) || 0;
    const to = Date.parse(req.query.to) || 0;
    let list = myOrders(req.storeId).filter((o) => {
      if (want && want !== "all" && stage(o) !== want) return false;
      const t = Date.parse(o.createdAt);
      if (from && t < from) return false;
      if (to && t > to + 86399999) return false;
      if (q && !String(o.id).toLowerCase().includes(q) && !String(o.customer?.name || "").toLowerCase().includes(q)) return false;
      return true;
    });
    const total = list.length;
    list = list.slice(0, 200).map((o) => ({ ...storeOrderView(o, req.storeRole), stage: stage(o) }));
    res.json({ ok: true, total, orders: list });
  });

  app.get("/api/store/orders/:id", requireStore("orders.read"), (req, res) => {
    const o = myOrders(req.storeId).find((x) => String(x.id) === String(req.params.id));
    if (!o) return res.status(404).json({ error: "Not found" }); // same answer for "other store" -> no probing
    res.json({ ok: true, order: { ...storeOrderView(o, req.storeRole), stage: stage(o) } });
  });

  function restock(items) {
    const m = loadMenu();
    let changed = false;
    for (const it of items || []) {
      const p = (m.items || []).find((x) => String(x.id) === String(it.id));
      if (p && p.stock !== undefined && p.stock !== null) {
        p.stock = Number(p.stock) + Number(it.qty || 0);
        changed = true;
      }
    }
    if (changed) saveMenu(m);
  }

  // A store sees ONLY its own statement (store id comes from the token, never the URL).
  app.get("/api/store/statement", requireStore("reports.read"), (req, res) => {
    if (!statementFor) return res.status(501).json({ error: "Not available" });
    res.json({ ok: true, ...statementFor(req.storeId, req.query || {}) });
  });

  app.patch("/api/store/orders/:id", requireStore("orders.update"), (req, res) => {
    const data = loadOrders();
    const idx = (data.orders || []).findIndex(
      (o) => String(o.id) === String(req.params.id) && String(o.restaurantId || "") === String(req.storeId) && visibleToStore(o),
    );
    if (idx < 0) return res.status(404).json({ error: "Not found" });
    const o = data.orders[idx];
    const action = String(req.body?.action || "");
    const st = String(o.status || "new");
    const now = new Date().toISOString();

    const fromStatus = st;
    if (action === "accept") {
      if (st !== "admin_accepted") return res.status(409).json({ error: "Order not pending" });
      o.storeAcceptedAt = o.storeAcceptedAt || now;
    } else if (action === "ready") {
      if (st !== "admin_accepted" && st !== "restaurant_ready") return res.status(409).json({ error: "Order not ready for store" });
      if (st === "admin_accepted") {
        o.status = "restaurant_ready";
        o.storeAcceptedAt = o.storeAcceptedAt || now;
        o.restaurantReadyAt = o.restaurantReadyAt || now;
      }
    } else if (action === "reject") {
      const reason = cleanText(req.body?.reason, 300);
      if (st !== "admin_accepted") return res.status(409).json({ error: "Order can no longer be rejected" });
      if (reason.length < 3) return res.status(400).json({ error: "Reason required" });
      o.status = "canceled";
      o.cancelReason = reason;
      o.canceledBy = "store";
      o.canceledAt = now;
    } else return res.status(400).json({ error: "Invalid action" });

    financeLib.finalize(o, new Date(now));
    if (String(o.status || "") !== fromStatus) {
      orderState.recordEvent(o, { from: fromStatus, to: o.status, actorType: "store", actorId: req.storeId, at: now });
    }
    o.updatedAt = now;
    data.orders[idx] = o;
    saveOrders(data);

    if (action === "reject") {
      restock(o.items);
      try {
        notifyCustomer({ customerId: o.customerId, orderId: o.id, type: "order_status", title: "تحديث الطلب", message: `تعذّر تنفيذ طلبك #${o.id}: ${o.cancelReason}` });
      } catch (_e) {}
    }
    if (action === "ready" && st === "admin_accepted") {
      try {
        onOrderReady(o);
      } catch (_e) {}
    }
    res.json({ ok: true, order: { ...storeOrderView(o, req.storeRole), stage: stage(o) } });
  });

  /* ---------------- staff (owner self-service, own store only) ---------------- */

  const memberView = (u) => ({ id: u.id, email: u.email || null, phone: u.phone || null, role: role(u.role), isActive: u.isActive !== false, createdAt: u.createdAt || null });
  const storeUsers = (storeId) => (loadRestaurantUsers().users || []).filter((u) => String(u.restaurantId) === String(storeId));

  app.get("/api/store/members", requireStore("members.read"), (req, res) => {
    res.json({ ok: true, members: storeUsers(req.storeId).map(memberView), assignableRoles: M.ASSIGNABLE });
  });

  app.post("/api/store/members", requireStore("members.write"), (req, res) => {
    if (!saveRestaurantUsers || !hashPassword) return res.status(501).json({ error: "Not available" });
    const v = M.validateCreate(req.body, storeUsers(req.storeId), normalizeEmail);
    if (!v.ok) return res.status(v.status).json({ error: v.error, code: v.code });
    const data = loadRestaurantUsers();
    const now = new Date().toISOString();
    const rec = {
      id: makeId(), restaurantId: String(req.storeId), email: v.value.email, phone: v.value.phone,
      role: v.value.role, isActive: true, password: hashPassword(v.value.password), createdAt: now, updatedAt: now,
    };
    data.users.unshift(rec);
    saveRestaurantUsers(data);
    appendAuditLog({ actorType: "store", actorId: String(req.storeUserId || ""), action: "store.member.create", storeId: String(req.storeId), memberId: rec.id, role: rec.role });
    res.json({ ok: true, member: memberView(rec) });
  });

  app.patch("/api/store/members/:id", requireStore("members.write"), (req, res) => {
    if (!saveRestaurantUsers || !hashPassword) return res.status(501).json({ error: "Not available" });
    const data = loadRestaurantUsers();
    // the target must belong to THIS store (another store's user id looks like "not found")
    const idx = (data.users || []).findIndex((u) => String(u.id) === String(req.params.id) && String(u.restaurantId) === String(req.storeId));
    const v = M.validateUpdate({ userId: req.storeUserId }, idx < 0 ? null : data.users[idx], req.body);
    if (!v.ok) return res.status(v.status).json({ error: v.error, code: v.code });
    const cur = data.users[idx];
    const { password, ...rest } = v.patch;
    Object.assign(cur, rest);
    if (password) cur.password = hashPassword(password);
    cur.updatedAt = new Date().toISOString();
    saveRestaurantUsers(data);
    appendAuditLog({ actorType: "store", actorId: String(req.storeUserId || ""), action: "store.member.update", storeId: String(req.storeId), memberId: cur.id, changed: Object.keys(v.patch).map((k) => (k === "password" ? "password" : k)) });
    res.json({ ok: true, member: memberView(cur) });
  });

  /* ---------------- products ---------------- */

  const bodyProduct = (req, cur) => {
    const b = req.body || {};
    const out = {};
    const wantsPrice = b.price !== undefined || b.salePrice !== undefined;
    if (wantsPrice && !S.can(req.storeRole, "products.price")) return { error: "Forbidden", status: 403 };

    if (b.name !== undefined) {
      out.name = asI18nText(b.name, cur?.name?.ar || "");
      if (!(out.name.ar || out.name.en || out.name.fr)) return { error: "Missing name" };
    }
    if (b.desc !== undefined) out.desc = asI18nText(b.desc, "");
    if (b.cat !== undefined) out.cat = cleanText(b.cat, 60) || "general";
    if (b.catLabel !== undefined || b.cat !== undefined) out.catLabel = asI18nText(b.catLabel || out.cat || cur?.cat || "general", out.cat || cur?.cat || "general");
    if (b.price !== undefined) {
      const p = Number(b.price);
      if (!Number.isFinite(p) || p < 0 || p > 1000000) return { error: "Invalid price" };
      out.price = Math.round(p * 100) / 100;
    }
    if (b.img !== undefined || b.image !== undefined) out.img = cleanImgUrl(b.img ?? b.image);
    if (b.isAvailable !== undefined) out.isAvailable = b.isAvailable !== false;

    const meta = catalogLib.pickItemMeta(b);
    delete meta.featured; // homepage curation belongs to the super admin
    delete meta.trending;
    Object.assign(out, meta);
    const price = out.price ?? cur?.price;
    if (out.salePrice != null && out.salePrice >= price) return { error: "Sale price must be lower than price" };

    if (b.attrs !== undefined) {
      const v = S.validateAttrs(req.storeType, b.attrs);
      if (!v.ok) return { error: "Invalid attributes", details: v.errors };
      const reg = S.checkRegulated(v.attrs);
      if (!reg.ok) return { error: reg.error, status: 422 };
      out.attrs = v.attrs;
    }
    return { ok: true, patch: out };
  };

  const applyBlock = (item) => {
    if (S.blockedForSale(item)) item.isAvailable = false; // never sellable online
  };
  const mineItems = (m, storeId) => (m.items || []).filter((it) => String(it.restaurantId || "") === String(storeId));

  // Merchant uploads a product photo (browser sends a resized JPEG/PNG/WebP data URL)
  app.post("/api/store/upload/image", requireStore("products.write"), (req, res) => {
    let url = null;
    try { url = saveProductImage(req.body && (req.body.image || req.body.dataUrl)); }
    catch (e) { return res.status(400).json({ error: String((e && e.message) || "Invalid image").slice(0, 120) }); }
    if (!url) return res.status(400).json({ error: "Invalid image" });
    res.json({ ok: true, url });
  });

  app.get("/api/store/products", requireStore("products.read"), (req, res) => {
    const q = String(req.query.q || "").trim().toLowerCase();
    const cat = String(req.query.cat || "").trim();
    const status = String(req.query.status || "").trim(); // available|unavailable|archived|low
    let list = mineItems(loadMenu(), req.storeId).filter((it) => {
      if (status === "archived") return it.archived === true;
      if (it.archived === true) return false;
      if (cat && it.cat !== cat) return false;
      if (status === "available" && it.isAvailable === false) return false;
      if (status === "unavailable" && it.isAvailable !== false) return false;
      if (status === "low" && !(it.stock != null && Number(it.stock) <= 5)) return false;
      if (q) {
        const n = it.name || {};
        const hay = `${n.ar || ""} ${n.fr || ""} ${n.en || ""} ${it.cat || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    res.json({ ok: true, total: list.length, items: list.slice(0, 500), fields: req.storeType?.productFields || [] });
  });

  app.post("/api/store/products", requireStore("products.write"), (req, res) => {
    const r = bodyProduct(req, null);
    if (!r.ok) return res.status(r.status || 400).json({ error: r.error, details: r.details });
    if (!r.patch.name) return res.status(400).json({ error: "Missing name" });
    if (r.patch.price === undefined) return res.status(400).json({ error: "Invalid price" });
    const now = new Date().toISOString();
    const item = {
      id: makeId(),
      restaurantId: String(req.storeId),
      desc: { ar: "", fr: "", en: "" },
      cat: "general",
      catLabel: asI18nText("general", "general"),
      img: "",
      isAvailable: true,
      createdAt: now,
      updatedAt: now,
      ...r.patch,
    };
    applyBlock(item);
    const m = loadMenu();
    m.items.unshift(item);
    saveMenu(m);
    res.json({ ok: true, item });
  });

  app.put("/api/store/products/:id", requireStore("products.write"), (req, res) => {
    const m = loadMenu();
    const idx = m.items.findIndex((x) => String(x.id) === String(req.params.id) && String(x.restaurantId || "") === String(req.storeId));
    if (idx < 0) return res.status(404).json({ error: "Not found" });
    const cur = m.items[idx];
    const r = bodyProduct(req, cur);
    if (!r.ok) return res.status(r.status || 400).json({ error: r.error, details: r.details });
    Object.assign(cur, r.patch, { updatedAt: new Date().toISOString() });
    applyBlock(cur);
    m.items[idx] = cur;
    saveMenu(m);
    res.json({ ok: true, item: cur });
  });

  app.delete("/api/store/products/:id", requireStore("products.write"), (req, res) => {
    const m = loadMenu();
    const idx = m.items.findIndex((x) => String(x.id) === String(req.params.id) && String(x.restaurantId || "") === String(req.storeId));
    if (idx < 0) return res.status(404).json({ error: "Not found" });
    if (String(req.query.hard || "") === "1") {
      if (!S.can(req.storeRole, "products.delete")) return res.status(403).json({ error: "Forbidden" });
      m.items.splice(idx, 1);
    } else {
      m.items[idx].archived = true; // archive (reversible); orders keep their snapshot
      m.items[idx].updatedAt = new Date().toISOString();
    }
    saveMenu(m);
    res.json({ ok: true });
  });

  app.get("/api/store/categories", requireStore("products.read"), (req, res) => {
    const map = new Map();
    for (const it of mineItems(loadMenu(), req.storeId)) {
      if (it.archived === true) continue;
      const c = map.get(it.cat) || { cat: it.cat, label: it.catLabel, count: 0 };
      c.count++;
      map.set(it.cat, c);
    }
    res.json({ ok: true, categories: [...map.values()] });
  });

  app.put("/api/store/categories/:cat", requireStore("products.write"), (req, res) => {
    const from = String(req.params.cat);
    const to = cleanText(req.body?.cat, 60);
    if (!to) return res.status(400).json({ error: "Missing category" });
    const label = asI18nText(req.body?.label || to, to);
    const m = loadMenu();
    let n = 0;
    for (const it of mineItems(m, req.storeId)) {
      if (it.cat === from) {
        it.cat = to;
        it.catLabel = label;
        n++;
      }
    }
    if (n) saveMenu(m);
    res.json({ ok: true, updated: n });
  });

  /* ---------------- customers (only those with an order here) ---------------- */

  app.get("/api/store/customers", requireStore("customers.read"), (req, res) => {
    const chats = loadChats().conversations.filter((c) => String(c.storeId) === String(req.storeId));
    const map = new Map();
    for (const o of myOrders(req.storeId)) {
      if (!o.customerId) continue;
      const k = String(o.customerId);
      const c = map.get(k) || { customerId: k, name: o.customer?.name || "", orders: 0, spent: 0, lastOrderAt: null, lastOrderId: null, phone: "" };
      c.orders++;
      if (S.computeStoreStats({ orders: [o], items: [], storeId: req.storeId }).sales) c.spent += Number(o.total || 0);
      if (!c.lastOrderAt || o.createdAt > c.lastOrderAt) {
        c.lastOrderAt = o.createdAt;
        c.lastOrderId = o.id;
        c.phone = S.can(req.storeRole, "customers.contact") ? String(o.customer?.phone || "") : S.maskPhone(o.customer?.phone);
      }
      map.set(k, c);
    }
    const list = [...map.values()]
      .map((c) => ({ ...c, spent: Math.round(c.spent * 100) / 100, unread: chats.filter((x) => String(x.customerId) === c.customerId).reduce((n, x) => n + S.unreadForStore(x), 0) }))
      .sort((a, b) => String(b.lastOrderAt).localeCompare(String(a.lastOrderAt)));
    res.json({ ok: true, customers: list });
  });

  /* ---------------- chat: store side ---------------- */

  let pharmacyApi = null; // set at the end (needs requireStore etc.)
  // A pharmacy request behaves like an order for chat purposes (the request id is the conversation key).
  const requestAsOrder = (r) => (r ? { id: r.id, restaurantId: r.storeId, customerId: r.customerId, customer: { name: r.customer && r.customer.name }, status: "request", total: 0, createdAt: r.createdAt } : null);
  const findOrder = (id) =>
    (loadOrders().orders || []).find((o) => String(o.id) === String(id)) ||
    (pharmacyApi ? requestAsOrder(pharmacyApi.findIn(pharmacyApi.load(), id)) : null);
  const convFor = (data, orderId) => data.conversations.find((c) => String(c.orderId) === String(orderId));

  app.get("/api/store/chats", requireStore("chat.use"), (req, res) => {
    const orders = new Map(myOrders(req.storeId).map((o) => [String(o.id), o]));
    if (pharmacyApi) for (const r of pharmacyApi.load().requests) if (String(r.storeId) === String(req.storeId)) orders.set(String(r.id), requestAsOrder(r));
    const list = loadChats()
      .conversations.filter((c) => String(c.storeId) === String(req.storeId) && orders.has(String(c.orderId)))
      .map((c) => {
        const last = c.messages[c.messages.length - 1] || null;
        const o = orders.get(String(c.orderId));
        return { orderId: c.orderId, customerName: o.customer?.name || "", unread: S.unreadForStore(c), last, updatedAt: c.updatedAt };
      })
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    res.json({ ok: true, chats: list });
  });

  const storeName = (id) => { const r = (loadRestaurants().restaurants || []).find((x) => String(x.id) === String(id)); return r ? (r.name && (r.name.ar || r.name.en)) || String(r.name || "") : ""; };

  // Shared by both sides: same shape, incremental (?after=<lastMessageId>), marks the viewer's side as read.
  function threadResponse(order, side, afterId) {
    const data = loadChats();
    const conv = convFor(data, order.id);
    if (conv && S.markRead(conv, side)) saveChats(data);
    const { messages, reset } = S.messagesAfter(conv, afterId);
    const all = conv ? conv.messages : [];
    return { ok: true, messages, reset, lastId: all.length ? all[all.length - 1].id : null, total: all.length };
  }
  // Shared POST: idempotent on clientId, so retries / double taps / reloads never duplicate or lose a message.
  function postMessage(order, from, userId, body) {
    const msg = S.newMessage({ id: makeId(), from, userId, text: body && body.text, clientId: body && body.clientId });
    if (!msg) return { status: 400, body: { error: "Empty message" } };
    const data = loadChats();
    let conv = convFor(data, order.id);
    if (!conv) {
      conv = { id: makeId(), orderId: String(order.id), storeId: String(order.restaurantId), customerId: String(order.customerId), messages: [], createdAt: msg.at, updatedAt: msg.at };
      data.conversations.push(conv);
    }
    const r = S.appendMessage(conv, msg);
    if (!r.duplicate) saveChats(data);
    return { status: 200, body: { ok: true, message: r.msg, duplicate: r.duplicate }, fresh: !r.duplicate };
  }

  app.get("/api/store/chats/:orderId", requireStore("chat.use"), (req, res) => {
    const o = findOrder(req.params.orderId);
    if (!S.canConverse(o, req.storeId) || !visibleToStore(o)) return res.status(404).json({ error: "Not found" });
    res.json({ ...threadResponse(o, "store", req.query.after), order: { id: o.id, stage: stage(o), total: o.total, customerName: o.customer?.name || "" } });
  });

  app.post("/api/store/chats/:orderId", requireStore("chat.use"), (req, res) => {
    const o = findOrder(req.params.orderId);
    if (!S.canConverse(o, req.storeId) || !visibleToStore(o)) return res.status(404).json({ error: "Not found" });
    const r = postMessage(o, "store", req.storeUserId, req.body);
    if (r.fresh) {
      try {
        notifyCustomer({ customerId: o.customerId, orderId: o.id, type: "store_message", title: "رسالة من المتجر", message: r.body.message.text.slice(0, 120) });
      } catch (_e) {}
    }
    res.status(r.status).json(r.body);
  });

  /* ---------------- chat: customer side ---------------- */

  const customerOrder = (req) => {
    const o = findOrder(req.params.orderId);
    return o && String(o.customerId || "") === String(req.customerId) && o.restaurantId ? o : null;
  };

  app.get("/api/customer/store-chats", requireCustomer, (req, res) => {
    const list = loadChats()
      .conversations.filter((c) => String(c.customerId) === String(req.customerId))
      .map((c) => ({ orderId: c.orderId, storeId: c.storeId, storeName: storeName(c.storeId), unread: S.unreadForCustomer(c), last: c.messages[c.messages.length - 1] || null }));
    res.json({ ok: true, chats: list });
  });

  app.get("/api/customer/store-chats/:orderId", requireCustomer, (req, res) => {
    const o = customerOrder(req);
    if (!o) return res.status(404).json({ error: "Not found" });
    res.json({ ...threadResponse(o, "customer", req.query.after), store: { id: String(o.restaurantId), name: storeName(o.restaurantId) } });
  });

  app.post("/api/customer/store-chats/:orderId", requireCustomer, (req, res) => {
    const o = customerOrder(req);
    if (!o) return res.status(404).json({ error: "Not found" });
    const r = postMessage(o, "customer", req.customerId, req.body);
    res.status(r.status).json(r.body);
  });

  // Supervisor view of the same conversation (read-only; permission support.use via lib/admin-roles.js)
  app.get("/api/admin/orders/:orderId/store-chat", requireAdmin, (req, res) => {
    const o = findOrder(req.params.orderId);
    if (!o) return res.status(404).json({ error: "Not found" });
    const conv = convFor(loadChats(), o.id);
    res.json({ ok: true, orderId: String(o.id), store: { id: String(o.restaurantId || ""), name: storeName(o.restaurantId) }, customerName: o.customer?.name || "", messages: conv ? conv.messages.slice(-300) : [] });
  });

  /* ---------------- store settings (owner only) ---------------- */

  app.put("/api/store/settings", requireStore("settings.write"), (req, res) => {
    const r = loadRestaurants();
    const cur = r.restaurants.find((x) => String(x.id) === String(req.storeId));
    const b = req.body || {};
    const meta = catalogLib.pickStoreMeta(b, asI18nText, cleanImgUrl);
    const allowed = ["hours", "description", "minOrder", "deliveryFee", "freeDeliveryOver", "avgDeliveryMin", "logo", "cover", "city", "area"];
    const patch = {};
    for (const k of allowed) if (meta[k] !== undefined) patch[k] = meta[k];
    // A store may pause/resume itself; publishing/unpublishing/archiving is the admin's call.
    if (b.status === "active" || b.status === "paused") {
      if (!["active", "paused"].includes(catalogLib.effectiveStatus(cur))) return res.status(403).json({ error: "Forbidden" });
      patch.status = b.status;
      patch.isActive = true;
    }
    if (b.phone !== undefined) patch.phone = cleanText(b.phone, 25);
    if (b.address !== undefined) patch.address = cleanText(b.address, 200);
    if (b.name !== undefined) patch.name = asI18nText(b.name, cur.name?.ar || "");
    Object.assign(cur, patch);
    saveRestaurants(r);
    res.json({ ok: true, store: safeRestaurant(cur) });
  });

  /* ---------------- super admin: types ---------------- */

  const storeCount = (types) => {
    const stores = loadRestaurants().restaurants || [];
    return types.map((t) => ({ ...t, stores: stores.filter((s) => S.getType(types, s.type)?.id === t.id && String(s.type || "restaurant") === t.id).length }));
  };

  app.get("/api/admin/store-types", requireAdmin, (_req, res) => {
    res.json({ ok: true, types: storeCount(loadTypes()), sections: S.ALL_SECTIONS, units: S.UNITS });
  });

  app.post("/api/admin/store-types", requireAdmin, (req, res) => {
    const types = loadTypes();
    const r = S.sanitizeType(req.body);
    if (!r.ok) return res.status(400).json({ error: r.error });
    if (types.some((t) => t.id === r.type.id)) return res.status(409).json({ error: "Type exists" });
    const list = storedTypes();
    list.push({ ...r.type, builtin: false });
    saveStoredTypes(list);
    res.json({ ok: true, type: r.type });
  });

  app.put("/api/admin/store-types/:id", requireAdmin, (req, res) => {
    const types = loadTypes();
    const cur = types.find((t) => t.id === String(req.params.id));
    if (!cur) return res.status(404).json({ error: "Not found" });
    const r = S.sanitizeType(req.body, { existing: cur });
    if (!r.ok) return res.status(400).json({ error: r.error });
    const list = storedTypes().filter((t) => t.id !== cur.id);
    list.push(r.type);
    saveStoredTypes(list);
    res.json({ ok: true, type: r.type });
  });

  app.delete("/api/admin/store-types/:id", requireAdmin, (req, res) => {
    const types = loadTypes();
    const cur = types.find((t) => t.id === String(req.params.id));
    if (!cur) return res.status(404).json({ error: "Not found" });
    if (!S.canDeleteType(cur, loadRestaurants().restaurants)) return res.status(409).json({ error: "Type is built-in or in use; disable it instead" });
    saveStoredTypes(storedTypes().filter((t) => t.id !== cur.id));
    res.json({ ok: true });
  });

  /* ---------------- super admin: store profile ---------------- */

  // Super admin "enter as store": a short-lived owner token for the store dashboard (/store/) and the
  // restaurant portal (/restaurant/). Role "restaurant" is the legacy owner token both already accept.
  app.post("/api/admin/stores/:id/enter", requireAdmin, (req, res) => {
    const store = (loadRestaurants().restaurants || []).find((x) => String(x.id) === String(req.params.id));
    if (!store) return res.status(404).json({ error: "Not found" });
    const token = signToken({ id: String(store.id), role: "restaurant", impersonatedBy: "admin" }, "4h");
    res.json({ ok: true, token, store: safeRestaurant(store) });
  });

  app.get("/api/admin/stores/:id/overview", requireAdmin, (req, res) => {
    const store = (loadRestaurants().restaurants || []).find((x) => String(x.id) === String(req.params.id));
    if (!store) return res.status(404).json({ error: "Not found" });
    const types = loadTypes();
    const users = (loadRestaurantUsers().users || [])
      .filter((u) => String(u.restaurantId) === String(store.id))
      .map((u) => ({ id: u.id, role: u.role, email: u.email || null, phone: u.phone || null, isActive: u.isActive !== false }));
    const stats = S.computeStoreStats({ orders: loadOrders().orders || [], items: loadMenu().items || [], storeId: store.id, from: Date.now() - 30 * 86400000 });
    stats.unreadMessages = unreadChatsFor(store.id);
    res.json({
      ok: true,
      store: { ...safeRestaurant(store), status: catalogLib.effectiveStatus(store) },
      type: S.getType(types, store.type),
      accounts: users,
      stats,
      days: 30,
    });
  });

  if (pharmacy) {
    pharmacyApi = require("./pharmacy-routes").registerPharmacyRoutes(app, {
      S, requireStore, requireCustomer, loadRestaurants, loadChats, saveChats, makeId, readJson, writeJson,
      notifyCustomer, appendAuditLog, ...pharmacy,
    });
    pharmacyApi.P = require("./pharmacy");
  }

  if (support) {
    require("./support-routes").registerSupportRoutes(app, {
      requireStore, requireAdmin, readJson, writeJson, loadRestaurants, makeId, appendAuditLog, ...support,
    });
  }

  return { requireStore, resolveAccess, loadTypes };
}

module.exports = { registerStoreRoutes };

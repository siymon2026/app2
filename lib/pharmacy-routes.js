"use strict";
/**
 * Pharmacy request routes (registered from lib/store-routes.js, which owns store auth).
 *
 *  Customer : POST/GET /api/customer/pharmacy/requests[/:id][/prescription]   accept | decline | cancel
 *  Pharmacy : GET /api/store/pharmacy/requests[/:id][/prescription]           POST .../:id/quote
 *  Public   : GET /api/pharmacy/stores
 *
 * A request is NOT an order. Only `accept` (by the customer, on the pharmacist's offer) creates a real order through
 * deps.createOrder(), which enters the normal store -> ready -> driver dispatch flow.
 */
const P = require("./pharmacy");

function registerPharmacyRoutes(app, deps) {
  const {
    S, requireStore, requireCustomer, loadRestaurants, loadChats, saveChats, makeId,
    readJson, writeJson, file, saveImagePrivate, readPrivate, deliveryFor, createOrder, resolvePayment,
    canReceive = () => ({ ok: true }), notifyCustomer = () => {}, appendAuditLog = () => {}, isPublicStore = () => true, privateDir, maxPrescriptionBytes = 6 * 1024 * 1024,
  } = deps;

  const load = () => {
    const d = readJson(file, { requests: [] });
    d.requests = Array.isArray(d.requests) ? d.requests : [];
    return d;
  };
  const save = (d) => writeJson(file, d);
  const storeOf = (id) => (loadRestaurants().restaurants || []).find((r) => String(r.id) === String(id));
  const nameOf = (st) => (st ? (st.name && (st.name.ar || st.name.en)) || String(st.name || "") : "");
  const isPharmacy = (st, types) => !!st && String(st.type || "") === "pharmacy";

  const findIn = (d, id) => d.requests.find((r) => r.id === String(id));
  const mine = (req, r) => r && String(r.customerId) === String(req.customerId);

  // Expire lazily and persist, so what is stored matches what is shown.
  function fresh(d) {
    let changed = false;
    for (const r of d.requests) if (P.applyExpiry(r)) changed = true;
    if (changed) save(d);
    return d;
  }

  /* ---------------- public: which pharmacies can I ask? ---------------- */
  app.get("/api/pharmacy/stores", (_req, res) => {
    const list = (loadRestaurants().restaurants || [])
      .filter((r) => isPharmacy(r) && r.isActive !== false && isPublicStore(r))
      .map((r) => ({ id: String(r.id), name: r.name, logo: r.logo || "", address: r.address || "", city: r.city || "" }));
    res.json({ ok: true, stores: list });
  });

  /* ---------------- customer ---------------- */

  app.post("/api/customer/pharmacy/requests", requireCustomer, (req, res) => {
    const b = req.body || {};
    const hasRx = !!(b.prescription && String(b.prescription).startsWith("data:"));
    const v = P.validateCreate(b, { hasPrescription: hasRx });
    if (!v.ok) return res.status(400).json({ error: v.error, code: v.code });
    const st = storeOf(v.value.storeId);
    if (!st || !isPharmacy(st) || st.isActive === false || !isPublicStore(st)) return res.status(404).json({ error: "Pharmacy not found", code: "STORE_NOT_FOUND" });

    const d = fresh(load());
    // Idempotent: a retried/double-tapped submit returns the same request
    if (v.value.clientId) {
      const dup = d.requests.find((r) => r.clientId === v.value.clientId && String(r.customerId) === String(req.customerId));
      if (dup) return res.json({ ok: true, duplicate: true, request: P.customerView(dup, { store: { name: nameOf(st) } }) });
    }
    const open = d.requests.filter((r) => String(r.customerId) === String(req.customerId) && P.OPEN.includes(r.status)).length;
    if (open >= P.LIMITS.maxOpenPerCustomer) return res.status(429).json({ error: "Too many open requests", code: "TOO_MANY_OPEN" });

    let id = P.newRequestId();
    while (findIn(d, id)) id = P.newRequestId();
    let rx = null;
    if (hasRx) {
      try { rx = saveImagePrivate(b.prescription, privateDir, id + "_rx", { maxBytes: maxPrescriptionBytes }); }
      catch (e) { return res.status(400).json({ error: String((e && e.message) || "Invalid image").slice(0, 120), code: "INVALID_IMAGE" }); }
      if (!rx) return res.status(400).json({ error: "Invalid image (JPG/PNG/WebP only)", code: "INVALID_IMAGE" });
    }
    const rec = P.create({ id, storeId: st.id, customerId: req.customerId, value: v.value, prescription: rx });
    d.requests.unshift(rec);
    save(d);

    // Message to the pharmacist (same conversation system as orders; the request id is the conversation key)
    try {
      const c = loadChats();
      const m = S.newMessage({
        id: makeId(), from: "customer", userId: req.customerId,
        text: `💊 ${rec.id}: ${rec.text || ""}${rx ? " 📎" : ""}`.slice(0, 1000),
      });
      if (m) {
        c.conversations.push({ id: makeId(), orderId: rec.id, storeId: String(st.id), customerId: String(req.customerId), messages: [m], createdAt: m.at, updatedAt: m.at });
        saveChats(c);
      }
    } catch (_e) { /* the request itself is saved; the dashboard badge does not depend on the message */ }
    res.status(201).json({ ok: true, request: P.customerView(rec, { store: { name: nameOf(st) } }) });
  });

  app.get("/api/customer/pharmacy/requests", requireCustomer, (req, res) => {
    const d = fresh(load());
    const list = d.requests.filter((r) => mine(req, r)).slice(0, 100).map((r) => P.customerView(r, { store: { name: nameOf(storeOf(r.storeId)) } }));
    res.json({ ok: true, requests: list });
  });

  // detail + the server-computed delivery fee/total of the CURRENT offer
  app.get("/api/customer/pharmacy/requests/:id", requireCustomer, async (req, res) => {
    const d = fresh(load());
    const r = findIn(d, req.params.id);
    if (!mine(req, r)) return res.status(404).json({ error: "Not found" });
    const st = storeOf(r.storeId);
    let delivery = null, deliveryError = null;
    if (P.effectiveStatus(r) === "quoted" && r.quote && r.quote.available) {
      const q = await deliveryFor(st, r.customer, r.quote.medicinesTotal);
      if (q.ok) delivery = { fee: q.fee, km: q.km || null }; else deliveryError = { code: q.code, error: q.error, reason: q.reason, message: q.message };
    }
    res.json({ ok: true, request: { ...P.customerView(r, { store: { name: nameOf(st) }, delivery }), deliveryError } });
  });

  app.get("/api/customer/pharmacy/requests/:id/prescription", requireCustomer, (req, res) => {
    const r = findIn(load(), req.params.id);
    if (!mine(req, r) || !r.prescription) return res.status(404).json({ error: "Not found" });
    return sendPrivate(res, r.prescription);
  });

  app.post("/api/customer/pharmacy/requests/:id/accept", requireCustomer, async (req, res) => {
    const id = String(req.params.id);
    let d = fresh(load());
    let r = findIn(d, id);
    if (!mine(req, r)) return res.status(404).json({ error: "Not found" });
    if (r.status === "accepted") return res.json({ ok: true, already: true, orderId: r.orderId }); // double tap / retry
    if (P.effectiveStatus(r) !== "quoted" || !r.quote || !r.quote.available) {
      const c = P.canAccept(r, { total: 0 });
      return res.status(c.status || 409).json({ error: c.error, code: c.code });
    }
    const pay = resolvePayment(req.body && req.body.paymentMethod);
    if (!pay.ok) return res.status(400).json({ error: pay.error, code: pay.code, method: pay.method });
    const st = storeOf(r.storeId);
    if (!st || st.isActive === false) return res.status(403).json({ error: "Pharmacy unavailable", code: "STORE_UNAVAILABLE" });

    const can = canReceive(st.id);
    if (!can.ok) return res.status(can.error === "Restaurant disabled" ? 403 : 402).json({ error: can.error || "Not allowed", code: "STORE_UNAVAILABLE" });
    const q = await deliveryFor(st, r.customer, r.quote.medicinesTotal); // async (routing) — re-validate afterwards
    if (!q.ok) return res.status(q.status || 503).json({ error: q.error, code: q.code, reason: q.reason, message: q.message });

    // Everything below is synchronous: re-read the request, so two concurrent accepts can never both create an order.
    d = fresh(load());
    r = findIn(d, id);
    if (!mine(req, r)) return res.status(404).json({ error: "Not found" });
    if (r.status === "accepted") return res.json({ ok: true, already: true, orderId: r.orderId });
    const total = Math.round((r.quote.medicinesTotal + q.fee + Number.EPSILON) * 100) / 100;
    const ok = P.canAccept(r, { total, expectTotal: req.body && req.body.expectTotal });
    if (!ok.ok) return res.status(ok.status).json({ error: ok.error, code: ok.code, total: ok.total });

    let order;
    try { order = createOrder({ request: r, store: st, deliveryFee: q.fee, deliverySnapshot: q.snapshot || null, serviceZone: q.serviceZone || null, payment: pay, total }); }
    catch (e) { return res.status(500).json({ error: "Could not create the order", code: "ORDER_FAILED" }); }
    P.markAccepted(r, { orderId: order.id, delivery: { fee: q.fee, km: q.km || null }, total });
    save(d);
    appendAuditLog({ actorType: "customer", actorId: String(req.customerId), action: "pharmacy.accept", requestId: r.id, orderId: order.id });
    res.json({ ok: true, orderId: order.id, total });
  });

  app.post("/api/customer/pharmacy/requests/:id/decline", requireCustomer, (req, res) => {
    const d = fresh(load());
    const r = findIn(d, req.params.id);
    if (!mine(req, r)) return res.status(404).json({ error: "Not found" });
    const x = P.decline(r, { reason: req.body && req.body.reason });
    if (!x.ok) return res.status(x.status).json({ error: x.error, code: x.code });
    save(d);
    res.json({ ok: true });
  });

  app.post("/api/customer/pharmacy/requests/:id/cancel", requireCustomer, (req, res) => {
    const d = fresh(load());
    const r = findIn(d, req.params.id);
    if (!mine(req, r)) return res.status(404).json({ error: "Not found" });
    const x = P.cancel(r);
    if (!x.ok) return res.status(x.status).json({ error: x.error, code: x.code });
    save(d);
    res.json({ ok: true });
  });

  /* ---------------- pharmacy (store dashboard) ---------------- */

  // Only pharmacy-type stores have these; everything is scoped to req.storeId
  const pharmacyOnly = (req, res, next) => (S.isPharmacyType(req.storeType) ? next() : res.status(404).json({ error: "Not found" }));
  const guard = [requireStore("pharmacy.use"), pharmacyOnly];
  const myReq = (d, req) => findIn(d, req.params.id) && String(findIn(d, req.params.id).storeId) === String(req.storeId) ? findIn(d, req.params.id) : null;
  const view = (req, r) => P.storeView(r, { canContact: S.can(req.storeRole, "customers.contact"), maskPhone: S.maskPhone });

  app.get("/api/store/pharmacy/requests", ...guard, (req, res) => {
    const d = fresh(load());
    const want = String(req.query.status || "").trim();
    const all = d.requests.filter((r) => String(r.storeId) === String(req.storeId));
    const counts = {};
    for (const r of all) counts[r.status] = (counts[r.status] || 0) + 1;
    const list = all.filter((r) => !want || r.status === want).slice(0, 200).map((r) => view(req, r));
    res.json({ ok: true, requests: list, counts });
  });

  app.get("/api/store/pharmacy/requests/:id", ...guard, (req, res) => {
    const d = fresh(load());
    const r = myReq(d, req);
    if (!r) return res.status(404).json({ error: "Not found" });
    if (!r.viewedAt) { r.viewedAt = new Date().toISOString(); save(d); }
    res.json({ ok: true, request: view(req, r) });
  });

  app.get("/api/store/pharmacy/requests/:id/prescription", ...guard, (req, res) => {
    const r = myReq(load(), req);
    if (!r || !r.prescription) return res.status(404).json({ error: "Not found" });
    appendAuditLog({ actorType: "store", actorId: String(req.storeUserId || ""), action: "pharmacy.prescription.view", requestId: r.id, storeId: String(req.storeId) });
    return sendPrivate(res, r.prescription);
  });

  app.post("/api/store/pharmacy/requests/:id/quote", ...guard, (req, res) => {
    const d = fresh(load());
    const r = myReq(d, req);
    if (!r) return res.status(404).json({ error: "Not found" });
    const v = P.validateQuote(req.body);
    if (!v.ok) return res.status(400).json({ error: v.error, code: v.code });
    const x = P.applyQuote(r, v.value, { actorId: req.storeUserId });
    if (!x.ok) return res.status(x.status).json({ error: x.error, code: x.code });
    save(d);
    try {
      notifyCustomer({
        customerId: r.customerId, orderId: r.id, type: "pharmacy_quote",
        title: v.value.available ? "رد الصيدلية على طلبك" : "الدواء غير متوفر",
        message: v.value.available ? `${r.id}: متوفر — ${v.value.medicinesTotal} (راجع العرض وأكّد)` : `${r.id}: ${v.value.reason}`.slice(0, 120),
      });
    } catch (_e) {}
    res.json({ ok: true, request: view(req, r) });
  });

  function sendPrivate(res, rx) {
    const buf = readPrivate(rx.file);
    if (!buf) return res.status(404).json({ error: "Missing file" });
    res.setHeader("Content-Type", rx.mime || "image/jpeg");
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.end(buf);
  }

  return { load, findIn, P };
}

module.exports = { registerPharmacyRoutes };

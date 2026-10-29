/* =========================================================
   SIYMON ADMIN — Dispatch page (live map, pending orders, drivers)
   Loaded after admin.js (uses its globals: api, token, lang, el).
   Self-contained SVG map: no external tiles/scripts, so the strict CSP
   holds and driver positions never leave this server.
   ========================================================= */
(function () {
  "use strict";
  const TX = {
    ar: { nav: "التوزيع", title: "لوحة التوزيع", sub: "مواقع السائقين والعروض مباشرة", pending: "طلبات تنتظر سائقاً", drivers: "السائقون",
      none: "لا شيء حالياً", all: "الكل", state_available: "متاح", state_offer_pending: "لديه عرض", state_assigned: "مكلّف", state_delivering: "في التوصيل", state_paused: "متوقف مؤقتاً", state_offline: "غير متصل",
      fresh_live: "مباشر", fresh_stale: "قديم", fresh_lost: "مفقود", autoOffer: "عرض تلقائي", assign: "تعيين", reset: "إعادة", pick: "اختر سائقاً",
      offeredTo: "معروض على", left: "ث", waiting: "ينتظر", nocand: "لا يوجد سائق مؤهل", nopickup: "لا توجد إحداثيات للمطعم",
      settings: "الإعدادات", mode: "نظام الطلبات", pull: "سحب (السائق يقبل بنفسه)", offers: "عروض (توزيع ذكي)", auto: "تعيين تلقائي", ttl: "مهلة العرض (ثانية)",
      pickup: "نقطة الاستلام الافتراضية", save: "حفظ", saved: "تم الحفظ", events: "آخر الأحداث", warnPickup: "لا توجد إحداثيات للمطعم؛ حدّد نقطة الاستلام في الإعدادات حتى يعمل التوزيع.",
      warnPull: "الوضع الحالي: سحب. العروض معطّلة والسائقون يقبلون الطلبات بأنفسهم.", err: "تعذّر التحميل", cell: "خلية", noloc: "بلا موقع", fail: "فشل",
      ev: { offer_created: "عرض جديد", offer_accepted: "قُبل العرض", offer_rejected: "رُفض العرض", offer_expired: "انتهى العرض", driver_status: "حالة سائق", order_reset: "إعادة تعيين" },
      kDrivers: "سائق", kPickup: "المطعم", kOrder: "طلب" },
    en: { nav: "Dispatch", title: "Dispatch board", sub: "Live driver positions and offers", pending: "Orders waiting for a driver", drivers: "Drivers",
      none: "Nothing right now", all: "All", state_available: "Available", state_offer_pending: "Has offer", state_assigned: "Assigned", state_delivering: "Delivering", state_paused: "Paused", state_offline: "Offline",
      fresh_live: "live", fresh_stale: "stale", fresh_lost: "lost", autoOffer: "Auto offer", assign: "Assign", reset: "Reset", pick: "Pick a driver",
      offeredTo: "Offered to", left: "s", waiting: "waiting", nocand: "No eligible driver", nopickup: "No restaurant coordinates",
      settings: "Settings", mode: "Order system", pull: "Pull (drivers accept themselves)", offers: "Offers (smart dispatch)", auto: "Automatic assignment", ttl: "Offer timeout (seconds)",
      pickup: "Default pickup point", save: "Save", saved: "Saved", events: "Recent events", warnPickup: "No restaurant coordinates. Set a default pickup point in Settings so dispatch can work.",
      warnPull: "Current mode: pull. Offers are off; drivers accept orders themselves.", err: "Failed to load", cell: "cell", noloc: "no location", fail: "Failed",
      ev: { offer_created: "Offer created", offer_accepted: "Offer accepted", offer_rejected: "Offer rejected", offer_expired: "Offer expired", driver_status: "Driver status", order_reset: "Order reset" },
      kDrivers: "driver", kPickup: "Restaurant", kOrder: "order" },
    fr: { nav: "Dispatch", title: "Tableau de dispatch", sub: "Positions et offres en direct", pending: "Commandes en attente de livreur", drivers: "Livreurs",
      none: "Rien pour le moment", all: "Tous", state_available: "Disponible", state_offer_pending: "Offre en cours", state_assigned: "Assigné", state_delivering: "En livraison", state_paused: "En pause", state_offline: "Hors ligne",
      fresh_live: "direct", fresh_stale: "ancien", fresh_lost: "perdu", autoOffer: "Offre auto", assign: "Assigner", reset: "Réinitialiser", pick: "Choisir un livreur",
      offeredTo: "Proposée à", left: "s", waiting: "attend", nocand: "Aucun livreur éligible", nopickup: "Pas de coordonnées du restaurant",
      settings: "Réglages", mode: "Système de commandes", pull: "Pull (le livreur accepte)", offers: "Offres (dispatch intelligent)", auto: "Assignation automatique", ttl: "Délai de l'offre (secondes)",
      pickup: "Point de retrait par défaut", save: "Enregistrer", saved: "Enregistré", events: "Derniers événements", warnPickup: "Pas de coordonnées de restaurant. Définissez un point de retrait dans les réglages.",
      warnPull: "Mode actuel: pull. Les offres sont désactivées.", err: "Échec du chargement", cell: "cellule", noloc: "sans position", fail: "Échec",
      ev: { offer_created: "Offre créée", offer_accepted: "Offre acceptée", offer_rejected: "Offre refusée", offer_expired: "Offre expirée", driver_status: "Statut livreur", order_reset: "Commande réinitialisée" },
      kDrivers: "livreur", kPickup: "Restaurant", kOrder: "commande" },
  };
  const T = () => TX[typeof lang !== "undefined" ? lang : "ar"] || TX.ar;
  const $ = (id) => document.getElementById(id);
  const NS = "http://www.w3.org/2000/svg";
  const COLORS = { available: "#3fae1c", offer_pending: "#f5a524", assigned: "#3b82f6", delivering: "#8b5cf6", paused: "#9ca3af", offline: "#6b7280" };
  const STATES = ["available", "offer_pending", "assigned", "delivering", "paused", "offline"];

  let timer = null, busy = false, st = null, filter = "all", selected = null, settingsDirty = false;

  function mk(tag, attrs, text) {
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }
  function svg(tag, attrs, text) {
    const n = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }

  /* ---------- labels ---------- */
  function labels() {
    const t = T();
    const set = (id, v) => { const n = $(id); if (n) n.textContent = v; };
    set("dspTitle", t.title); set("dspSub", t.sub); set("dspPendingTitle", t.pending); set("dspDriversTitle", t.drivers);
    set("dspSettingsTitle", t.settings); set("dspLblMode", t.mode); set("dspLblAuto", t.auto); set("dspLblTtl", t.ttl);
    set("dspLblPickup", t.pickup); set("dspSave", t.save); set("dspEventsTitle", t.events);
    const m = $("dspMode"); if (m) { m.options[0].textContent = t.pull; m.options[1].textContent = t.offers; }
    set("dispatchText", t.nav);
  }

  /* ---------- map (real tiles via SiyMap; overlay items) ---------- */
  let dmap = null;
  function renderMap() {
    const box = $("dspMap"); if (!box || !st || !window.SiyMap) return;
    if (!dmap) dmap = window.SiyMap.create(box, { height: 440, dark: "auto", pad: 40, interactive: true });
    const items = [];
    (st.cells || []).forEach((c) => items.push({ kind: "poly", pts: c.boundary, fill: c.available ? "rgba(63,174,28,.18)" : "rgba(120,120,120,.10)", stroke: c.available ? "rgba(63,174,28,.7)" : "rgba(120,120,120,.45)", title: `${T().cell}: ${c.drivers} / ${c.available}` }));
    (st.pending || []).forEach((o) => {
      if (Number.isFinite(+o.customerLat) && Number.isFinite(+o.customerLng)) items.push({ kind: "sq", lat: +o.customerLat, lng: +o.customerLng, color: "#ef4444", title: `${T().kOrder} #${o.id}` });
    });
    if (st.pickup) items.push({ kind: "tri", lat: st.pickup.lat, lng: st.pickup.lng, title: `${T().kPickup}: ${st.pickup.name || ""}` });
    (st.drivers || []).forEach((d) => {
      if (!d.location) return;
      const sel = selected === d.id;
      items.push({ kind: "dot", lat: d.location.lat, lng: d.location.lng, r: sel ? 10 : 8, color: COLORS[d.dispatchState] || "#999", ring: sel ? "#111" : "#fff", dim: d.freshness === "stale",
        title: `${d.name || d.id} · ${T()["state_" + d.dispatchState] || d.dispatchState} · ${T()["fresh_" + d.freshness]}`,
        onClick: () => { selected = sel ? null : d.id; render(); } });
    });
    dmap.draw(items);
  }

  function renderLegend() {
    const box = $("dspLegend"); if (!box) return; box.textContent = "";
    STATES.forEach((s) => {
      const i = mk("span", { class: "dsp-leg" });
      const dot = mk("i"); dot.style.background = COLORS[s];
      i.appendChild(dot); i.appendChild(document.createTextNode(T()["state_" + s]));
      box.appendChild(i);
    });
  }

  /* ---------- lists ---------- */
  function renderCounts() {
    const box = $("dspCounts"); if (!box) return; box.textContent = "";
    STATES.forEach((s) => {
      const c = mk("div", { class: "dsp-count" });
      c.appendChild(mk("b", null, String((st.counts && st.counts[s]) || 0)));
      c.appendChild(mk("span", null, T()["state_" + s]));
      c.style.borderTopColor = COLORS[s];
      box.appendChild(c);
    });
  }

  function renderWarn() {
    const w = $("dspWarn"); if (!w) return;
    let msg = "";
    if (st.mode !== "offers") msg = T().warnPull; else if (!st.pickupOk) msg = T().warnPickup;
    w.hidden = !msg; w.textContent = msg;
  }

  function post(url, body) {
    return api(url, { method: "POST", body: JSON.stringify(body || {}) });
  }

  function renderPending() {
    const box = $("dspPending"); if (!box) return; box.textContent = "";
    const list = st.pending || [];
    if (!list.length) { box.appendChild(mk("p", { class: "muted" }, T().none)); return; }
    const avail = (st.drivers || []).filter((d) => d.dispatchState === "available");
    list.forEach((o) => {
      const row = mk("div", { class: "dsp-row" });
      const head = mk("div", { class: "dsp-row-h" });
      head.appendChild(mk("b", null, "#" + o.id));
      if (o.readyAt) head.appendChild(mk("span", { class: "muted" }, T().waiting + " " + Math.max(0, Math.round((Date.now() - Date.parse(o.readyAt)) / 60000)) + "m"));
      row.appendChild(head);
      let info = "";
      if (o.offer) {
        const d = (st.drivers || []).find((x) => x.id === o.offer.driverId);
        info = `${T().offeredTo} ${d ? d.name || d.id : o.offer.driverId} · ${Math.max(0, Math.ceil((o.offer.expiresAt - st.serverNow) / 1000))}${T().left}`;
      } else if (o.exhausted === "no_pickup_location") info = T().nopickup;
      else if (o.exhausted === "no_candidates") info = T().nocand;
      if (info) row.appendChild(mk("div", { class: "dsp-info" }, info));
      const act = mk("div", { class: "dsp-act" });
      const auto = mk("button", { type: "button", class: "btn small" }, T().autoOffer);
      auto.disabled = st.mode !== "offers";
      auto.addEventListener("click", () => run(post("/api/admin/dispatch/orders/" + encodeURIComponent(o.id) + "/offer")));
      const sel = mk("select", { "aria-label": T().pick });
      sel.appendChild(mk("option", { value: "" }, T().pick));
      avail.forEach((d) => sel.appendChild(mk("option", { value: d.id }, d.name || d.id)));
      const asg = mk("button", { type: "button", class: "btn small ghost" }, T().assign);
      asg.disabled = st.mode !== "offers";
      asg.addEventListener("click", () => { if (sel.value) run(post("/api/admin/dispatch/orders/" + encodeURIComponent(o.id) + "/offer", { driverId: sel.value })); });
      const rst = mk("button", { type: "button", class: "btn small ghost" }, T().reset);
      rst.addEventListener("click", () => run(post("/api/admin/dispatch/orders/" + encodeURIComponent(o.id) + "/reset")));
      act.append(auto, sel, asg, rst);
      row.appendChild(act);
      box.appendChild(row);
    });
  }

  function renderFilters() {
    const box = $("dspFilters"); if (!box) return; box.textContent = "";
    ["all"].concat(STATES).forEach((f) => {
      const b = mk("button", { type: "button", class: "dsp-chip" + (filter === f ? " on" : "") }, f === "all" ? T().all : T()["state_" + f]);
      b.addEventListener("click", () => { filter = f; render(); });
      box.appendChild(b);
    });
  }

  function renderDrivers() {
    const box = $("dspDrivers"); if (!box) return; box.textContent = "";
    const list = (st.drivers || []).filter((d) => filter === "all" || d.dispatchState === filter);
    if (!list.length) { box.appendChild(mk("p", { class: "muted" }, T().none)); return; }
    list.forEach((d) => {
      const row = mk("div", { class: "dsp-row dsp-drv" + (selected === d.id ? " sel" : "") });
      const dot = mk("i", { class: "dsp-dot" }); dot.style.background = COLORS[d.dispatchState] || "#999";
      row.appendChild(dot);
      row.appendChild(mk("b", null, d.name || d.id));
      row.appendChild(mk("span", { class: "muted" }, T()["state_" + d.dispatchState] + " · " + (d.location ? T()["fresh_" + d.freshness] + " " + Math.round(d.location.ageMs / 1000) + T().left : T().noloc)));
      row.addEventListener("click", () => { selected = selected === d.id ? null : d.id; render(); });
      box.appendChild(row);
    });
  }

  function renderEvents() {
    const box = $("dspEvents"); if (!box) return; box.textContent = "";
    (st.events || []).slice(0, 30).forEach((e) => {
      const d = e.driverId ? (st.drivers || []).find((x) => x.id === e.driverId) : null;
      const time = new Date(e.at).toLocaleTimeString();
      const txt = `${time} · ${T().ev[e.type] || e.type}` + (e.orderId ? ` · #${e.orderId}` : "") + (e.driverId ? ` · ${d ? d.name || d.id : e.driverId}` : "");
      box.appendChild(mk("div", { class: "dsp-ev" }, txt));
    });
  }

  function fillSettings() {
    if (settingsDirty || !st) return;
    $("dspMode").value = st.mode; $("dspAuto").checked = !!st.auto; $("dspTtl").value = Math.round(st.ttlMs / 1000);
    $("dspPkLat").value = st.pickup ? st.pickup.lat : ""; $("dspPkLng").value = st.pickup ? st.pickup.lng : ""; $("dspPkName").value = st.pickup ? st.pickup.name : "";
  }

  function render() {
    if (!st) return;
    labels(); renderWarn(); renderCounts(); renderMap(); renderLegend(); renderPending(); renderFilters(); renderDrivers(); renderEvents(); fillSettings();
  }

  /* ---------- data ---------- */
  async function load() {
    if (busy) return; busy = true;
    try { st = await api("/api/admin/dispatch/state"); render(); }
    catch (e) { const w = $("dspWarn"); if (w) { w.hidden = false; w.textContent = T().err + (e && e.message ? " — " + e.message : ""); } }
    finally { busy = false; }
  }
  async function run(p) { try { st = await p; if (st && st.drivers) render(); else await load(); } catch (e) { alert(T().fail + ": " + (e && e.message ? e.message : "")); } load(); }

  async function save() {
    const msg = $("dspSaveMsg"); msg.textContent = "";
    const lat = $("dspPkLat").value.trim(), lng = $("dspPkLng").value.trim();
    const body = { mode: $("dspMode").value, auto: $("dspAuto").checked, ttlSec: Number($("dspTtl").value) };
    body.pickup = lat || lng ? { lat: Number(lat), lng: Number(lng), name: $("dspPkName").value.trim() } : null;
    try { st = await post("/api/admin/dispatch/settings", body); settingsDirty = false; render(); msg.textContent = T().saved; }
    catch (e) { msg.textContent = T().fail + ": " + (e && e.message ? e.message : ""); }
  }


  /* ---------- driver rating summary for the Drivers table (numbers only → safe HTML) ---------- */
  const RT = {
    ar: { none: "بلا تقييم", rude: "غير مهذب", extra: "طلب زيادة مال" },
    en: { none: "No ratings", rude: "Impolite", extra: "Asked extra money" },
    fr: { none: "Aucun avis", rude: "Impoli", extra: "A demandé de l'argent" },
  };
  window.drvRatingHtml = function (d) {
    const r = d && d.ratingStats, t = RT[typeof lang !== "undefined" ? lang : "ar"] || RT.ar;
    if (!r || !r.count) return `<span class="drv-rt muted">${t.none}</span>`;
    const n = (v) => Math.max(0, Math.floor(Number(v) || 0));
    let h = `<span class="drv-rt"><b class="drv-star">★ ${Number(r.avg).toFixed(1)}</b> <span class="muted">(${n(r.count)})</span></span>`;
    if (n(r.impolite)) h += `<span class="drv-badge">${t.rude} ×${n(r.impolite)}</span>`;
    if (n(r.askedMoney)) h += `<span class="drv-badge">${t.extra} ×${n(r.askedMoney)}</span>`;
    return `<div class="drv-rt-row">${h}</div>`;
  };

  /* ---------- page open/close (same contract as other admin pages) ---------- */
  window.showDispatch = function (show) {
    $("dispatchModal")?.classList.toggle("show", !!show);
    clearInterval(timer); timer = null;
    if (show) { load(); timer = setInterval(() => { if (!document.hidden) load(); }, 3000); }
  };
  document.addEventListener("DOMContentLoaded", () => {
    labels();
    $("dispatchBtn")?.addEventListener("click", () => { if (typeof token !== "undefined" && !token) return; window.showDispatch(true); });
    $("dspClose")?.addEventListener("click", () => window.showDispatch(false));
    $("dspSave")?.addEventListener("click", save);
    ["dspMode", "dspAuto", "dspTtl", "dspPkLat", "dspPkLng", "dspPkName"].forEach((id) => $(id)?.addEventListener("input", () => { settingsDirty = true; }));
    new MutationObserver(labels).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  });
})();

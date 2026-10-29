/* =========================================================
   Customer extras: live driver map, unread dot helpers, driver rating.
   Loaded after orders.js (uses its globals: api, el, lang, escapeHtml,
   LAST_ORDERS, renderOrders, loadMeAndOrders).
   The map is a self-contained SVG (strict CSP, no tiles). The line is a
   straight line: following roads needs an external routing service.
   ========================================================= */
(function () {
  "use strict";
  const TX = {
    ar: { away: "يبعد عنك", km: "كم", m: "م", upd: "آخر تحديث قبل", s: "ث", min: "د", noLoc: "موقع السائق غير متاح حالياً", eta: "≈", loading: "جارٍ تحميل موقع السائق…", noDest: "عنوان التوصيل غير محدد على الخريطة",
      title: "تقييم السائق", later: "لاحقاً", send: "إرسال", polite: "هل كان السائق معكم مهذباً؟", extra: "هل طلب زيادة مال؟", yes: "نعم", no: "لا",
      comment: "ملاحظة (اختياري)...", need: "اختر النجوم وأجب عن السؤالين.", thanks: "شكراً لتقييمك", done: "هذه التوصيلة قُيّمت من قبل.", expired: "انتهت مهلة التقييم (7 أيام).", err: "تعذّر الإرسال" },
    en: { away: "away from you", km: "km", m: "m", upd: "Updated", s: "s ago", min: "min ago", noLoc: "Driver location unavailable right now", eta: "≈", loading: "Loading driver location…", noDest: "Delivery address isn't pinned on the map",
      title: "Rate the driver", later: "Later", send: "Submit", polite: "Was the driver polite?", extra: "Did the driver ask for extra money?", yes: "Yes", no: "No",
      comment: "Note (optional)...", need: "Pick stars and answer both questions.", thanks: "Thanks for your rating", done: "This delivery was already rated.", expired: "The 7-day rating window has ended.", err: "Couldn't send" },
    fr: { away: "de vous", km: "km", m: "m", upd: "Mis à jour il y a", s: "s", min: "min", noLoc: "Position du livreur indisponible", eta: "≈", loading: "Chargement de la position…", noDest: "Adresse non placée sur la carte",
      title: "Noter le livreur", later: "Plus tard", send: "Envoyer", polite: "Le livreur était-il poli ?", extra: "A-t-il demandé de l'argent en plus ?", yes: "Oui", no: "Non",
      comment: "Remarque (facultatif)...", need: "Choisissez les étoiles et répondez aux deux questions.", thanks: "Merci pour votre note", done: "Cette livraison a déjà été notée.", expired: "Délai de 7 jours dépassé.", err: "Envoi impossible" },
  };
  const T = () => TX[typeof lang !== "undefined" ? lang : "ar"] || TX.ar;
  
  /* ---------------- live tracking ---------------- */
  const track = new Map(); // orderId -> { data, at }
  const failed = new Set(); // orders whose track request failed (e.g. server not updated)
  let pollTimer = null, ageTimer = null, busy = false;

  function fmtDist(m) { const t = T(); return m < 1000 ? Math.max(1, Math.round(m)) + " " + t.m : (m / 1000).toFixed(1) + " " + t.km; }
  function fmtAge(sec) { const t = T(); return sec < 60 ? Math.round(sec) + " " + (lang === "en" ? t.s : t.s) : Math.round(sec / 60) + " " + t.min; }
  function ageNow(rec) { return rec.data.driver.ageSec + (Date.now() - rec.at) / 1000; }

  function itemsFor(d, onInfo) {
    const it = [];
    if (d.driver && d.destination) it.push({ kind: "route", key: "drv", from: d.driver, to: d.destination, color: "#3fae1c", onInfo });
    if (d.destination) it.push({ kind: "pin", lat: d.destination.lat, lng: d.destination.lng, color: "#ef4444" });
    if (d.driver) it.push({ kind: "dot", lat: d.driver.lat, lng: d.driver.lng, r: 9, color: "#3fae1c", inner: true });
    return it;
  }

  // The box is built once per card; the 1 s timer only updates text, the map redraws when new data arrives.
  function renderOne(box) {
    const id = box.getAttribute("data-trk"), rec = track.get(id), t = T();
    if (!box._ui) {
      box.textContent = "";
      const head = document.createElement("div"); head.className = "trk-head";
      const dist = document.createElement("b"), upd = document.createElement("span"); upd.className = "trk-upd";
      head.append(dist, upd);
      const mapBox = document.createElement("div"); mapBox.className = "trk-map";
      box.append(head, mapBox);
      box._ui = { dist, upd, map: window.SiyMap ? window.SiyMap.create(mapBox, { height: 230, dark: "auto" }) : null, drawn: null, route: null };
    }
    const ui = box._ui;
    if (!rec) { ui.dist.textContent = failed.has(id) ? t.noLoc : t.loading; ui.upd.textContent = ""; return; }
    const d = rec.data;
    // road distance + ETA when the route service answered, else the straight-line distance from the server
    const rt = ui.route && !ui.route.fallback ? ui.route : null;
    const meters = rt ? rt.distance : d.distanceM;
    const eta = rt ? ` • ${t.eta} ${Math.max(1, Math.round(rt.duration / 60))} ${lang === "fr" ? "min" : lang === "en" ? "min" : "د"}` : "";
    if (d.driver && meters != null) ui.dist.textContent = (t.away === "يبعد عنك" ? `${t.away} ${fmtDist(meters)}` : `${fmtDist(meters)} ${t.away}`) + eta;
    else if (!d.driver) ui.dist.textContent = t.noLoc;
    else ui.dist.textContent = t.noDest;
    ui.upd.textContent = d.driver ? `${t.upd} ${fmtAge(ageNow(rec))}` : "";
    if (ui.map && ui.drawn !== rec.at) { ui.map.draw(itemsFor(d, (info) => { ui.route = info; renderOne(box); })); ui.drawn = rec.at; }
  }
  function renderAll() { document.querySelectorAll(".trk[data-trk]").forEach(renderOne); }

  async function pollTrack() {
    if (busy || document.hidden) return;
    const boxes = [...document.querySelectorAll(".trk[data-trk]")];
    if (!boxes.length) { stopTrack(); return; }
    busy = true;
    try {
      await Promise.all(boxes.map(async (b) => {
        const id = b.getAttribute("data-trk");
        try {
          const r = await api(`/api/customer/orders/${encodeURIComponent(id)}/track`);
          failed.delete(id);
          if (r && r.tracking) track.set(id, { data: r, at: Date.now() }); else track.delete(id);
        } catch (_e) { if (!track.has(id)) failed.add(id); /* else keep last known */ }
      }));
      renderAll();
    } finally { busy = false; }
  }
  function startTrack() {
    if (pollTimer) return;
    pollTimer = setInterval(pollTrack, 5000);
    ageTimer = setInterval(renderAll, 1000);
    pollTrack();
  }
  function stopTrack() { clearInterval(pollTimer); clearInterval(ageTimer); pollTimer = ageTimer = null; track.clear(); }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && pollTimer) pollTrack(); });

  /* ---------------- driver rating ---------------- */
  /* The card pops up on its own AT MOST ONCE per delivery: the order id is stored on this device straight away
     (localStorage, survives reloads/PWA restarts) and on the server (ratingPromptedAt, covers other devices).
     "Later", closing, a failed request or a data refresh never bring it back; the "Rate driver" button stays. */
  const PROMPTED_KEY = "siymon_rate_driver_prompted_v1", AUTO_WINDOW_MS = 48 * 3600 * 1000;
  const promptedIds = () => { try { const a = JSON.parse(localStorage.getItem(PROMPTED_KEY) || "[]"); return Array.isArray(a) ? a : []; } catch (_e) { return []; } };
  const markPrompted = (id) => {
    id = String(id);
    try { const a = promptedIds(); if (!a.includes(id)) { a.push(id); localStorage.setItem(PROMPTED_KEY, JSON.stringify(a.slice(-200))); } } catch (_e) {}
    api(`/api/customer/orders/${encodeURIComponent(id)}/rating-prompted`, { method: "POST", body: "{}" }).catch(() => {});
  };
  const autoPromptable = (o) => {
    if (!o || !o.canRateDriver || o.ratingPrompted || promptedIds().includes(String(o.id))) return false;
    const at = Date.parse(o.deliveredAt || o.updatedAt || "");
    return Number.isFinite(at) && Date.now() - at <= AUTO_WINDOW_MS;
  };

  let RD = { id: null, stars: 0, polite: null, extra: null }, modal = null;

  function yn(name, label) {
    const wrap = document.createElement("div"); wrap.className = "rd-q";
    const q = document.createElement("div"); q.className = "rd-qt"; q.textContent = label;
    const row = document.createElement("div"); row.className = "rd-yn"; row.dataset.q = name;
    ["yes", "no"].forEach((v) => { const b = document.createElement("button"); b.type = "button"; b.className = "rd-yn-b"; b.dataset.v = v; row.appendChild(b); });
    wrap.append(q, row); return wrap;
  }
  function buildModal() {
    modal = document.createElement("div"); modal.className = "modal"; modal.id = "drvRateModal"; modal.setAttribute("aria-hidden", "true");
    const card = document.createElement("div"); card.className = "modal-card";
    const head = document.createElement("div"); head.className = "modal-head";
    const title = document.createElement("div"); title.className = "modal-title"; title.id = "rdTitle";
    const meta = document.createElement("div"); meta.className = "muted"; meta.id = "rdMeta";
    const hw = document.createElement("div"); hw.append(title, meta); head.appendChild(hw);
    const body = document.createElement("div"); body.className = "modal-body";
    const stars = document.createElement("div"); stars.className = "stars"; stars.id = "rdStars";
    for (let i = 1; i <= 5; i++) { const b = document.createElement("button"); b.type = "button"; b.className = "star-btn"; b.dataset.star = String(i); b.setAttribute("aria-label", String(i)); b.textContent = "★"; stars.appendChild(b); }
    const ta = document.createElement("textarea"); ta.id = "rdComment"; ta.className = "textarea"; ta.rows = 3; ta.maxLength = 500;
    const hint = document.createElement("div"); hint.className = "hint"; hint.id = "rdHint";
    body.append(stars, yn("polite", ""), yn("extra", ""), ta, hint);
    const acts = document.createElement("div"); acts.className = "modal-actions";
    const later = document.createElement("button"); later.type = "button"; later.className = "btn"; later.id = "rdLater";
    const send = document.createElement("button"); send.type = "button"; send.className = "btn good"; send.id = "rdSend";
    acts.append(later, send); card.append(head, body, acts); modal.appendChild(card); document.body.appendChild(modal);

    stars.addEventListener("click", (e) => { const b = e.target.closest(".star-btn"); if (b) { RD.stars = Number(b.dataset.star); paint(); } });
    modal.addEventListener("click", (e) => {
      const b = e.target.closest(".rd-yn-b"); if (!b) return;
      RD[b.parentNode.dataset.q] = b.dataset.v === "yes"; paint();
    });
    later.addEventListener("click", () => closeRate(true));
    send.addEventListener("click", submitRate);
  }
  function paint() {
    const t = T();
    modal.querySelector("#rdTitle").textContent = t.title;
    modal.querySelector("#rdComment").placeholder = t.comment;
    modal.querySelector("#rdLater").textContent = t.later;
    modal.querySelector("#rdSend").textContent = t.send;
    const qs = modal.querySelectorAll(".rd-q");
    qs[0].querySelector(".rd-qt").textContent = t.polite; qs[1].querySelector(".rd-qt").textContent = t.extra;
    modal.querySelectorAll(".star-btn").forEach((b) => b.classList.toggle("active", Number(b.dataset.star) <= RD.stars));
    modal.querySelectorAll(".rd-yn").forEach((row) => {
      const val = RD[row.dataset.q];
      row.querySelectorAll(".rd-yn-b").forEach((b) => { b.textContent = b.dataset.v === "yes" ? t.yes : t.no; b.classList.toggle("on", val === (b.dataset.v === "yes")); });
    });
  }
  function openRate(id) {
    if (!modal) buildModal();
    const o = (LAST_ORDERS || []).find((x) => String(x.id) === String(id));
    RD = { id: String(id), stars: 0, polite: null, extra: null };
    modal.querySelector("#rdComment").value = ""; modal.querySelector("#rdHint").textContent = "";
    modal.querySelector("#rdMeta").textContent = "#" + id + (o && o.driverName ? " • " + o.driverName : "");
    paint(); modal.classList.add("show"); modal.setAttribute("aria-hidden", "false");
  }
  function closeRate() {
    modal && modal.classList.remove("show"); modal && modal.setAttribute("aria-hidden", "true"); RD.id = null;
  }
  async function submitRate() {
    const t = T(), hint = modal.querySelector("#rdHint");
    if (RD.stars < 1 || RD.polite === null || RD.extra === null) { hint.textContent = t.need; return; }
    const btn = modal.querySelector("#rdSend"); btn.disabled = true;
    try {
      await api(`/api/customer/orders/${encodeURIComponent(RD.id)}/rate-driver`, { method: "POST",
        body: JSON.stringify({ stars: RD.stars, polite: RD.polite, askedExtraMoney: RD.extra, comment: modal.querySelector("#rdComment").value.trim() }) });
      closeRate(false); alert(t.thanks); await loadMeAndOrders();
    } catch (e) {
      const code = e && e.message;
      if (code === "already_rated") { closeRate(false); alert(t.done); loadMeAndOrders(); }
      else if (code === "window_expired") { closeRate(false); alert(t.expired); loadMeAndOrders(); }
      else hint.textContent = t.err;
    } finally { btn.disabled = false; }
  }

  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest('[data-action="rate-driver"]');
    if (b) openRate(b.getAttribute("data-id"));
  });

  /* ---------------- hook into renderOrders ---------------- */
  const baseRender = renderOrders;
  renderOrders = function (list) {
    baseRender(list);
    try {
      if (document.querySelector(".trk[data-trk]")) { renderAll(); startTrack(); } else stopTrack();
      if (!document.querySelector(".modal.show")) {
        const o = (LAST_ORDERS || []).find(autoPromptable);
        if (o) { markPrompted(o.id); openRate(o.id); }
      }
    } catch (_e) {}
  };
})();

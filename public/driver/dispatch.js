/* =========================================================
   SIYMON DRIVER — live location + dispatch offers
   Loaded after driver.js (shares its globals: api, el, t, lang,
   toast, money, playRingtone, token, isOnline, loadOrders).
   Privacy: GPS is read only while the driver is online; only the
   latest fix is sent; nothing is stored on the device.
   ========================================================= */
(function () {
  "use strict";

  const TXT = {
    ar: {
      gpsDenied: "تم رفض إذن الموقع. فعّله من إعدادات المتصفح لتتمكن من العمل.",
      gpsUnavailable: "تعذّر تحديد موقعك. تأكد من تشغيل GPS.",
      gpsTimeout: "لم نحصل على موقعك. جرّب في مكان مكشوف.",
      locationRequired: "نحتاج موقعاً حديثاً للاتصال. حاول مجدداً.",
      locationInaccurate: "دقة الموقع ضعيفة. اخرج لمكان مكشوف وحاول مجدداً.",
      busy: "لديك طلب جارٍ؛ لا يمكنك الانقطاع الآن.",
      trackLive: "التتبع يعمل", trackStale: "إشارة GPS ضعيفة", trackLost: "فُقد الموقع — أبقِ التطبيق مفتوحاً",
      bg: "أبقِ التطبيق مفتوحاً والشاشة مضاءة، فقد يتوقف التتبع عند قفل الهاتف.",
      offerTitle: "طلب جديد لك", fee: "أجرة التوصيل", pickup: "المطعم", away: "يبعد عنك",
      accept: "قبول", reject: "رفض", navigate: "تنقّل إلى المطعم", secs: "ث",
      expired: "انتهت مهلة العرض.", taken: "لم يعد العرض متاحاً.", accepted: "تم قبول الطلب.",
      walletLow: "رصيد المحفظة غير كافٍ لقبول هذا الطلب.", m: "م", km: "كم",
    },
    en: {
      gpsDenied: "Location permission denied. Enable it in browser settings to work.",
      gpsUnavailable: "Couldn't get your location. Make sure GPS is on.",
      gpsTimeout: "No location yet. Try somewhere with open sky.",
      locationRequired: "A recent location is needed to go online. Try again.",
      locationInaccurate: "Location accuracy is too low. Move outdoors and retry.",
      busy: "You have an active order; you can't go offline now.",
      trackLive: "Tracking active", trackStale: "Weak GPS signal", trackLost: "Location lost — keep the app open",
      bg: "Keep the app open with the screen on; tracking may stop when the phone locks.",
      offerTitle: "New order for you", fee: "Delivery fee", pickup: "Restaurant", away: "away",
      accept: "Accept", reject: "Decline", navigate: "Navigate to restaurant", secs: "s",
      expired: "The offer expired.", taken: "This offer is no longer available.", accepted: "Order accepted.",
      walletLow: "Wallet balance is too low to accept this order.", m: "m", km: "km",
    },
    fr: {
      gpsDenied: "Autorisation de localisation refusée. Activez-la dans les réglages du navigateur.",
      gpsUnavailable: "Position introuvable. Vérifiez que le GPS est activé.",
      gpsTimeout: "Pas encore de position. Essayez en extérieur.",
      locationRequired: "Une position récente est requise pour se connecter. Réessayez.",
      locationInaccurate: "Précision insuffisante. Sortez à découvert et réessayez.",
      busy: "Vous avez une commande en cours; impossible de se déconnecter.",
      trackLive: "Suivi actif", trackStale: "Signal GPS faible", trackLost: "Position perdue — gardez l'app ouverte",
      bg: "Gardez l'app ouverte, écran allumé; le suivi peut s'arrêter à l'écran verrouillé.",
      offerTitle: "Nouvelle commande", fee: "Frais de livraison", pickup: "Restaurant", away: "de vous",
      accept: "Accepter", reject: "Refuser", navigate: "Aller au restaurant", secs: "s",
      expired: "L'offre a expiré.", taken: "Cette offre n'est plus disponible.", accepted: "Commande acceptée.",
      walletLow: "Solde du portefeuille insuffisant pour cette commande.", m: "m", km: "km",
    },
  };
  const L = () => TXT[typeof lang !== "undefined" ? lang : "ar"] || TXT.ar;
  const q = (id) => document.getElementById(id);

  const SEND_MIN_MS = 3000, SEND_MAX_MS = 10000, MIN_MOVE_M = 25;
  let mode = "pull", legacy = false; // legacy = server without dispatch routes (old deploy)            // "pull" | "offers" (from server)
  let watchId = null, fix = null, lastSent = null, lastSentAt = 0, lastOkAt = 0;
  let sending = false, backoffUntil = 0, trackErr = null, wakeLock = null;
  let hbTimer = null, offerTimer = null, uiTimer = null, offersBusy = false;
  let skew = 0, currentOffer = null, dismissed = new Set(), firstFixWaiter = null;

  const dist = (a, b) => {
    const r = Math.PI / 180, R = 6371000;
    const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  };

  /* ---------- location tracking ---------- */
  function onFix(pos) {
    const c = pos.coords;
    fix = { lat: c.latitude, lng: c.longitude, accuracy: c.accuracy, heading: c.heading, speed: c.speed, ts: Date.now() };
    trackErr = null;
    if (firstFixWaiter) { firstFixWaiter.resolve(); firstFixWaiter = null; }
    maybeSend(false);
  }
  function onGeoErr(err) {
    trackErr = err && err.code === 1 ? "denied" : err && err.code === 2 ? "unavailable" : "timeout";
    if (firstFixWaiter) { firstFixWaiter.reject(trackErr); firstFixWaiter = null; }
    if (trackErr === "denied" && typeof isOnline !== "undefined" && isOnline) {
      toast(L().gpsDenied, "err");
      stopTracking();
      if (typeof setOnline === "function") setOnline(false);
    }
  }

  function startTracking() {
    if (watchId != null || !navigator.geolocation) return;
    watchId = navigator.geolocation.watchPosition(onFix, onGeoErr, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
    hbTimer = setInterval(() => maybeSend(true), SEND_MAX_MS);
    uiTimer = setInterval(renderChip, 2000);
    acquireWakeLock();
    renderChip();
  }
  function stopTracking() {
    if (watchId != null) navigator.geolocation.clearWatch(watchId);
    watchId = null; fix = null; lastSent = null; lastOkAt = 0;
    clearInterval(hbTimer); clearInterval(uiTimer); hbTimer = uiTimer = null;
    releaseWakeLock(); renderChip();
  }

  async function maybeSend(heartbeat) {
    if (!fix || sending) return;
    const now = Date.now();
    if (now < backoffUntil || now - fix.ts > 60000) return;
    if (window.SiymonOffline && window.SiymonOffline.isDown()) return; // no point sending while unreachable
    const since = now - lastSentAt;
    const moved = lastSent ? dist(lastSent, fix) : Infinity;
    if (since < SEND_MIN_MS) return;
    if (!heartbeat && moved < MIN_MOVE_M && since < SEND_MAX_MS) return;
    if (heartbeat && since < SEND_MAX_MS - 500) return;
    sending = true; lastSentAt = now;
    try {
      // Section 20: location is NEVER queued/replayed. The reading's age is sent so the server back-dates it:
      // a position captured before a network drop can never be stored as "current" for dispatch decisions.
      await api("/api/driver/location", { method: "POST", body: JSON.stringify({
        lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy, heading: fix.heading, speed: fix.speed,
        ageMs: Math.max(0, Date.now() - fix.ts) }) });
      lastSent = { lat: fix.lat, lng: fix.lng }; lastOkAt = Date.now();
    } catch (e) {
      if (e.status === 429) backoffUntil = Date.now() + 20000;
      if (e.status === 404) { legacy = true; stopTracking(); }
    } finally { sending = false; renderChip(); }
  }

  function renderChip() {
    const chip = q("trackChip"); if (!chip) return;
    const on = watchId != null;
    if (!on) { chip.hidden = true; return; }
    const age = lastOkAt ? Date.now() - lastOkAt : Infinity;
    const st = trackErr ? "lost" : age < 25000 ? "live" : age < 90000 ? "stale" : (fix ? "stale" : "lost");
    chip.hidden = false;
    chip.dataset.state = st;
    chip.textContent = st === "live" ? L().trackLive : st === "stale" ? L().trackStale : L().trackLost;
  }

  async function acquireWakeLock() {
    try { if ("wakeLock" in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => { wakeLock = null; }); } } catch (_e) {}
  }
  function releaseWakeLock() { try { wakeLock && wakeLock.release(); } catch (_e) {} wakeLock = null; }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && watchId != null) { acquireWakeLock(); maybeSend(true); pollOffers(); }
  });

  /* ---------- online / offline ---------- */
  async function detectMode() {
    try { const r = await api("/api/driver/offers"); mode = r.mode === "offers" ? "offers" : "pull"; legacy = false; }
    catch (e) { if (e && e.status === 404) { legacy = true; mode = "pull"; } }
    return mode;
  }

  async function setOnline(want) {
    await detectMode();
    if (legacy) { // old server: behave exactly like before (no GPS, no offers)
      try { await api("/api/driver/status", { method: "PATCH", body: JSON.stringify({ isOnline: want }) }); } catch (_e) {}
      return { ok: true };
    }
    if (want) {
      if (navigator.geolocation) {
        startTracking();
        try {
          if (!fix) await new Promise((resolve, reject) => {
            firstFixWaiter = { resolve, reject };
            setTimeout(() => { if (firstFixWaiter) { firstFixWaiter = null; reject("timeout"); } }, 15000);
          });
          await maybeSendNow();
        } catch (code) {
          if (mode === "offers") {
            stopTracking();
            return { ok: false, message: code === "denied" ? L().gpsDenied : code === "unavailable" ? L().gpsUnavailable : L().gpsTimeout };
          }
        }
      } else if (mode === "offers") {
        return { ok: false, message: L().gpsUnavailable };
      }
      try {
        await api("/api/driver/status", { method: "PATCH", body: JSON.stringify({ status: "online" }) });
      } catch (e) {
        const code = e.data && e.data.error;
        // pull mode must never lock a driver out because of a status hiccup
        if (mode !== "offers" && !(e.status === 409 || e.status === 400)) { startOfferPolling(); return { ok: true }; }
        stopTracking();
        return { ok: false, message: code === "location_inaccurate" ? L().locationInaccurate : code === "location_required" ? L().locationRequired : friendlyErr(e) };
      }
      startOfferPolling();
      return { ok: true };
    }
    try {
      await api("/api/driver/status", { method: "PATCH", body: JSON.stringify({ status: "offline" }) });
    } catch (e) {
      if (e.data && e.data.error === "busy_with_order") return { ok: false, message: L().busy };
      /* network error: still go offline locally */
    }
    stopOfferPolling(); stopTracking(); hideOffer();
    return { ok: true };
  }

  // First fix must reach the server before we ask it to mark us online.
  async function maybeSendNow() {
    const end = Date.now() + 8000;
    while (!lastOkAt && Date.now() < end) {
      if (!sending) { lastSentAt = 0; backoffUntil = 0; await maybeSend(false); }
      if (!lastOkAt) await new Promise((r) => setTimeout(r, 150));
    }
    if (!lastOkAt) throw "unavailable";
  }

  /* ---------- offers ---------- */
  function startOfferPolling() {
    if (offerTimer) return;
    offerTimer = setInterval(pollOffers, 2500);
    pollOffers();
  }
  function stopOfferPolling() { clearInterval(offerTimer); offerTimer = null; dismissed.clear(); }

  async function pollOffers() {
    if (offersBusy || !offerTimer) return;
    offersBusy = true;
    try {
      const r = await api("/api/driver/offers");
      mode = r.mode === "offers" ? "offers" : "pull";
      const offer = (r.offers || []).find((o) => !dismissed.has(o.id)) || null;
      if (offer) {
        skew = (offer.serverNow || Date.now()) - Date.now();
        if (!currentOffer || currentOffer.id !== offer.id) {
          currentOffer = offer; showOffer(offer);
          try { playRingtone(); } catch (_e) {}
          try { navigator.vibrate && navigator.vibrate([250, 120, 250]); } catch (_e) {}
        }
      } else if (currentOffer) { hideOffer(); }
    } catch (_e) { /* offline blips are fine; next poll retries */ }
    finally { offersBusy = false; }
  }

  const remainingMs = (o) => o.expiresAt - (Date.now() + skew);
  let cdTimer = null;

  function showOffer(o) {
    const box = q("offerBackdrop"); if (!box) return;
    const T = L();
    q("offerTitle").textContent = T.offerTitle;
    q("offerFee").textContent = money(o.driverEarning != null ? o.driverEarning : o.deliveryFee);
    q("offerFeeLbl").textContent = T.fee;
    q("offerPickupLbl").textContent = T.pickup;
    q("offerPickup").textContent = (o.pickup && o.pickup.name) || "—";
    q("offerDist").textContent = o.pickupDistM == null ? "" :
      (o.pickupDistM < 1000 ? o.pickupDistM + " " + T.m : (o.pickupDistM / 1000).toFixed(1) + " " + T.km) + " " + T.away;
    q("offerAccept").textContent = T.accept;
    q("offerReject").textContent = T.reject;
    const nav = q("offerNav");
    nav.textContent = T.navigate;
    if (o.pickup) { nav.href = "https://www.google.com/maps/dir/?api=1&destination=" + o.pickup.lat + "," + o.pickup.lng + "&travelmode=driving"; nav.hidden = false; }
    else nav.hidden = true;
    box.classList.add("show");
    clearInterval(cdTimer);
    const total = Math.max(1000, o.expiresAt - (o.serverNow || Date.now()));
    cdTimer = setInterval(() => {
      const left = remainingMs(o);
      if (left <= 0) { dismissed.add(o.id); hideOffer(); toast(L().expired, "warn"); return; }
      q("offerSecs").textContent = Math.ceil(left / 1000) + " " + L().secs;
      q("offerBar").style.width = Math.max(0, Math.min(100, (left / total) * 100)) + "%";
    }, 250);
  }
  function hideOffer() {
    clearInterval(cdTimer); cdTimer = null; currentOffer = null;
    q("offerBackdrop")?.classList.remove("show");
  }

  async function respond(kind) {
    const o = currentOffer; if (!o) return;
    q("offerAccept").disabled = q("offerReject").disabled = true;
    try {
      await api("/api/driver/offers/" + encodeURIComponent(o.id) + "/" + kind, { method: "POST", body: "{}" });
      dismissed.add(o.id); hideOffer();
      if (kind === "accept") { toast(L().accepted, "ok"); try { await loadOrders(); } catch (_e) {} }
    } catch (e) {
      dismissed.add(o.id); hideOffer();
      if (e.status === 402) toast(L().walletLow, "err");
      else if (e.status === 409 || e.status === 404) toast(String(e.data && e.data.error) === "offer_expired" ? L().expired : L().taken, "warn");
      else toast(friendlyErr(e), "err");
    } finally { q("offerAccept").disabled = q("offerReject").disabled = false; }
  }

  document.addEventListener("click", (ev) => {
    if (ev.target.closest && ev.target.closest("#offerAccept")) respond("accept");
    else if (ev.target.closest && ev.target.closest("#offerReject")) respond("reject");
  });

  // One-shot position for the order map when we're not tracking (driver offline).
  let shot = null, shooting = false;
  function ensureFix() {
    if (watchId != null || shooting || !navigator.geolocation) return;
    shooting = true;
    navigator.geolocation.getCurrentPosition(
      (p) => { shot = { lat: p.coords.latitude, lng: p.coords.longitude, ts: Date.now() }; shooting = false; },
      () => { shooting = false; },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 10000 },
    );
  }
  const lastFix = () => (fix && Date.now() - fix.ts < 120000 ? { lat: fix.lat, lng: fix.lng } : shot && Date.now() - shot.ts < 300000 ? shot : null);

  window.SiymonDispatch = { ensureFix, lastFix, setOnline, stop() { stopOfferPolling(); stopTracking(); hideOffer(); }, bgNote: () => L().bg, _mode: () => mode };
})();

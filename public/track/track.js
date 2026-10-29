/* Guest order tracking. The private token travels in the URL fragment (never sent to the
   server in the URL / access logs) and is sent in the X-Track-Token header. */
(function () {
  "use strict";
  const lang = localStorage.getItem("siymon_lang_v1") || localStorage.getItem("siymon_lang") || "ar";
  const T = (ar, fr, en) => (lang === "ar" ? ar : lang === "fr" ? fr : en);
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const STATUS = {
    new: T("بانتظار المراجعة", "En attente", "Pending"),
    admin_accepted: T("تم قبول الطلب", "Acceptée", "Accepted"),
    restaurant_ready: T("جاهز للتوصيل", "Prête", "Ready for pickup"),
    accepted: T("السائق في الطريق للمتجر", "Livreur en route vers le magasin", "Driver heading to the store"),
    picked_up: T("تم استلام الطلب", "Commande récupérée", "Picked up"),
    on_the_way: T("في الطريق إليك", "En route vers vous", "On the way"),
    delivered: T("تم التسليم", "Livrée", "Delivered"),
    done: T("مكتمل", "Terminée", "Completed"),
    canceled: T("ملغي", "Annulée", "Canceled"),
  };
  const box = document.getElementById("tkBox");
  document.getElementById("tkTitle").textContent = T("تتبّع الطلب", "Suivi de commande", "Order tracking");
  const m = /^#([^.]+)\.(.+)$/.exec(location.hash || "");
  const bad = () => { box.textContent = T("رابط التتبع غير صالح.", "Lien de suivi invalide.", "Invalid tracking link."); };
  if (!m) return bad();
  const id = decodeURIComponent(m[1]), token = m[2];
  async function load() {
    try {
      const res = await fetch("/api/track/" + encodeURIComponent(id), { headers: { "X-Track-Token": token } });
      if (!res.ok) return bad();
      const { order: o } = await res.json();
      box.innerHTML = `<p><b>#${esc(o.id)}</b> — ${esc(o.store)}</p>
        <p style="font-size:1.2em"><b>${esc(STATUS[o.status] || o.status)}</b></p>
        <ul>${o.items.map((i) => `<li>${esc(i.name)} × ${i.qty}</li>`).join("")}</ul>
        <p>${esc(T("الإجمالي", "Total", "Total"))}: <b>${Number(o.total).toFixed(2)} ${esc(o.currency)}</b></p>`;
      if (!["done", "canceled", "cancelled"].includes(o.status)) setTimeout(load, 20000);
    } catch (_e) {
      box.textContent = T("تعذّر الاتصال. سنعيد المحاولة…", "Connexion impossible. Nouvel essai…", "Connection problem. Retrying…");
      setTimeout(load, 15000);
    }
  }
  load();
})();

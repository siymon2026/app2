/* siymon — notification center (/notifications/).
   List = short summaries · tap = details sheet (history-aware: Back closes it and keeps the list position).
   Data: GET /api/customer/notifications (real records only) · POST .../seen = "mark all as read".
   Per-notification read state lives on this device (see notif-logic.js). */
(function () {
  "use strict";

  var SP = window.SP, N = window.SNotif;
  var el = function (id) { return document.getElementById(id); };

  var T = {
    ar: {
      title: "الإشعارات", sub: "تابع آخر تحديثات طلباتك", back: "الرجوع", markAll: "تحديد الكل كمقروء",
      all: "الكل", orders: "الطلبات", offers: "العروض", system: "النظام", unread: "غير مقروء",
      emptyT: "لا توجد إشعارات جديدة", emptyS: "سنخبرك هنا بأي تحديث على طلباتك والعروض المهمة.",
      loadError: "تعذّر تحميل الإشعارات.", retry: "إعادة المحاولة",
      orderNo: "رقم الطلب", status: "حالة الطلب", date: "التاريخ والوقت",
      viewOrder: "عرض الطلب", open: "فتح", openLink: "فتح الرابط",
      saveFail: "تم التحديد هنا، لكن تعذّر حفظه على الخادم.",
      pushOffer: "فعّل إشعارات الهاتف لتصلك تحديثات الطلبات فورًا.", pushOn: "إشعارات الهاتف مفعّلة.",
      pushEnable: "تفعيل", pushOff: "إيقاف", pushBusy: "…",
      st: { new: "جديد", admin_accepted: "تم قبول الطلب", restaurant_ready: "قيد التحضير", accepted: "تم القبول", picked_up: "تم الاستلام", on_the_way: "في الطريق", delivered: "تم التسليم", done: "مكتمل", canceled: "ملغي", sent: "تم الإرسال" },
    },
    en: {
      title: "Notifications", sub: "Follow the latest updates on your orders", back: "Back", markAll: "Mark all as read",
      all: "All", orders: "Orders", offers: "Offers", system: "System", unread: "Unread",
      emptyT: "No new notifications", emptyS: "We’ll tell you here about order updates and important offers.",
      loadError: "Couldn’t load notifications.", retry: "Try again",
      orderNo: "Order no.", status: "Order status", date: "Date & time",
      viewOrder: "View order", open: "Open", openLink: "Open link",
      saveFail: "Marked here, but couldn’t be saved on the server.",
      pushOffer: "Turn on phone notifications to get order updates instantly.", pushOn: "Phone notifications are on.",
      pushEnable: "Enable", pushOff: "Turn off", pushBusy: "…",
      st: { new: "New", admin_accepted: "Order accepted", restaurant_ready: "Being prepared", accepted: "Accepted", picked_up: "Picked up", on_the_way: "On the way", delivered: "Delivered", done: "Completed", canceled: "Canceled", sent: "Sent" },
    },
    fr: {
      title: "Notifications", sub: "Suivez les dernières mises à jour de vos commandes", back: "Retour", markAll: "Tout marquer comme lu",
      all: "Tout", orders: "Commandes", offers: "Offres", system: "Système", unread: "Non lu",
      emptyT: "Aucune nouvelle notification", emptyS: "Nous vous informerons ici des commandes et des offres importantes.",
      loadError: "Impossible de charger les notifications.", retry: "Réessayer",
      orderNo: "N° de commande", status: "Statut", date: "Date et heure",
      viewOrder: "Voir la commande", open: "Ouvrir", openLink: "Ouvrir le lien",
      saveFail: "Marqué ici, mais non enregistré sur le serveur.",
      pushOffer: "Activez les notifications du téléphone pour suivre vos commandes en direct.", pushOn: "Notifications du téléphone activées.",
      pushEnable: "Activer", pushOff: "Désactiver", pushBusy: "…",
      st: { new: "Nouveau", admin_accepted: "Commande acceptée", restaurant_ready: "En préparation", accepted: "Acceptée", picked_up: "Récupérée", on_the_way: "En route", delivered: "Livrée", done: "Terminée", canceled: "Annulée", sent: "Envoyée" },
    },
  };
  var t = function () { return SP.pick(T); };
  var lang = function () { return SP.lang; };

  var ICONS = {
    accepted: '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 3 3 5-6"/>',
    cooking: '<path d="M7 14a4 4 0 1 1 1.5-7.7A4 4 0 0 1 16 6.3 4 4 0 1 1 17 14v5H7v-5Z"/><path d="M7 17h10"/>',
    delivery: '<path d="M3 6h11v9H3z"/><path d="M14 9h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="2"/><circle cx="17" cy="17.5" r="2"/>',
    canceled: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
    order: '<path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
    offer: '<path d="M3 12V4h8l10 10-8 8L3 12Z"/><circle cx="7.5" cy="8.5" r="1.2"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  };
  var svg = function (k) { return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (ICONS[k] || ICONS.info) + "</svg>"; };

  var items = [];            /* newest first */
  var lastSeenAt = null;
  var readList = [];
  var filter = "all";
  var openId = null;
  var detailOpen = false;
  var ordersCache = null;    /* order id -> order (loaded once, only when an order notification is opened) */
  var loadingNow = false;

  function node(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  var kindLabel = function (c) { return t()[c] || ""; };
  var unreadItems = function () { return items.filter(function (n) { return N.isUnread(n, lastSeenAt, readList); }); };

  /* ---------------- text ---------------- */
  function applyText() {
    var s = t();
    document.title = "siymon | " + s.title;
    el("brandSub").textContent = s.title;
    el("pageTitle").textContent = s.title;
    el("pageSub").textContent = s.sub;
    el("goHome").textContent = s.back;
    el("markAll").textContent = s.markAll;
    el("ndClose").setAttribute("aria-label", s.back);
  }

  /* ---------------- list ---------------- */
  function showLoading() {
    var box = el("notificationsList");
    box.replaceChildren();
    for (var i = 0; i < 4; i++) box.appendChild(node("div", "nc-skel"));
  }
  function showError(msg) {
    var box = el("notificationsList");
    var w = node("div", "nc-state");
    w.appendChild(node("p", "", msg || t().loadError));
    var b = node("button", "", t().retry); b.type = "button";
    b.addEventListener("click", function () { showLoading(); load(); });
    w.appendChild(b);
    box.replaceChildren(w);
    el("ncChips").hidden = true; el("markAll").hidden = true; el("ncCount").hidden = true;
  }

  function emptyState() {
    var w = node("div", "nc-empty");
    w.innerHTML = '<svg viewBox="0 0 160 120" aria-hidden="true"><circle cx="80" cy="62" r="46" fill="rgba(93,214,44,.14)"/><path d="M80 30a20 20 0 0 0-20 20v13l-6 9h52l-6-9V50a20 20 0 0 0-20-20Z" fill="#5DD62C"/><path d="M71 78a9 9 0 0 0 18 0Z" fill="#0F0F0F"/><circle cx="118" cy="30" r="4" fill="#5DD62C"/><circle cx="36" cy="40" r="3" fill="#5DD62C" opacity=".6"/><path d="m128 52 4 4m0-4-4 4" stroke="#5DD62C" stroke-width="2.5" stroke-linecap="round"/></svg>';
    w.appendChild(node("b", "", t().emptyT));
    w.appendChild(node("span", "", t().emptyS));
    return w;
  }

  function shortId(id) {
    id = String(id || "");
    var i = id.lastIndexOf("-");
    return id.length > 10 && i > 0 ? id.slice(i + 1) : id;
  }

  function row(n, idx) {
    var unread = N.isUnread(n, lastSeenAt, readList);
    var kind = N.iconKind(n);
    var b = node("button", "nc-item" + (unread ? " unread" : ""));
    b.type = "button"; b.dataset.id = String(n.id);
    b.style.animationDelay = Math.min(idx, 8) * 25 + "ms";

    var ic = node("span", "nc-ic k-" + kind); ic.innerHTML = svg(kind);
    var body = node("span", "nc-body");
    var title = String(n.title || "").trim() || kindLabel(N.classify(n));
    var sum = N.summaryOf(n);
    if (sum && sum === title) sum = "";
    body.appendChild(node("span", "nc-title", title));
    if (sum) body.appendChild(node("span", "nc-sum", sum));
    var meta = node("span", "nc-meta");
    meta.appendChild(node("time", "", N.relTime(n.createdAt, Date.now(), lang())));
    var oid = N.orderIdOf(n);
    if (oid) { meta.appendChild(document.createTextNode("·")); meta.appendChild(node("bdi", "", "#" + shortId(oid))); }
    if (unread) { var dot = node("span", "nc-unr", "● " + t().unread); meta.appendChild(document.createTextNode("·")); meta.appendChild(dot); }
    body.appendChild(meta);
    b.appendChild(ic); b.appendChild(body);
    return b;
  }

  function counts() {
    var c = { orders: 0, offers: 0, system: 0 };
    items.forEach(function (n) { c[N.classify(n)]++; });
    return c;
  }

  function renderChips() {
    var host = el("ncChips");
    var c = counts();
    var kinds = ["orders", "offers", "system"].filter(function (k) { return c[k] > 0; });
    /* categories only when they are real: at least two different kinds present */
    if (kinds.length < 2) { host.hidden = true; filter = "all"; return; }
    if (filter !== "all" && kinds.indexOf(filter) < 0) filter = "all";
    host.hidden = false;
    host.replaceChildren();
    ["all"].concat(kinds).forEach(function (k) {
      var b = node("button", "nc-chip" + (k === filter ? " on" : ""), kindLabel(k));
      b.type = "button"; b.dataset.k = k; b.setAttribute("aria-pressed", String(k === filter));
      host.appendChild(b);
    });
  }

  function renderHeader() {
    var u = unreadItems().length;
    var cnt = el("ncCount");
    cnt.hidden = u < 1; cnt.textContent = String(u);
    el("markAll").hidden = u < 1;
  }

  function render() {
    var box = el("notificationsList");
    renderHeader();
    renderChips();
    if (!items.length) { box.replaceChildren(emptyState()); return; }
    var list = filter === "all" ? items : items.filter(function (n) { return N.classify(n) === filter; });
    var frag = document.createDocumentFragment();
    list.forEach(function (n, i) { frag.appendChild(row(n, i)); });
    box.replaceChildren(frag);
  }

  /* ---------------- load ---------------- */
  function load() {
    if (loadingNow) return Promise.resolve();
    loadingNow = true;
    return SP.api("/api/customer/notifications").then(function (res) {
      items = N.sortNewest(res.notifications || []);
      lastSeenAt = res.lastSeenAt || null;
      readList = N.readIds();
      var keepScroll = window.scrollY;
      render();
      window.scrollTo(0, keepScroll);
      if (detailOpen && openId && !items.some(function (n) { return String(n.id) === String(openId); })) closeDetail(true);
    }).catch(function (e) {
      if (e && e.status === 401) { SP.clearSession(); SP.toLogin(); return; }
      if (!items.length) showError(t().loadError); /* a failed background refresh keeps what is on screen */
    }).then(function () { loadingNow = false; });
  }

  /* ---------------- mark read ---------------- */
  function markOne(n) {
    if (!N.isUnread(n, lastSeenAt, readList)) return;
    readList = N.markRead([String(n.id)]);
    render();   /* header counter + row state update instantly */
  }

  function markAll() {
    var btn = el("markAll");
    btn.disabled = true;
    SP.api("/api/customer/notifications/seen", { method: "POST", body: "{}" }).then(function (res) {
      lastSeenAt = (res && res.lastSeenAt) || new Date().toISOString();
    }).catch(function () {
      var w = el("ncWarn");
      if (!w) { w = node("p", "hint muted", t().saveFail); w.id = "ncWarn"; el("notificationsList").insertAdjacentElement("beforebegin", w); }
      setTimeout(function () { var x = el("ncWarn"); if (x) x.remove(); }, 4000);
    }).then(function () {
      readList = N.markRead(items.map(function (n) { return String(n.id); }));
      btn.disabled = false;
      render();
    });
  }

  /* ---------------- details sheet ---------------- */
  function loadOrders() {
    if (ordersCache) return Promise.resolve(ordersCache);
    return SP.api("/api/customer/orders").then(function (res) {
      ordersCache = {};
      (res.orders || []).forEach(function (o) { ordersCache[String(o.id)] = o; });
      return ordersCache;
    }).catch(function () { return null; }); /* no status then — never invented */
  }

  function row2(label, valueNode) {
    var r = node("div", "nd-row");
    r.appendChild(node("span", "", label));
    var b = node("b"); b.appendChild(valueNode); r.appendChild(b);
    return r;
  }

  /* order ids (#MU0JYS4V-48EE87) are isolated left-to-right so RTL text never scrambles them */
  function fillMessage(host, text) {
    host.replaceChildren();
    var re = /#[A-Za-z0-9]{3,}-[A-Za-z0-9]{3,}/g, last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) host.appendChild(document.createTextNode(text.slice(last, m.index)));
      host.appendChild(node("bdi", "", m[0]));
      last = m.index + m[0].length;
    }
    if (last < text.length) host.appendChild(document.createTextNode(text.slice(last)));
  }

  function fillDetail(n) {
    var c = N.classify(n), kind = N.iconKind(n);
    el("ndIc").innerHTML = svg(kind);
    el("ndKind").textContent = kindLabel(c);
    el("ndTitle").textContent = String(n.title || "").trim() || kindLabel(c);
    fillMessage(el("ndMsg"), String(n.message || ""));
    var img = el("ndImg");
    var src = String(n.imageUrl || "");
    if (src) { img.src = src; img.hidden = false; } else { img.removeAttribute("src"); img.hidden = true; }

    var rows = el("ndRows"); rows.replaceChildren();
    var when = N.fullDate(n.createdAt, lang());
    if (when) rows.appendChild(row2(t().date, document.createTextNode(when)));
    var oid = N.orderIdOf(n);
    if (oid) {
      rows.appendChild(row2(t().orderNo, node("bdi", "", "#" + oid)));
      loadOrders().then(function (map) {
        if (String(openId) !== String(n.id)) return;
        var o = map && map[oid];
        if (!o) return;
        var key = String(o.status || "new");
        rows.appendChild(row2(t().status, node("span", "nd-st" + (key === "canceled" ? " bad" : ""), t().st[key] || key)));
        rows.hidden = false;
      });
    }
    rows.hidden = !rows.children.length;

    var act = el("ndAct"); act.replaceChildren();
    var d = N.destinationOf(n);
    if (d) {
      var a = node("a", "nd-go", d.kind === "order" ? t().viewOrder : d.kind === "external" ? t().openLink : t().open);
      a.href = d.href;
      if (d.kind === "external") { a.target = "_blank"; a.rel = "noopener noreferrer"; }
      act.appendChild(a);
    }
  }

  function openDetail(id) {
    var n = items.filter(function (x) { return String(x.id) === String(id); })[0];
    if (!n) return;
    openId = String(n.id);
    fillDetail(n);
    var root = el("ndRoot");
    root.hidden = false;
    requestAnimationFrame(function () { root.classList.add("on"); });
    document.body.style.overflow = "hidden";
    detailOpen = true;
    try { history.pushState({ nd: openId }, ""); } catch (_e) {}
    markOne(n);
    try { el("ndSheet").focus({ preventScroll: true }); } catch (_e) {}
  }

  function hideDetail() {
    var root = el("ndRoot");
    detailOpen = false; openId = null;
    root.classList.remove("on");
    document.body.style.overflow = "";
    setTimeout(function () { if (!detailOpen) root.hidden = true; }, 240);
  }
  /* X / backdrop / top back all go through history so they behave exactly like the phone's Back */
  function closeDetail(silent) {
    if (!detailOpen) return;
    if (silent === true) { hideDetail(); return; }
    if (history.state && history.state.nd) history.back(); else hideDetail();
  }
  window.addEventListener("popstate", function () { if (detailOpen) hideDetail(); });

  /* ---------------- phone-push row (only real, working choices) ---------------- */
  function renderPush() {
    var rowEl = el("pushRow");
    if (!window.SPush) { rowEl.hidden = true; return; }
    window.SPush.status().then(function (st) {
      rowEl.className = "nc-push"; rowEl.replaceChildren();
      var s = t();
      if (st.state === "unavailable") { rowEl.hidden = true; return; }
      rowEl.hidden = false;
      if (st.state === "off") {
        rowEl.appendChild(node("span", "", s.pushOffer));
        var b = node("button", "", s.pushEnable); b.type = "button";
        b.addEventListener("click", function () {
          b.disabled = true; b.textContent = s.pushBusy;
          window.SPush.enable().then(renderPush).catch(function (e) {
            if (e && e.code === "dismissed") { renderPush(); return; }
            rowEl.className = "nc-push err"; rowEl.replaceChildren(node("span", "", window.SPush.explain(e && e.code)));
          });
        });
        rowEl.appendChild(b);
      } else if (st.state === "on") {
        rowEl.className = "nc-push quiet";
        rowEl.appendChild(node("span", "", s.pushOn));
        var o = node("button", "ghost", s.pushOff); o.type = "button";
        o.addEventListener("click", function () { o.disabled = true; window.SPush.disable().then(renderPush); });
        rowEl.appendChild(o);
      } else {
        rowEl.className = "nc-push quiet";
        rowEl.appendChild(node("span", "", window.SPush.explain(st.state)));
      }
    }).catch(function () { rowEl.hidden = true; });
  }

  /* ---------------- events ---------------- */
  el("notificationsList").addEventListener("click", function (e) {
    var b = e.target.closest(".nc-item");
    if (b) openDetail(b.dataset.id);
  });
  el("ncChips").addEventListener("click", function (e) {
    var b = e.target.closest(".nc-chip");
    if (!b) return;
    filter = b.dataset.k || "all"; render();
  });
  el("markAll").addEventListener("click", markAll);
  el("ndClose").addEventListener("click", function () { closeDetail(); });
  el("ndBack").addEventListener("click", function () { closeDetail(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && detailOpen) closeDetail(); });
  /* the top "back" closes the sheet first (before it would leave the page) */
  el("goHome").addEventListener("click", function (e) {
    if (detailOpen) { e.preventDefault(); closeDetail(); }
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", function (ev) {
      var d = ev && ev.data;
      if (d && (d.type === "PUSH_NOTIFICATION" || d.type === "OPEN_NOTIFICATIONS")) load();
    });
  }
  document.addEventListener("visibilitychange", function () { if (!document.hidden) load(); });
  window.addEventListener("siymon:online", load);
  window.addEventListener("siymon:revive", load);
  window.addEventListener("siymon:push-changed", renderPush);
  setInterval(function () { if (!document.hidden && items.length && !detailOpen) render(); }, 60000); /* keeps "منذ 5 دقائق" fresh */

  /* ---------------- init ---------------- */
  (function init() {
    if (!SP.getToken()) { SP.toLogin(); return; }
    if (history.state && history.state.nd) { try { history.replaceState(null, ""); } catch (_e) {} }
    applyText();
    showLoading();
    if ("serviceWorker" in navigator) window.addEventListener("load", function () { navigator.serviceWorker.register("/sw.js").catch(function () {}); });
    load();
    if (document.readyState === "complete") renderPush(); else window.addEventListener("load", renderPush);
  })();
})();

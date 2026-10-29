/* siymon — notification logic shared by the notification center, the bottom-bar badge and the home page.
   Works in the browser (window.SNotif) and in Node (module.exports) so it can be unit-tested.

   What the server really stores (see server.js):
     order updates : { type:"order_status", orderId, stage, title, message, createdAt, ... }
     admin posts   : { type:"broadcast", title, message, imageUrl, linkUrl|null, createdAt, ... }
   The server only keeps ONE read marker per customer (lastSeenAt = "everything up to now"),
   so per-notification "read" is kept on this device (localStorage) on top of that marker. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.SNotif = factory(root);
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  "use strict";

  var READ_KEY = "siymon_notif_read_v1";
  var PROFILE_KEY = "siymon_customer_profile_v1";
  var MAX_READ_IDS = 400;
  var ORDER_ID_RE = /#([A-Za-z0-9]{3,}-[A-Za-z0-9]{3,})/;
  var ROUTES = /^\/(?:(?:orders|chat|support|policy|links|notifications)\/?)?(?:[?#].*)?$/;

  /* ---------------- classification ---------------- */
  function orderIdOf(n) {
    if (!n) return "";
    if (n.orderId) return String(n.orderId);
    var m = ORDER_ID_RE.exec(String(n.message || ""));
    return m ? m[1] : "";
  }

  /** "orders" | "offers" | "system" — derived from the real `type` field only. */
  function classify(n) {
    var t = String((n && n.type) || "");
    if (t === "order_status" || (n && n.orderId)) return "orders";
    if (t === "broadcast") return "offers";
    return "system";
  }

  /** The list shows a short line: the message without the "(طلب #ID)" tail (the id lives in the details). */
  function summaryOf(n) {
    var m = String((n && n.message) || "").replace(/\s+/g, " ").trim();
    m = m.replace(/\s*[(（]\s*(?:طلب|order|commande)\s*#[^)）]*[)）]\s*$/i, "").trim();
    return m;
  }

  /** Which icon to use: from the real stage when there is one, else from the text. */
  function iconKind(n) {
    var stage = String((n && n.stage) || "");
    if (stage === "admin_accepted") return "accepted";
    if (stage === "restaurant_ready") return "cooking";
    if (stage === "accepted" || stage === "picked_up" || stage === "on_the_way") return "delivery";
    if (stage === "delivered" || stage === "done") return "accepted";
    if (stage === "canceled") return "canceled";
    var c = classify(n);
    if (c === "orders") return "order";
    if (c === "offers") return "offer";
    return "info";
  }

  /** Destination for the details button. Never invented: only real, valid targets. */
  function destinationOf(n) {
    if (!n) return null;
    var oid = orderIdOf(n);
    if (classify(n) === "orders" && oid)
      return { kind: "order", href: "/orders/?order=" + encodeURIComponent(oid), orderId: oid };
    var link = String(n.linkUrl || "").trim();
    if (!link) return null; /* null = the admin chose no link (server default is /notifications/) */
    if (link.charAt(0) === "/" && link.charAt(1) !== "/" && ROUTES.test(link) && link.split("?")[0].replace(/\/$/, "") !== "/notifications")
      return { kind: "internal", href: link };
    if (/^https:\/\/[^\s<>"'`\\]+$/i.test(link)) return { kind: "external", href: link };
    return null;
  }

  function ms(iso) {
    var t = iso ? new Date(String(iso)).getTime() : 0;
    return isFinite(t) ? t : 0;
  }

  /** Newest first by the real creation date. */
  function sortNewest(list) {
    return (Array.isArray(list) ? list.slice() : []).sort(function (a, b) {
      return ms(b && b.createdAt) - ms(a && a.createdAt);
    });
  }

  /* ---------------- read state ---------------- */
  function storageKey() {
    var who = "";
    try {
      var p = JSON.parse(root.localStorage.getItem(PROFILE_KEY) || "null");
      who = String((p && (p.id || p.email || p.phone)) || "");
    } catch (_e) {}
    return READ_KEY + ":" + who;
  }
  function readIds() {
    try {
      var a = JSON.parse(root.localStorage.getItem(storageKey()) || "[]");
      return Array.isArray(a) ? a : [];
    } catch (_e) {
      return [];
    }
  }
  function markRead(ids) {
    var cur = readIds();
    var set = {};
    cur.forEach(function (i) { set[i] = 1; });
    (Array.isArray(ids) ? ids : [ids]).forEach(function (i) {
      if (i && !set[i]) { set[i] = 1; cur.push(String(i)); }
    });
    if (cur.length > MAX_READ_IDS) cur = cur.slice(cur.length - MAX_READ_IDS);
    try { root.localStorage.setItem(storageKey(), JSON.stringify(cur)); } catch (_e) {}
    return cur;
  }

  /** Unread = newer than the server marker AND not opened on this device. */
  function isUnread(n, lastSeenAt, readList) {
    if (!n) return false;
    var t = ms(n.createdAt);
    if (!t || t <= ms(lastSeenAt)) return false;
    return (readList || []).indexOf(String(n.id)) < 0;
  }
  function unreadCount(res, readList) {
    var list = (res && res.notifications) || [];
    var rl = readList || readIds();
    var n = 0;
    for (var i = 0; i < list.length; i++) if (isUnread(list[i], res.lastSeenAt, rl)) n++;
    return n;
  }

  /* ---------------- time ---------------- */
  function locale(lang) {
    return lang === "ar" ? "ar-u-nu-latn" : lang === "fr" ? "fr-FR" : "en-US";
  }
  function arUnit(n, one, two, few, many) {
    if (n === 1) return "منذ " + one;
    if (n === 2) return "منذ " + two;
    return "منذ " + n + " " + (n >= 3 && n <= 10 ? few : many);
  }
  /** "منذ 5 دقائق" / "5 minutes ago" … older than a week → a plain date. */
  function relTime(iso, nowMs, lang) {
    var t = ms(iso);
    if (!t) return "";
    var d = Math.max(0, (nowMs - t) / 1000);
    var min = Math.floor(d / 60), h = Math.floor(d / 3600), day = Math.floor(d / 86400);
    if (d < 45) return lang === "ar" ? "الآن" : lang === "fr" ? "à l’instant" : "just now";
    if (day >= 7) return fullDate(iso, lang, true);
    if (lang === "ar") {
      if (min < 60) return arUnit(Math.max(1, min), "دقيقة", "دقيقتين", "دقائق", "دقيقة");
      if (h < 24) return arUnit(h, "ساعة", "ساعتين", "ساعات", "ساعة");
      return arUnit(day, "يوم", "يومين", "أيام", "يوماً");
    }
    var rtf = new Intl.RelativeTimeFormat(locale(lang), { numeric: "auto" });
    if (min < 60) return rtf.format(-Math.max(1, min), "minute");
    if (h < 24) return rtf.format(-h, "hour");
    return rtf.format(-day, "day");
  }
  function fullDate(iso, lang, dateOnly) {
    var d = new Date(String(iso));
    if (isNaN(d.getTime())) return "";
    var o = { day: "numeric", month: "long", year: "numeric" };
    if (!dateOnly) { o.hour = "2-digit"; o.minute = "2-digit"; o.hour12 = lang === "en"; }
    return d.toLocaleString(locale(lang), o);
  }

  /* ---------------- phone-notification prompt policy ---------------- */
  var DAY = 86400000;
  /** Pure decision: should we show the "enable notifications" sheet now? */
  function promptDecision(s, now) {
    if (!s.loggedIn) return "no:login"; /* a subscription belongs to a customer account */
    if (!s.configured) return "no:server-not-configured";
    if (!s.secure) return "no:insecure";
    if (!s.supported) return "no:unsupported";
    if (s.permission === "denied") return "no:denied"; /* respect the choice, never loop */
    if (s.permission === "granted") return "no:granted";
    if (s.subscribed) return "no:subscribed";
    var c = Number(s.dismissCount || 0);
    if (c >= 3) return "no:max-dismissals";
    if (c > 0) {
      var wait = c === 1 ? 7 * DAY : 30 * DAY;
      if (now - Number(s.lastDismissAt || 0) < wait) return "no:snoozed";
    }
    return "show";
  }

  return {
    orderIdOf: orderIdOf, classify: classify, summaryOf: summaryOf, iconKind: iconKind,
    destinationOf: destinationOf, sortNewest: sortNewest, readIds: readIds, markRead: markRead,
    isUnread: isUnread, unreadCount: unreadCount, relTime: relTime, fullDate: fullDate,
    promptDecision: promptDecision,
  };
});

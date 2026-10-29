// Unit tests for public/notif-logic.js (notification classification, destinations, read state, prompt policy)
const test = require("node:test");
const assert = require("node:assert/strict");

// minimal localStorage for the read-state helpers
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const N = require("../public/notif-logic.js");

const order = (o = {}) => ({
  id: "n1", type: "order_status", orderId: "MU0JYS4V-48EE87", stage: "accepted",
  title: "تحديث الطلب", message: "طلبك في طريقه إليك 🚚 (طلب #MU0JYS4V-48EE87)", createdAt: "2026-09-14T02:19:00Z", ...o,
});
const bcast = (o = {}) => ({ id: "b1", type: "broadcast", title: "عرض اليوم", message: "خصم 20%", linkUrl: null, url: "/notifications/", createdAt: "2026-09-14T03:00:00Z", ...o });

test("classify uses the real type field", () => {
  assert.equal(N.classify(order()), "orders");
  assert.equal(N.classify(bcast()), "offers");
  assert.equal(N.classify({ id: "x", type: "something" }), "system");
  assert.equal(N.classify({ id: "x", orderId: "A-B" }), "orders");
});

test("order id: field first, then the #ID inside old messages", () => {
  assert.equal(N.orderIdOf(order()), "MU0JYS4V-48EE87");
  assert.equal(N.orderIdOf({ message: "تم قبول طلبك ✅ (طلب #MQ45FWC6-B78BA7)" }), "MQ45FWC6-B78BA7");
  assert.equal(N.orderIdOf(bcast()), "");
});

test("summary drops the repeated '(طلب #ID)' tail but keeps the text", () => {
  assert.equal(N.summaryOf(order()), "طلبك في طريقه إليك 🚚");
  assert.equal(N.summaryOf(bcast()), "خصم 20%");
  assert.equal(N.summaryOf({ message: "  a   b " }), "a b");
});

test("icon follows the real stage", () => {
  assert.equal(N.iconKind(order({ stage: "admin_accepted" })), "accepted");
  assert.equal(N.iconKind(order({ stage: "restaurant_ready" })), "cooking");
  assert.equal(N.iconKind(order({ stage: "accepted" })), "delivery");
  assert.equal(N.iconKind(order({ stage: "canceled" })), "canceled");
  assert.equal(N.iconKind(bcast()), "offer");
});

test("destination: order -> its real id; broadcast -> only valid links; never invented", () => {
  assert.deepEqual(N.destinationOf(order()), { kind: "order", href: "/orders/?order=MU0JYS4V-48EE87", orderId: "MU0JYS4V-48EE87" });
  assert.equal(N.destinationOf(bcast()), null); // no link chosen by the admin
  assert.deepEqual(N.destinationOf(bcast({ linkUrl: "/orders/" })), { kind: "internal", href: "/orders/" });
  assert.equal(N.destinationOf(bcast({ linkUrl: "/nope/page" })), null); // route does not exist
  assert.equal(N.destinationOf(bcast({ linkUrl: "//evil.com" })), null); // protocol-relative
  assert.equal(N.destinationOf(bcast({ linkUrl: "javascript:alert(1)" })), null);
  assert.equal(N.destinationOf(bcast({ linkUrl: "/notifications/" })), null); // pointless self-link
  assert.deepEqual(N.destinationOf(bcast({ linkUrl: "https://example.com/x" })), { kind: "external", href: "https://example.com/x" });
  assert.equal(N.destinationOf(bcast({ linkUrl: "http://example.com" })), null); // https only
});

test("sort: newest first by the real createdAt, input untouched", () => {
  const a = order({ id: "a", createdAt: "2026-01-01T00:00:00Z" }), b = order({ id: "b", createdAt: "2026-03-01T00:00:00Z" }), c = order({ id: "c", createdAt: "2026-02-01T00:00:00Z" });
  const input = [a, b, c];
  assert.deepEqual(N.sortNewest(input).map((n) => n.id), ["b", "c", "a"]);
  assert.deepEqual(input.map((n) => n.id), ["a", "b", "c"]);
});

test("unread = newer than the server marker AND not opened on this device", () => {
  const res = { lastSeenAt: "2026-09-14T02:18:30Z", notifications: [order({ id: "n1" }), order({ id: "n0", createdAt: "2026-09-14T02:00:00Z" }), bcast({ id: "b1" })] };
  assert.equal(N.unreadCount(res, []), 2);                // n1 + b1 are newer than the marker
  assert.equal(N.unreadCount(res, ["n1"]), 1);            // opened one
  assert.equal(N.unreadCount({ ...res, lastSeenAt: null }, ["n1", "b1"]), 1); // n0 still unread with no marker
  assert.equal(N.unreadCount({ notifications: [] }, []), 0);
});

test("read ids persist, are per customer and bounded", () => {
  store.clear();
  localStorage.setItem("siymon_customer_profile_v1", JSON.stringify({ email: "a@x.com" }));
  N.markRead(["n1", "n2"]); N.markRead("n2");
  assert.deepEqual(N.readIds(), ["n1", "n2"]);
  localStorage.setItem("siymon_customer_profile_v1", JSON.stringify({ email: "b@x.com" }));
  assert.deepEqual(N.readIds(), []);                       // another account on the same phone
  const many = Array.from({ length: 450 }, (_, i) => "id" + i);
  N.markRead(many);
  assert.equal(N.readIds().length, 400);
  assert.equal(N.readIds().at(-1), "id449");
});

test("relative time (Arabic plurals) and old dates", () => {
  const now = Date.parse("2026-09-14T12:00:00Z"), ago = (s) => new Date(now - s * 1000).toISOString();
  assert.equal(N.relTime(ago(10), now, "ar"), "الآن");
  assert.equal(N.relTime(ago(60), now, "ar"), "منذ دقيقة");
  assert.equal(N.relTime(ago(120), now, "ar"), "منذ دقيقتين");
  assert.equal(N.relTime(ago(300), now, "ar"), "منذ 5 دقائق");
  assert.equal(N.relTime(ago(12 * 60), now, "ar"), "منذ 12 دقيقة");
  assert.equal(N.relTime(ago(3 * 3600), now, "ar"), "منذ 3 ساعات");
  assert.equal(N.relTime(ago(2 * 86400), now, "ar"), "منذ يومين");
  assert.match(N.relTime(ago(5 * 60), now, "en"), /5 minutes ago/);
  assert.match(N.relTime(ago(20 * 86400), now, "en"), /2026/); // > 7 days: a date
  assert.equal(N.relTime("", now, "ar"), "");
});

test("permission-prompt policy", () => {
  const base = { loggedIn: true, configured: true, secure: true, supported: true, permission: "default", subscribed: false };
  const D = 86400000, now = 100 * D;
  assert.equal(N.promptDecision(base, now), "show");
  assert.equal(N.promptDecision({ ...base, loggedIn: false }, now), "no:login");
  assert.equal(N.promptDecision({ ...base, configured: false }, now), "no:server-not-configured");
  assert.equal(N.promptDecision({ ...base, secure: false }, now), "no:insecure");
  assert.equal(N.promptDecision({ ...base, supported: false }, now), "no:unsupported");
  assert.equal(N.promptDecision({ ...base, permission: "denied" }, now), "no:denied");
  assert.equal(N.promptDecision({ ...base, permission: "granted" }, now), "no:granted");
  assert.equal(N.promptDecision({ ...base, subscribed: true }, now), "no:subscribed");
  // "later": 7 days, then 30 days, then never
  assert.equal(N.promptDecision({ ...base, dismissCount: 1, lastDismissAt: now - 6 * D }, now), "no:snoozed");
  assert.equal(N.promptDecision({ ...base, dismissCount: 1, lastDismissAt: now - 8 * D }, now), "show");
  assert.equal(N.promptDecision({ ...base, dismissCount: 2, lastDismissAt: now - 29 * D }, now), "no:snoozed");
  assert.equal(N.promptDecision({ ...base, dismissCount: 2, lastDismissAt: now - 31 * D }, now), "show");
  assert.equal(N.promptDecision({ ...base, dismissCount: 3, lastDismissAt: now - 400 * D }, now), "no:max-dismissals");
});

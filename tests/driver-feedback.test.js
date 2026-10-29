"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fb = require("../lib/driver-feedback");
const DAY = 24 * 3600 * 1000, NOW = Date.parse("2026-10-21T12:00:00Z");
const delivered = (over = {}) => ({ id: "O1", status: "delivered", driverId: "D1", deliveredAt: new Date(NOW - DAY).toISOString(), ...over });

test("rating payload validation", () => {
  assert.equal(fb.validateDriverRating({ stars: 0, polite: true, askedExtraMoney: false }).error, "invalid_stars");
  assert.equal(fb.validateDriverRating({ stars: 4.5, polite: true, askedExtraMoney: false }).error, "invalid_stars");
  assert.equal(fb.validateDriverRating({ stars: 5, askedExtraMoney: false }).error, "polite_required");
  assert.equal(fb.validateDriverRating({ stars: 5, polite: "yes", askedExtraMoney: false }).error, "polite_required");
  assert.equal(fb.validateDriverRating({ stars: 5, polite: true }).error, "extra_money_required");
  const r = fb.validateDriverRating({ stars: 5, polite: true, askedExtraMoney: false, comment: "  ok\u0000x ".padEnd(900, "a") });
  assert.ok(r.ok); assert.equal(r.value.comment.length, 500); assert.ok(!r.value.comment.includes("\u0000"));
});

test("can rate: delivered, once, within 7 days", () => {
  assert.ok(fb.canRateDriver(delivered(), NOW).ok);
  assert.equal(fb.canRateDriver(delivered({ status: "on_the_way" }), NOW).error, "not_delivered");
  assert.equal(fb.canRateDriver(delivered({ driverId: "" }), NOW).error, "no_driver");
  assert.equal(fb.canRateDriver(delivered({ driverRating: { stars: 5 } }), NOW).error, "already_rated");
  assert.equal(fb.canRateDriver(delivered({ deliveredAt: new Date(NOW - 8 * DAY).toISOString() }), NOW).error, "window_expired");
  assert.ok(fb.canRateDriver(delivered({ deliveredAt: new Date(NOW - 6.9 * DAY).toISOString() }), NOW).ok);
});

test("summary counts flags; reviews hide customer identity and flags", () => {
  const mk = (stars, polite, ask, c) => ({ status: "delivered", driverId: "D1", customer: { name: "Secret" }, driverRating: { stars, polite, askedExtraMoney: ask, comment: c, createdAt: "2026-10-20" } });
  const orders = [mk(5, true, false, "good"), mk(2, false, true, "bad"), { driverId: "D2", driverRating: { stars: 1, polite: false, askedExtraMoney: true } }];
  const s = fb.summarize(orders, "D1");
  assert.deepEqual([s.count, s.avg, s.impolite, s.askedMoney, s.dist[5], s.dist[2]], [2, 3.5, 1, 1, 1, 1]);
  const rv = fb.reviewsFor(orders, "D1");
  assert.equal(rv.length, 2); assert.ok(!JSON.stringify(rv).includes("Secret")); assert.ok(!("polite" in rv[0]));
});

test("chat open only with driver and active order; unread/read", () => {
  assert.equal(fb.isChatOpen({ status: "accepted", driverId: "D1" }), true);
  assert.equal(fb.isChatOpen({ status: "restaurant_ready" }), false);
  for (const s of ["delivered", "done", "canceled"]) assert.equal(fb.isChatOpen({ status: s, driverId: "D1" }), false);
  const chat = { messages: [{ from: "driver", createdAt: "2026-10-21T10:00:00Z" }, { from: "customer", createdAt: "2026-10-21T10:01:00Z" }] };
  assert.equal(fb.unreadFor(chat, "customer"), 1);
  assert.equal(fb.unreadFor(chat, "driver"), 1);
  assert.equal(fb.markRead(chat, "customer", "2026-10-21T10:05:00Z"), true);
  assert.equal(fb.unreadFor(chat, "customer"), 0);
  assert.equal(fb.markRead(chat, "customer", "2026-10-21T10:06:00Z"), false);
});

test("tracking only while picked_up/on_the_way; distance and age", () => {
  const order = { status: "on_the_way", customer: { lat: 33.27, lng: -7.58 } };
  const fix = { lat: 33.26, lng: -7.58, at: NOW - 7000 };
  const p = fb.trackPayload(order, fix, NOW);
  assert.equal(p.tracking, true); assert.equal(p.driver.ageSec, 7);
  assert.ok(p.distanceM > 1000 && p.distanceM < 1200);
  assert.equal(fb.trackPayload({ ...order, status: "picked_up" }, fix, NOW).tracking, true);
  assert.equal(fb.trackPayload({ ...order, status: "accepted" }, fix, NOW).tracking, false);
  assert.equal(fb.trackPayload({ ...order, status: "delivered" }, fix, NOW).driver, undefined);
  assert.equal(fb.trackPayload(order, { ...fix, at: NOW - 6 * 60000 }, NOW).driver, null);
  assert.equal(fb.trackPayload({ status: "on_the_way", customer: { lat: 0, lng: 0 } }, fix, NOW).destination, null);
});

test("destination falls back to the maps link in notes (older orders)", () => {
  const old = { status: "on_the_way", customer: { notes: "📍 الموقع الدقيق للعميل: https://maps.google.com/?q=33.261548,-7.570939" } };
  assert.deepEqual(fb.customerCoords(old), { lat: 33.261548, lng: -7.570939 });
  assert.equal(fb.customerCoords({ customer: { notes: "x", lat: 0, lng: 0 } }), null);
  assert.deepEqual(fb.customerCoords({ customer: { lat: 33.2, lng: -7.5, notes: "?q=1.5,2.5" } }), { lat: 33.2, lng: -7.5 });
  const p = fb.trackPayload(old, { lat: 33.26, lng: -7.57, at: Date.now() }, Date.now());
  assert.ok(p.destination && p.distanceM > 0);
});

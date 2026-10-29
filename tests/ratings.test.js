"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../lib/ratings");
const fb = require("../lib/driver-feedback");

const NOW = Date.parse("2026-10-27T12:00:00Z");
const delivered = (over = {}) => ({ id: "o1", status: "delivered", restaurantId: "s1", driverId: "d1", customerId: "c1", deliveredAt: new Date(NOW - 3600e3).toISOString(), customer: { name: "Ali Benjelloun" }, ...over });

test("stars must be an integer 1..5; comment is cleaned and capped", () => {
  assert.equal(R.validateStoreRating({ stars: 0 }).ok, false);
  assert.equal(R.validateStoreRating({ stars: 6 }).ok, false);
  assert.equal(R.validateStoreRating({ stars: 4.5 }).ok, false);
  assert.equal(R.validateStoreRating({ stars: "x" }).ok, false);
  const v = R.validateStoreRating({ stars: 5, comment: "  <b>great</b>\n\n food " + "x".repeat(900) });
  assert.equal(v.ok, true);
  assert.ok(!/[<>]/.test(v.value.comment));
  assert.ok(v.value.comment.length <= R.MAX_COMMENT);
});

test("only a delivered order with a store, inside the 7-day window, can be rated", () => {
  assert.equal(R.canRateStore(delivered(), NOW).ok, true);
  assert.equal(R.canRateStore(delivered({ status: "on_the_way" }), NOW).error, "not_delivered");
  assert.equal(R.canRateStore(delivered({ restaurantId: "" }), NOW).error, "no_store");
  assert.equal(R.canRateStore(delivered({ deliveredAt: new Date(NOW - 8 * 86400e3).toISOString() }), NOW).error, "window_expired");
  assert.equal(R.canRateStore(null, NOW).error, "not_found");
});

test("a new comment waits for moderation; stars alone need none", () => {
  const o = delivered();
  const r = R.applyStoreRating(o, { stars: 4, comment: "tasty" });
  assert.equal(R.commentStatusOf(r), "pending");
  assert.equal(R.isPublished(r), false);
  const o2 = delivered({ id: "o2" });
  assert.equal(R.commentStatusOf(R.applyStoreRating(o2, { stars: 5, comment: "" })), "none");
});

test("editing: stars may change; a CHANGED comment returns to moderation, an unchanged one keeps its decision", () => {
  const o = delivered();
  R.applyStoreRating(o, { stars: 4, comment: "good" });
  assert.equal(R.moderate(o.customerRating, { decision: "publish", by: "a1" }).ok, true);
  R.applyStoreRating(o, { stars: 2, comment: "good" }); // same text, new stars
  assert.equal(o.customerRating.stars, 2);
  assert.equal(R.commentStatusOf(o.customerRating), "published");
  R.applyStoreRating(o, { stars: 2, comment: "good... but something nasty" }); // edited into something nobody approved
  assert.equal(R.commentStatusOf(o.customerRating), "pending");
  assert.equal(R.canRateStore(o, NOW).editing, true);
});

test("moderation records reviewer/time/reason; rejecting needs a reason; illegal moves are refused", () => {
  const o = delivered();
  R.applyStoreRating(o, { stars: 1, comment: "bad" });
  assert.equal(R.moderate(o.customerRating, { decision: "reject", by: "a1", reason: "" }).code, "REASON_REQUIRED");
  assert.equal(R.commentStatusOf(o.customerRating), "pending", "failed attempt changes nothing");
  assert.equal(R.moderate(o.customerRating, { decision: "maybe", by: "a1" }).code, "INVALID_DECISION");
  const ok = R.moderate(o.customerRating, { decision: "reject", by: "a1", reason: "insults", now: new Date("2026-10-27T10:00:00Z") });
  assert.deepEqual([ok.ok, ok.from, ok.to], [true, "pending", "rejected"]);
  assert.equal(o.customerRating.moderation.by, "a1");
  assert.equal(o.customerRating.moderation.at, "2026-10-27T10:00:00.000Z");
  assert.equal(o.customerRating.moderation.reason, "insults");
  assert.equal(R.moderate(o.customerRating, { decision: "reject", by: "a1", reason: "again" }).code, "NO_CHANGE");
  assert.equal(R.moderate(o.customerRating, { decision: "publish", by: "a2" }).ok, true, "a supervisor can reverse a decision");
  assert.equal(o.customerRating.moderation.history.length, 2);
  const noText = delivered({ id: "x" }); R.applyStoreRating(noText, { stars: 3, comment: "" });
  assert.equal(R.moderate(noText.customerRating, { decision: "publish", by: "a" }).code, "NO_COMMENT");
});

test("legacy records (comment but no status) are NOT public until reviewed", () => {
  const legacy = { stars: 5, comment: "old unmoderated text" };
  assert.equal(R.commentStatusOf(legacy), "pending");
  const orders = [delivered({ customerRating: legacy })];
  assert.equal(R.publishedStoreReviews(orders, "s1").length, 0);
  assert.equal(R.moderationQueue(orders, { status: "pending" }).length, 1);
  assert.equal(R.storeAverage(orders, "s1").count, 1, "stars still count");
});

test("public reviews: only published comments, masked customer name, per store", () => {
  const a = delivered({ id: "a" }); R.applyStoreRating(a, { stars: 5, comment: "great" }); R.moderate(a.customerRating, { decision: "publish", by: "x" });
  const b = delivered({ id: "b" }); R.applyStoreRating(b, { stars: 1, comment: "rude" });
  const c = delivered({ id: "c", restaurantId: "s2" }); R.applyStoreRating(c, { stars: 4, comment: "ok" }); R.moderate(c.customerRating, { decision: "publish", by: "x" });
  const list = R.publishedStoreReviews([a, b, c], "s1");
  assert.equal(list.length, 1);
  assert.equal(list[0].comment, "great");
  assert.equal(list[0].name, "Ali B.");
  assert.ok(!("customerId" in list[0]) && !("orderId" in list[0]));
});

test("averages are computed from real ratings, per store and per driver", () => {
  const mk = (id, stars, store = "s1", drv = "d1") => delivered({ id, restaurantId: store, driverId: drv, customerRating: { stars }, driverRating: { stars: 6 - stars, driverId: drv } });
  const orders = [mk("1", 5), mk("2", 4), mk("3", 1), mk("4", 5, "s2", "d2"), { id: "5", restaurantId: "s1" }];
  const s1 = R.storeAverage(orders, "s1");
  assert.deepEqual([s1.count, s1.avg], [3, 3.3]);
  assert.equal(s1.dist[5], 1);
  assert.deepEqual([R.storeAverage(orders, "s2").count, R.storeAverage(orders, "nope").count], [1, 0]);
  const d1 = R.driverAverage(orders, "d1");
  assert.deepEqual([d1.count, d1.avg], [3, 2.7]);
});

test("moderation queue lists store + driver comments and filters", () => {
  const o = delivered({ id: "q1" });
  R.applyStoreRating(o, { stars: 3, comment: "store text" });
  o.driverRating = { stars: 2, comment: "driver text", driverId: "d1", polite: false, askedExtraMoney: true, commentStatus: R.initialCommentStatus("driver text") };
  const all = R.moderationQueue([o]);
  assert.equal(all.length, 2);
  assert.equal(R.moderationQueue([o], { kind: "driver" })[0].flags.askedExtraMoney, true);
  assert.equal(R.moderationQueue([o], { status: "published" }).length, 0);
  assert.deepEqual(R.queueCounts([o]), { pending: 2, published: 0, rejected: 0 });
});

test("driver app sees a written comment only after it is published", () => {
  const o = delivered({ id: "r1", driverRating: { stars: 5, comment: "thanks", driverId: "d1", createdAt: "2026-10-27T10:00:00Z", commentStatus: "pending" } });
  assert.equal(fb.reviewsFor([o], "d1")[0].comment, "");
  assert.equal(fb.reviewsFor([o], "d1")[0].stars, 5);
  R.moderate(o.driverRating, { decision: "publish", by: "a" });
  assert.equal(fb.reviewsFor([o], "d1")[0].comment, "thanks");
});

test("customer flags: can rate, own rating with moderation state", () => {
  const o = delivered();
  assert.equal(R.customerFlags(o, NOW).canRateStore, true);
  R.applyStoreRating(o, { stars: 5, comment: "x" });
  const f = R.customerFlags(o, NOW);
  assert.deepEqual([f.storeRating.stars, f.storeRating.commentStatus], [5, "pending"]);
});

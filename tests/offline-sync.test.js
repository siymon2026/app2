"use strict";
const test = require("node:test");
const assert = require("node:assert");
const SQ = require("../public/shared/sync-queue.js");
const off = require("../lib/offline-sync");
const core = require("../lib/dispatch-core");

function mem() { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; }, _m: m }; }
function mk(send, extra) {
  let t = 1_000_000;
  const storage = mem();
  const q = SQ.create({ storage, send, now: () => t, ...(extra || {}) });
  return { q, storage, tick: (ms) => { t += ms; }, now: () => t };
}

/* ---------- what may be queued at all ---------- */
test("only chat text and 'start delivery' can be queued; verified/financial steps are refused", () => {
  const { q } = mk(async () => ({ ok: true }));
  assert.ok(q.enqueue("chat_text", "o1", { text: "hi" }).ok);
  assert.ok(q.enqueue("order_on_the_way", "o1", {}).ok);
  for (const k of ["accept", "picked_up", "delivered", "cancel", "payment", "wallet", "location", "verify_code", "whatever"]) {
    const r = q.enqueue(k, "o1", { code: "123456" });
    assert.strictEqual(r.ok, false, k);
    assert.strictEqual(r.error, "not_queueable");
  }
  assert.strictEqual(q.list().length, 2);
});

test("queue is capped (no unbounded growth)", () => {
  const { q } = mk(async () => ({ ok: true }), { maxEntries: 3 });
  for (let i = 0; i < 3; i++) assert.ok(q.enqueue("chat_text", "o", { text: "x" + i }).ok);
  assert.strictEqual(q.enqueue("chat_text", "o", { text: "x" }).error, "queue_full");
});

/* ---------- ordering / retries / duplicates ---------- */
test("flush sends in FIFO order with a distinct idempotency key per entry, then empties the queue", async () => {
  const seen = [];
  const { q } = mk(async (e) => { seen.push([e.payload.text, e.key]); return { ok: true }; });
  q.enqueue("chat_text", "o1", { text: "a" });
  q.enqueue("chat_text", "o1", { text: "b" });
  q.enqueue("chat_text", "o1", { text: "c" });
  const r = await q.flush();
  assert.deepStrictEqual(seen.map((x) => x[0]), ["a", "b", "c"]);
  assert.strictEqual(new Set(seen.map((x) => x[1])).size, 3);
  assert.strictEqual(r.sent, 3);
  assert.strictEqual(q.list().length, 0);
  assert.ok(q.lastSyncAt() > 0);
});

test("network failure keeps entries PENDING, stops the pass, and a later pass re-sends with the SAME key", async () => {
  const keys = []; let online = false;
  const { q } = mk(async (e) => { keys.push(e.key); return online ? { ok: true } : { ok: false, status: 0, error: "net" }; });
  q.enqueue("chat_text", "o1", { text: "a" });
  q.enqueue("chat_text", "o1", { text: "b" });
  const r1 = await q.flush();
  assert.strictEqual(r1.stoppedOffline, true);
  assert.strictEqual(keys.length, 1, "must stop at the first unreachable result, not hammer the rest");
  assert.deepStrictEqual(q.list().map((e) => e.state), ["pending", "pending"]);
  assert.strictEqual(q.lastSyncAt(), 0, "no sync time is claimed when nothing was confirmed");
  online = true;
  await q.flush();
  assert.strictEqual(keys[0], keys[1], "retry must reuse the idempotency key (server de-duplicates)");
  assert.strictEqual(q.list().length, 0);
});

test("5xx / 429 are retryable, other 4xx are permanent failures with the server's reason", async () => {
  assert.ok(SQ.isRetryable(503) && SQ.isRetryable(429) && SQ.isRetryable(0));
  assert.ok(!SQ.isRetryable(409) && !SQ.isRetryable(403) && !SQ.isRetryable(400));
  const { q } = mk(async () => ({ ok: false, status: 409, error: "Illegal", code: "ILLEGAL_TRANSITION" }));
  q.enqueue("order_on_the_way", "o1", {});
  await q.flush();
  const e = q.list()[0];
  assert.strictEqual(e.state, "failed");
  assert.strictEqual(e.error, "ILLEGAL_TRANSITION");
});

test("a failed entry blocks LATER entries of the same order (ordering) but not other orders", async () => {
  const sent = [];
  const { q } = mk(async (e) => {
    sent.push(e.payload.text || e.kind);
    return e.payload.text === "bad" ? { ok: false, status: 409, error: "x" } : { ok: true };
  });
  q.enqueue("chat_text", "A", { text: "bad" });
  q.enqueue("chat_text", "A", { text: "after-bad" });
  q.enqueue("chat_text", "B", { text: "other-order" });
  await q.flush();
  assert.deepStrictEqual(sent, ["bad", "other-order"]);
  assert.deepStrictEqual(q.list().map((e) => e.state).sort(), ["failed", "pending"]);
});

test("retry() revives a failed entry; discard() removes it; expired entries are not revived", async () => {
  let ok = false;
  const { q, tick } = mk(async () => (ok ? { ok: true } : { ok: false, status: 400, error: "no" }), { maxAgeMs: 1000 });
  q.enqueue("chat_text", "A", { text: "m" });
  await q.flush();
  const id = q.list()[0].id;
  assert.strictEqual(q.list()[0].state, "failed");
  ok = true;
  assert.ok(q.retry(id));
  await q.flush();
  assert.strictEqual(q.list().length, 0);

  q.enqueue("chat_text", "A", { text: "old" });
  tick(5000);
  await q.flush();
  const old = q.list()[0];
  assert.strictEqual(old.state, "expired", "an old queued update must not be sent automatically");
  assert.strictEqual(q.retry(old.id), false, "expired updates are never silently revived");
  assert.ok(q.discard(old.id));
  assert.strictEqual(q.list().length, 0);
});

test("single flight: two concurrent flushes never send an entry twice", async () => {
  let calls = 0;
  const { q } = mk(async () => { calls++; await new Promise((r) => setTimeout(r, 15)); return { ok: true }; });
  q.enqueue("chat_text", "A", { text: "m" });
  await Promise.all([q.flush(), q.flush(), q.flush()]);
  assert.strictEqual(calls, 1);
});

test("queue survives a reload; an entry caught 'sending' becomes pending again", async () => {
  const storage = mem();
  const q1 = SQ.create({ storage, send: async () => ({ ok: true }) });
  q1.enqueue("chat_text", "A", { text: "keep" });
  const raw = JSON.parse(storage.getItem("siymon_sync_queue_v1"));
  raw.entries[0].state = "sending";
  storage.setItem("siymon_sync_queue_v1", JSON.stringify(raw));
  const q2 = SQ.create({ storage, send: async () => ({ ok: true }) });
  assert.strictEqual(q2.list()[0].state, "pending");
  assert.strictEqual(q2.list()[0].key, q1.list()[0].key);
});

test("a thrown error in send() is treated as 'unreachable', never as success", async () => {
  const { q } = mk(async () => { throw new Error("boom"); });
  q.enqueue("chat_text", "A", { text: "m" });
  const r = await q.flush();
  assert.strictEqual(r.sent, 0);
  assert.strictEqual(q.list()[0].state, "pending");
});

/* ---------- server-side rules for replayed updates ---------- */
test("server refuses verified steps and codes coming from the queue", () => {
  const now = Date.now();
  for (const st of ["picked_up", "delivered"]) {
    const r = off.checkQueuedStatusUpdate({ status: st, queued: true, queuedAt: now - 1000 }, now);
    assert.strictEqual(r.ok, false); assert.strictEqual(r.code, "NOT_QUEUEABLE");
  }
  const withCode = off.checkQueuedStatusUpdate({ status: "on_the_way", queued: true, queuedAt: now, code: "123456" }, now);
  assert.strictEqual(withCode.code, "NOT_QUEUEABLE");
  assert.strictEqual(off.checkQueuedStatusUpdate({ status: "canceled", queued: true, queuedAt: now }, now).code, "NOT_QUEUEABLE");
});

test("server accepts a fresh queued 'on_the_way', refuses stale/invalid ones, ignores non-queued requests", () => {
  const now = Date.now();
  assert.deepStrictEqual(off.checkQueuedStatusUpdate({ status: "delivered", code: "1" }, now), { ok: true, queued: false });
  assert.deepStrictEqual(off.checkQueuedStatusUpdate({ status: "on_the_way", queued: true, queuedAt: now - 60_000, sentAt: now }, now), { ok: true, queued: true });
  const old = off.checkQueuedStatusUpdate({ status: "on_the_way", queued: true, queuedAt: now - 31 * 60_000, sentAt: now }, now);
  assert.strictEqual(old.code, "QUEUED_UPDATE_EXPIRED"); assert.strictEqual(old.status, 409);
  assert.strictEqual(off.checkQueuedStatusUpdate({ status: "on_the_way", queued: true }, now).code, "QUEUED_AT_REQUIRED");
  assert.strictEqual(off.checkQueuedStatusUpdate({ status: "on_the_way", queued: true, queuedAt: now + 10 * 60_000, sentAt: now }, now).code, "QUEUED_AT_INVALID");
});

test("chat replay is de-duplicated by idempotency key; invalid keys are ignored", () => {
  const msgs = [{ id: "1", text: "a", clientId: "abcdefgh12" }, { id: "2", text: "b" }];
  assert.strictEqual(off.findDuplicateMessage(msgs, "abcdefgh12").id, "1");
  assert.strictEqual(off.findDuplicateMessage(msgs, "zzzzzzzz99"), null);
  assert.strictEqual(off.findDuplicateMessage(msgs, "short"), null);
  assert.strictEqual(off.findDuplicateMessage(msgs, "bad key!!!!!"), null);
  assert.strictEqual(off.cleanKey("c1abc_DEF-12345"), "c1abc_DEF-12345");
});

test("repeat accept by the owner after accept is a no-op; first accept of an assigned order is not", () => {
  assert.ok(off.isRepeatAccept({ driverId: "d1", status: "accepted" }, "d1"));
  assert.ok(off.isRepeatAccept({ driverId: "d1", status: "picked_up" }, "d1"));
  assert.ok(off.isRepeatAccept({ driverId: "d1", status: "delivered" }, "d1"));
  assert.ok(!off.isRepeatAccept({ driverId: "d1", status: "restaurant_ready" }, "d1"));
  assert.ok(!off.isRepeatAccept({ driverId: "d2", status: "accepted" }, "d1"));
  assert.ok(!off.isRepeatAccept({ status: "restaurant_ready" }, "d1"));
});

/* ---------- stale coordinates must never look current ---------- */
const NOW = 5_000_000;
test("fix without ageMs behaves as before (stamped at receipt)", () => {
  const r = core.validateFix({ lat: 33.26, lng: -7.58 }, null, NOW);
  assert.ok(r.ok); assert.strictEqual(r.fix.at, NOW);
});

test("a reading that is 90 s old is back-dated, becomes 'stale', and is NOT dispatchable", () => {
  const r = core.validateFix({ lat: 33.26, lng: -7.58, accuracy: 10, ageMs: 90_000 }, null, NOW);
  assert.ok(r.ok);
  assert.strictEqual(r.fix.at, NOW - 90_000);
  assert.strictEqual(core.freshness(r.fix, NOW), "stale");
  assert.strictEqual(core.isDispatchable({ status: "approved", dispatchState: "available", location: r.fix }, NOW), false);
});

test("a 10 s old reading is still live; > staleMax or invalid age is refused", () => {
  const ok = core.validateFix({ lat: 33.26, lng: -7.58, accuracy: 10, ageMs: 10_000 }, null, NOW);
  assert.strictEqual(core.freshness(ok.fix, NOW), "live");
  assert.strictEqual(core.validateFix({ lat: 33.26, lng: -7.58, ageMs: 200_000 }, null, NOW).error, "stale_fix");
  assert.strictEqual(core.validateFix({ lat: 33.26, lng: -7.58, ageMs: -5 }, null, NOW).error, "invalid_age");
  assert.strictEqual(core.validateFix({ lat: 33.26, lng: -7.58, ageMs: "abc" }, null, NOW).error, "invalid_age");
});

test("an older reading never overwrites a newer stored one (out-of-order after reconnect)", () => {
  const first = core.validateFix({ lat: 33.26, lng: -7.58 }, null, NOW);
  const late = core.validateFix({ lat: 33.2601, lng: -7.5801, ageMs: 60_000 }, first.fix, NOW + 1000);
  assert.strictEqual(late.ok, false);
  assert.strictEqual(late.error, "out_of_order");
});

test("REGRESSION: flushing an empty queue must not leave the lock stuck (later entries still sync)", async () => {
  let calls = 0;
  const { q } = mk(async () => { calls++; return { ok: true }; });
  await q.flush();
  await q.flush();
  q.enqueue("chat_text", "A", { text: "m" });
  const r = await q.flush();
  assert.strictEqual(r.sent, 1);
  assert.strictEqual(calls, 1);
});

test("enqueue reuses the idempotency key of an attempt that got no answer (and ignores malformed keys)", () => {
  const { q } = mk(async () => ({ ok: true }));
  assert.strictEqual(q.enqueue("chat_text", "A", { text: "x" }, "cabc123456789").entry.key, "cabc123456789");
  assert.notStrictEqual(q.enqueue("chat_text", "A", { text: "y" }, "bad key").entry.key, "bad key");
});

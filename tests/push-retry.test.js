"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const p = require("../lib/push-retry");

test("classify errors", () => {
  assert.equal(p.classify({ statusCode: 410 }), "gone");
  assert.equal(p.classify({ statusCode: 404 }), "gone");
  assert.equal(p.classify({ statusCode: 403 }), "permanent");
  assert.equal(p.classify({ statusCode: 413 }), "permanent");
  assert.equal(p.classify({ statusCode: 429 }), "retry");
  assert.equal(p.classify({ statusCode: 503 }), "retry");
  assert.equal(p.classify({ code: "ECONNRESET" }), "retry");
  assert.equal(p.classify(null), "retry");
});

test("enqueue is idempotent and schedules the first retry", () => {
  const t = 1000;
  let q = p.enqueue([], { recId: "n1", endpoint: "e1", customerId: "c", payload: "{}", now: t });
  q = p.enqueue(q, { recId: "n1", endpoint: "e1", customerId: "c", payload: "{}", now: t + 5 });
  assert.equal(q.length, 1);
  assert.equal(q[0].nextAt, t + 60e3);
  q = p.enqueue(q, { recId: "n1", endpoint: "e2", customerId: "c", payload: "{}", now: t });
  assert.equal(q.length, 2);
});

test("due splits ready / not yet / expired", () => {
  const t = 0;
  let q = p.enqueue([], { recId: "a", endpoint: "e", payload: "{}", now: t });
  assert.equal(p.due(q, t + 1000).ready.length, 0);
  assert.equal(p.due(q, t + 61e3).ready.length, 1);
  assert.equal(p.due(q, t + p.MAX_AGE_MS + 1).expired.length, 1);
  assert.equal(p.due(q, t + p.MAX_AGE_MS + 1).ready.length, 0);
});

test("settle: sent/gone/permanent remove; retry backs off and stops after max attempts", () => {
  const t = 0;
  let q = p.enqueue([], { recId: "a", endpoint: "e", payload: "{}", now: t });
  for (const o of ["sent", "gone", "permanent"]) assert.equal(p.settle(q, q[0], o).length, 0, o);
  const seen = [];
  let now = t;
  while (q.length) {
    const it = q[0];
    seen.push(it.attempt);
    now = it.nextAt;
    q = p.settle(q, it, "retry", now);
  }
  assert.deepEqual(seen, [1, 2, 3, 4]);
  assert.equal(p.MAX_ATTEMPTS, 5);
});

test("queue is bounded", () => {
  let q = [];
  for (let i = 0; i < p.MAX_QUEUE + 20; i++) q = p.enqueue(q, { recId: "r" + i, endpoint: "e", payload: "{}", now: 0 });
  assert.equal(q.length, p.MAX_QUEUE);
});

"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { create } = require("../public/admin/admin-refresh.js");

// deterministic fake clock/timers
function fake() {
  let t = 0, id = 0; const timers = new Map();
  return {
    now: () => t,
    setTimer: (fn, ms) => { id++; timers.set(id, { fn, at: t + ms }); return id; },
    clearTimer: (i) => timers.delete(i),
    async advance(ms) {
      const end = t + ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, v]) => v.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        t = due[1].at; timers.delete(due[0]); due[1].fn();
        for (let i = 0; i < 10; i++) await Promise.resolve();
      }
      t = end;
    },
    skip(ms) { t += ms; },            // wall clock moves but timers do not fire (frozen tab / sleeping phone)
    pending: () => timers.size,
  };
}

test("loop keeps running after a tick throws (backs off, never dies)", async () => {
  const f = fake(); let calls = 0;
  const r = create({ intervalMs: 1000, ...f, tick: async () => { calls++; if (calls <= 2) throw new Error("boom"); } });
  r.start();
  await f.advance(1000); assert.equal(calls, 1);
  await f.advance(2000); assert.equal(calls, 2);     // backoff x2
  await f.advance(4000); assert.equal(calls, 3);     // recovered
  await f.advance(1000); assert.equal(calls, 4);     // back to normal interval
  assert.equal(r.state().failures, 0);
  assert.ok(r.state().hasTimer);
});

test("a hanging first tick does not stop later ticks being scheduled once it settles", async () => {
  const f = fake(); let calls = 0, release;
  const r = create({ intervalMs: 1000, ...f, tick: () => { calls++; return calls === 1 ? new Promise((ok) => { release = ok; }) : Promise.resolve(); } });
  r.start();
  await f.advance(1000); assert.equal(calls, 1);
  await f.advance(5000); assert.equal(calls, 1, "no overlapping tick while one is in flight");
  release(); for (let i = 0; i < 10; i++) await Promise.resolve();
  await f.advance(1000); assert.equal(calls, 2);
});

test("ticks never overlap", async () => {
  const f = fake(); let active = 0, max = 0;
  const r = create({ intervalMs: 100, ...f, tick: async () => { active++; max = Math.max(max, active); await Promise.resolve(); await Promise.resolve(); active--; } });
  r.start();
  await f.advance(2000);
  r.refreshNow(); r.refreshNow(); r.resume();
  await f.advance(500);
  assert.equal(max, 1);
});

test("manual refresh runs immediately, is flagged manual+full, and the loop continues afterwards", async () => {
  const f = fake(); const seen = [];
  const r = create({ intervalMs: 1000, ...f, tick: async (i) => { seen.push(i); } });
  r.start();
  await r.refreshNow();
  assert.deepEqual(seen[0], { manual: true, full: true });
  await f.advance(1000);
  assert.equal(seen.length, 2);
  assert.deepEqual(seen[1], { manual: false, full: false });
});

test("manual refresh during an in-flight tick is replayed, not lost", async () => {
  const f = fake(); const seen = []; let release;
  const r = create({ intervalMs: 1000, ...f, tick: (i) => { seen.push(i); return seen.length === 1 ? new Promise((ok) => { release = ok; }) : Promise.resolve(); } });
  r.start();
  await f.advance(1000);                       // tick 1 in flight
  const p = r.refreshNow();
  release();
  await p;
  assert.equal(seen.length, 2);
  assert.equal(seen[1].manual, true);
});

test("resume: refreshes at once when stale, does nothing when fresh, repairs a lost timer", async () => {
  const f = fake(); let calls = 0;
  const r = create({ intervalMs: 1000, ...f, tick: async () => { calls++; } });
  r.start();
  await f.advance(1000); assert.equal(calls, 1);
  await r.resume(); assert.equal(calls, 1, "fresh -> no extra request");
  const frozen = fake(); let c2 = 0;
  const r2 = create({ intervalMs: 1000, ...frozen, tick: async () => { c2++; } });
  r2.start();
  await frozen.advance(999);                   // timer about to fire but tab gets frozen...
  await frozen.advance(1);                     // (fires) -> c2 = 1
  assert.equal(c2, 1);
  r2.stop(); r2.start();                       // restart arms a fresh loop
  assert.equal(r2.state().hasTimer, true);
  const dead = fake(); let c3 = 0;
  const r3 = create({ intervalMs: 1000, ...dead, tick: async () => { c3++; } });
  r3.start();
  dead.skip(60000);                            // phone slept for a minute: timer never fired
  await r3.resume({ full: true });
  assert.equal(c3, 1);
  assert.ok(r3.state().hasTimer, "loop re-armed after resume");
});

test("stop() really stops, and an in-flight tick does not re-arm a stopped loop", async () => {
  const f = fake(); let calls = 0, release;
  const r = create({ intervalMs: 1000, ...f, tick: () => { calls++; return new Promise((ok) => { release = ok; }); } });
  r.start();
  await f.advance(1000);
  r.stop();
  release(); for (let i = 0; i < 10; i++) await Promise.resolve();
  assert.equal(r.state().hasTimer, false);
  await f.advance(10000); assert.equal(calls, 1);
});

test("restart (e.g. after re-login) replaces the old loop instead of doubling it", async () => {
  const f = fake(); let calls = 0;
  const r = create({ intervalMs: 1000, ...f, tick: async () => { calls++; } });
  r.start(); r.start(); r.start();
  await f.advance(1000);
  assert.equal(calls, 1);
  assert.equal(f.pending(), 1);
});

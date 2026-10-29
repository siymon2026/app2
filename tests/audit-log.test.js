"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createAuditLog, sanitize, GENESIS } = require("../lib/audit-log");

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "audit-"));
const mk = (extra = {}) => { const dir = tmp(); return { dir, log: createAuditLog({ dir, ...extra }) }; };
const seg = (dir) => path.join(dir, fs.readdirSync(dir).filter((f) => /^audit-\d+\.jsonl$/.test(f)).sort()[0]);

test("append builds a hash chain and verify() passes", () => {
  const { log } = mk();
  const a = log.append({ action: "x.one", actorId: "1" });
  const b = log.append({ action: "x.two", actorId: "2" });
  assert.equal(a.seq, 1); assert.equal(a.prev, GENESIS);
  assert.equal(b.seq, 2); assert.equal(b.prev, a.hash);
  const v = log.verify();
  assert.equal(v.ok, true); assert.equal(v.count, 2);
});

test("secrets are redacted BEFORE they are written to disk; account numbers are masked", () => {
  const { dir, log } = mk();
  log.append({ action: "t", password: "hunter2", token: "abc", otp: "123456", nested: { authorization: "Bearer zzz", code: "9999" }, bankAccount: "MA64 0011 2233 4455", bankAccountName: "Siymon SARL" });
  const raw = fs.readFileSync(seg(dir), "utf-8");
  for (const secret of ["hunter2", "abc\"", "123456", "Bearer zzz", "9999", "MA64 0011"]) assert.ok(!raw.includes(secret), "leaked: " + secret);
  assert.ok(raw.includes("****4455"));
  assert.ok(raw.includes("Siymon SARL")); // an account NAME is not a secret
});

test("editing a record is detected (record_modified)", () => {
  const { dir, log } = mk();
  log.append({ action: "a", value: 1 }); log.append({ action: "b", value: 2 }); log.append({ action: "c", value: 3 });
  const f = seg(dir);
  fs.writeFileSync(f, fs.readFileSync(f, "utf-8").replace('"value":2', '"value":200'));
  const v = log.verify();
  assert.equal(v.ok, false); assert.equal(v.reason, "record_modified"); assert.equal(v.brokenAt, 2);
});

test("deleting a record in the middle is detected", () => {
  const { dir, log } = mk();
  ["a", "b", "c"].forEach((x) => log.append({ action: x }));
  const f = seg(dir);
  const lines = fs.readFileSync(f, "utf-8").trim().split("\n");
  fs.writeFileSync(f, [lines[0], lines[2]].join("\n") + "\n");
  const v = log.verify();
  assert.equal(v.ok, false); assert.equal(v.reason, "missing_records");
});

test("truncating the tail is detected through HEAD.json", () => {
  const { dir, log } = mk();
  ["a", "b", "c"].forEach((x) => log.append({ action: x }));
  const f = seg(dir);
  const lines = fs.readFileSync(f, "utf-8").trim().split("\n");
  fs.writeFileSync(f, lines.slice(0, 2).join("\n") + "\n");
  const v = log.verify();
  assert.equal(v.ok, false); assert.equal(v.reason, "tail_truncated");
});

test("a keyed chain (HMAC) cannot be re-forged by someone who recomputes plain SHA-256", () => {
  const dir = tmp();
  const log = createAuditLog({ dir, hmacKey: "k-secret" });
  log.append({ action: "a", value: 1 }); log.append({ action: "b", value: 2 });
  const f = seg(dir);
  const crypto = require("crypto");
  const { canonical } = require("../lib/audit-log");
  // attacker rewrites record 1 and recomputes the chain with plain sha256
  const lines = fs.readFileSync(f, "utf-8").trim().split("\n").map((l) => JSON.parse(l));
  let prev = GENESIS;
  for (const r of lines) { if (r.seq === 1) r.value = 99; r.prev = prev; const { hash, ...b } = r; r.hash = crypto.createHash("sha256").update(prev + "\n" + canonical(b)).digest("hex"); prev = r.hash; }
  fs.writeFileSync(f, lines.map((r) => JSON.stringify(r)).join("\n") + "\n");
  assert.equal(createAuditLog({ dir, hmacKey: "k-secret" }).verify().ok, false);
});

test("the store has no update/delete API and rotation never removes records", () => {
  const { dir, log } = mk({ segmentMaxBytes: 600 });
  assert.equal(log.update, undefined); assert.equal(log.delete, undefined); assert.equal(log.remove, undefined); assert.equal(log.clear, undefined);
  for (let i = 0; i < 40; i++) log.append({ action: "bulk", i, pad: "x".repeat(60) });
  const segs = fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
  assert.ok(segs.length > 1, "should have rotated");
  assert.equal(log.query({ limit: 500 }).total, 40);
  assert.equal(log.verify().ok, true); assert.equal(log.verify().count, 40);
});

test("a new instance resumes the chain where the previous one stopped (restart safe)", () => {
  const { dir, log } = mk();
  log.append({ action: "a" }); log.append({ action: "b" });
  const log2 = createAuditLog({ dir });
  const c = log2.append({ action: "c" });
  assert.equal(c.seq, 3);
  assert.equal(log2.verify().ok, true);
});

test("query: filters, prefix match, newest first, pagination", () => {
  const { log } = mk({ now: (() => { let t = Date.parse("2026-10-01T00:00:00Z"); return () => new Date((t += 60000)); })() });
  log.append({ action: "settings.update", actorId: "1", result: "ok", group: "dispatch" });
  log.append({ action: "settings.update", actorId: "2", result: "denied" });
  log.append({ action: "orders.cancel", actorId: "1", result: "ok" });
  assert.equal(log.query({ action: "settings.*" }).total, 2);
  assert.equal(log.query({ actorId: "1" }).total, 2);
  assert.equal(log.query({ result: "denied" }).logs[0].actorId, "2");
  assert.equal(log.query({}).logs[0].action, "orders.cancel"); // newest first
  assert.equal(log.query({ limit: 1, offset: 1 }).logs[0].actorId, "2");
  assert.equal(log.query({ from: "2026-10-01T00:02:30Z" }).total, 1);
  assert.equal(log.query({ q: "dispatch" }).total, 1);
});

test("legacy audit_logs.json is imported once, never modified, with a verified backup", () => {
  const { dir, log } = mk();
  const legacy = path.join(tmp(), "audit_logs.json");
  const body = JSON.stringify({ logs: [{ id: "n", at: "2026-10-02T00:00:00Z", action: "new", token: "SECRET" }, { id: "o", at: "2026-10-01T00:00:00Z", action: "old" }] });
  fs.writeFileSync(legacy, body);
  const r = log.migrateLegacy(legacy);
  assert.equal(r.ok, true); assert.equal(r.imported, 2);
  assert.equal(fs.readFileSync(legacy, "utf-8"), body); // untouched
  assert.ok(fs.readdirSync(dir).some((f) => f.endsWith(".json.bak")));
  const all = log.query({ limit: 10 }).logs;
  assert.equal(all[all.length - 1].action, "old"); // oldest first in the chain
  assert.equal(all[0].legacy, true);
  assert.ok(!fs.readFileSync(seg(dir), "utf-8").includes("SECRET")); // legacy secrets are redacted on import
  assert.equal(log.verify().ok, true);
  assert.equal(log.migrateLegacy(legacy).skipped, "already_migrated");
  assert.equal(log.query({ limit: 10 }).total, 2); // no duplicates
});

test("append never throws even when the disk is unavailable", () => {
  const dir = tmp();
  const errors = [];
  const log = createAuditLog({ dir, logger: { error: (m) => errors.push(m) } });
  log.append({ action: "ok" });
  fs.rmSync(dir, { recursive: true, force: true });
  fs.writeFileSync(dir, "i am a file now"); // directory replaced by a file
  assert.equal(log.append({ action: "will fail" }), null);
  assert.ok(errors.length >= 1);
});

test("sanitize bounds depth/size and ignores prototype keys", () => {
  const deep = { a: { b: { c: { d: { e: { f: { g: 1 } } } } } } };
  assert.ok(JSON.stringify(sanitize(deep)).includes("[truncated]"));
  assert.equal(sanitize({ s: "y".repeat(2000) }).s.length, 501);
  const evil = JSON.parse('{"__proto__":{"polluted":true},"ok":1}');
  assert.equal(sanitize(evil).polluted, undefined); assert.equal({}.polluted, undefined);
});

"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");
const { createAuditLog } = require("../lib/audit-log");
const DP = require("../lib/data-protection");

const KEY = "k".repeat(24) + "Z-test-backup-key-0123456789";
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "dp-"));
const posix = process.platform !== "win32";
const mode = (p) => fs.statSync(p).mode & 0o777;
const DOC = crypto.randomBytes(150 * 1024); // "identity document": more than two read chunks

function world(extra = {}) {
  const root = tmp();
  const dataDir = path.join(root, "data");
  fs.mkdirSync(path.join(dataDir, "private_uploads", "drivers_id"), { recursive: true });
  const w = (f, v) => fs.writeFileSync(path.join(dataDir, f), typeof v === "string" ? v : JSON.stringify(v, null, 2));
  w("orders.json", { orders: [{ id: "o1", total: 50 }, { id: "o2", total: 70 }] });
  w("topups.json", { topups: [{ id: "t1" }] });
  w("settlements.json", { settlements: [] });
  w("customers.json", { customers: [{ id: "c1", walletHistory: [{ ref: "a" }, { ref: "b" }] }], deletedCustomers: [] });
  w("drivers.json", { drivers: [{ id: "d1", walletHistory: [{ ref: "x" }] }] });
  w("admins.json", { admins: [{ id: "a1", password: "HASHED" }] });
  fs.writeFileSync(path.join(dataDir, "private_uploads", "drivers_id", "id1.jpg"), DOC);
  const audit = createAuditLog({ dir: path.join(dataDir, "audit") });
  audit.append({ action: "x.one" }); audit.append({ action: "x.two" }); audit.append({ action: "x.three" });
  fs.writeFileSync(path.join(root, "config.json"), JSON.stringify({ currency: "MAD" }));
  const uploads = path.join(root, "uploads");
  fs.mkdirSync(path.join(uploads, "menu"), { recursive: true });
  fs.writeFileSync(path.join(uploads, "menu", "a.jpg"), Buffer.from("jpgdata"));
  const dp = DP.createDataProtection({ rootDir: root, dataDir, configFile: path.join(root, "config.json"), uploadsDir: uploads, backupDir: path.join(root, "backups"), env: {}, encryptionKey: KEY, requireEncryption: true, databaseUrl: "", ...extra });
  return { root, dataDir, uploads, dp, audit, backupDir: path.join(root, "backups") };
}
const read = (p) => fs.readFileSync(p);
function treeHashes(dir) {
  const out = {};
  const rec = (d, rel) => { for (const n of fs.readdirSync(d, { withFileTypes: true })) { const a = path.join(d, n.name), r = rel ? rel + "/" + n.name : n.name; if (n.isDirectory()) rec(a, r); else out[r] = sha(read(a)); } };
  rec(dir, "");
  return out;
}

/** Builds an archive by hand, so hostile contents can be tested. */
function craft(backupDir, id, entries) {
  const u16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16BE(n); return b; };
  const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; };
  const frames = [], files = [];
  for (const [rel, content] of entries) {
    const pb = Buffer.from(rel), c = Buffer.from(content);
    frames.push(Buffer.concat([Buffer.from([1]), u16(pb.length), pb, u32(0o600)]));
    if (c.length) frames.push(Buffer.concat([u32(c.length), c]));
    frames.push(u32(0));
    files.push({ path: rel, size: c.length, sha256: sha(c), mode: 0o600 });
  }
  const mb = Buffer.from(JSON.stringify({ format: 1, id, createdAt: new Date().toISOString(), files, totals: { files: files.length, bytes: 0 }, database: { included: false } }));
  frames.push(Buffer.concat([Buffer.from([0xff]), u32(mb.length), mb]));
  const archive = Buffer.concat([Buffer.from("SIYBKP1\n"), zlib.gzipSync(Buffer.concat(frames))]);
  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(path.join(backupDir, id + ".siybk"), archive);
  fs.writeFileSync(path.join(backupDir, id + ".meta.json"), JSON.stringify({ id, createdAt: new Date().toISOString(), bytes: archive.length, sha256: sha(archive), encrypted: false, files: files.length, database: { included: false } }));
}

test("backup: verified, encrypted, private; no secret or plaintext on disk", async () => {
  const { dp, backupDir } = world();
  const r = await dp.createBackup({ reason: "unit test", actor: { id: "adm-1", role: "system_admin", ip: "10.0.0.1" } });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.encrypted, true);
  assert.ok(r.files >= 10, "data, audit, private document, config and uploads are all included");
  assert.ok(r.verifiedAt);
  const archive = read(path.join(backupDir, r.id + ".siybk"));
  assert.ok(!archive.includes(Buffer.from("orders")), "archive must not contain readable data");
  assert.ok(!archive.includes(DOC.subarray(0, 64)), "private document must not be readable inside the archive");
  for (const f of fs.readdirSync(backupDir)) assert.ok(!read(path.join(backupDir, f)).includes(Buffer.from(KEY)), "key leaked into " + f);
  if (posix) {
    assert.equal(mode(backupDir), 0o700);
    assert.equal(mode(path.join(backupDir, r.id + ".siybk")), 0o600);
    assert.equal(mode(path.join(backupDir, r.id + ".meta.json")), 0o600);
  }
  const list = dp.listBackups();
  assert.equal(list.length, 1); assert.equal(list[0].verified.ok, true); assert.equal(list[0].encrypted, true);
  assert.equal((await dp.verifyBackup(r.id)).ok, true);
});

test("backup: wrong key, missing key and tampering are detected", async () => {
  const w = world();
  const r = await w.dp.createBackup({ reason: "t" });
  const wrong = DP.createDataProtection({ ...{ rootDir: w.root, dataDir: w.dataDir, configFile: path.join(w.root, "config.json"), backupDir: w.backupDir, env: {} }, encryptionKey: "x".repeat(40) });
  assert.equal((await wrong.verifyBackup(r.id)).code, "KEY_MISMATCH");
  const nokey = DP.createDataProtection({ rootDir: w.root, dataDir: w.dataDir, configFile: path.join(w.root, "config.json"), backupDir: w.backupDir, env: {}, encryptionKey: "" });
  assert.equal((await nokey.verifyBackup(r.id)).code, "KEY_REQUIRED");

  const file = path.join(w.backupDir, r.id + ".siybk");
  const orig = read(file);
  const bad = Buffer.from(orig); bad[Math.floor(bad.length / 2)] ^= 0xff;
  fs.writeFileSync(file, bad);
  assert.equal((await w.dp.verifyBackup(r.id)).code, "FILE_CHECKSUM_MISMATCH");

  // attacker also rewrites the recorded checksum: authentication (GCM) still refuses the archive
  const metaFile = path.join(w.backupDir, r.id + ".meta.json");
  const meta = JSON.parse(read(metaFile)); meta.sha256 = sha(bad); fs.writeFileSync(metaFile, JSON.stringify(meta));
  const v = await w.dp.verifyBackup(r.id);
  assert.equal(v.ok, false);
  assert.ok(["ARCHIVE_TAMPERED", "ARCHIVE_CORRUPT"].includes(v.code), v.code);

  // truncated archive
  fs.writeFileSync(file, orig.subarray(0, orig.length - 40));
  meta.sha256 = sha(orig.subarray(0, orig.length - 40)); fs.writeFileSync(metaFile, JSON.stringify(meta));
  assert.equal((await w.dp.verifyBackup(r.id)).ok, false);

  fs.unlinkSync(file);
  assert.equal((await w.dp.verifyBackup(r.id)).code, "FILE_MISSING");
  assert.equal((await w.dp.verifyBackup("../etc/passwd")).code, "INVALID_ID");
});

test("production: no key => refused (nothing written); weak key => refused; explicit opt-out allowed and recorded as unencrypted", async () => {
  const w = world({ encryptionKey: "" });
  const r = await w.dp.createBackup({ reason: "t" });
  assert.equal(r.ok, false); assert.equal(r.code, "ENCRYPTION_KEY_REQUIRED");
  assert.deepEqual(fs.readdirSync(w.backupDir).filter((n) => /\.(siybk|meta\.json|partial)$/.test(n)), []);
  const weak = world({ encryptionKey: "short" });
  assert.equal((await weak.dp.createBackup({})).code, "ENCRYPTION_KEY_WEAK");
  const open = world({ encryptionKey: "", allowUnencrypted: true });
  const ok = await open.dp.createBackup({ reason: "dev" });
  assert.equal(ok.ok, true); assert.equal(ok.encrypted, false);
  const dev = world({ encryptionKey: "", requireEncryption: false });
  assert.equal((await dev.dp.createBackup({})).ok, true);
});

test("restore (extract): byte-identical, audit chain intact, never into live data or a non-empty directory", async () => {
  const w = world();
  const r = await w.dp.createBackup({ reason: "t" });
  const target = path.join(w.root, "restored");
  const x = await w.dp.restoreBackup(r.id, { targetDir: target, actor: "tester" });
  assert.equal(x.ok, true, JSON.stringify(x));
  assert.equal(x.audit.ok, true); assert.equal(x.audit.records, 3);
  const before = treeHashes(w.dataDir), after = treeHashes(path.join(target, "data"));
  assert.deepEqual(after, before);
  assert.equal(sha(read(path.join(target, "data", "private_uploads", "drivers_id", "id1.jpg"))), sha(DOC));
  assert.equal(read(path.join(target, "config.json")).toString(), read(path.join(w.root, "config.json")).toString());
  assert.equal(read(path.join(target, "uploads", "menu", "a.jpg")).toString(), "jpgdata");

  assert.equal((await w.dp.restoreBackup(r.id, { targetDir: target })).code, "TARGET_NOT_EMPTY");
  assert.equal((await w.dp.restoreBackup(r.id, { targetDir: w.dataDir })).code, "UNSAFE_TARGET");
  assert.equal((await w.dp.restoreBackup(r.id, { targetDir: path.join(w.dataDir, "sub") })).code, "UNSAFE_TARGET");
});

test("restore (live): needs confirmation + stopped server, takes a safety backup, MOVES current data aside, can be undone", async () => {
  const w = world();
  const r = await w.dp.createBackup({ reason: "known good" });
  // damage after the backup
  fs.writeFileSync(path.join(w.dataDir, "orders.json"), JSON.stringify({ orders: [] }));
  fs.writeFileSync(path.join(w.dataDir, "extra.json"), "{}");

  assert.equal((await w.dp.restoreBackup(r.id, { live: true })).code, "CONFIRMATION_REQUIRED");
  assert.equal((await w.dp.restoreBackup(r.id, { live: true, confirm: "wrong" })).code, "CONFIRMATION_REQUIRED");
  assert.equal((await w.dp.restoreBackup(r.id, { live: true, confirm: r.id })).code, "SERVER_MUST_BE_STOPPED");
  assert.equal(JSON.parse(read(path.join(w.dataDir, "orders.json"))).orders.length, 0, "refused attempts changed nothing");

  const x = await w.dp.restoreBackup(r.id, { live: true, confirm: r.id, serverStopped: true, actor: { id: "adm-1", role: "system_admin" } });
  assert.equal(x.ok, true, JSON.stringify(x));
  assert.equal(JSON.parse(read(path.join(w.dataDir, "orders.json"))).orders.length, 2, "data returned to the backed-up state");
  assert.ok(!fs.existsSync(path.join(w.dataDir, "extra.json")));
  assert.equal(x.audit.ok, true);
  // the damaged state still exists (moved, not deleted)
  const kept = x.previousKeptAs.find((p) => p.includes(path.basename(w.dataDir)));
  assert.ok(kept && fs.existsSync(path.join(kept, "extra.json")));
  // a verified safety backup of the state before the restore exists
  const safety = w.dp.listBackups().find((b) => b.id === x.safetyBackupId);
  assert.ok(safety && safety.verified.ok);
  assert.equal(await w.dp.verifyBackup(x.safetyBackupId).then((v) => v.ok), true);
  if (posix) assert.equal(mode(w.dataDir), 0o700);
  // events
  const ev = w.dp.listEvents({ limit: 50 }).map((e) => e.event);
  for (const n of ["restore.started", "restore.completed", "backup.created"]) assert.ok(ev.includes(n), n);
});

test("restore: a hostile archive cannot write outside the target (path traversal, absolute paths, odd roots)", async () => {
  const w = world();
  const id = "siymon-backup-20260101T000000Z-abcdef";
  const outside = path.join(w.root, "evil.txt");
  for (const [i, bad] of ["data/../../evil.txt", "/etc/cron.d/evil", "other/x.json", "data/a\\..\\b", "data//x"].entries()) {
    const bid = `siymon-backup-20260101T00000${i}Z-abcde${i}`;
    craft(w.backupDir, bid, [["data/ok.json", "{}"], [bad, "pwned"]]);
    const target = path.join(w.root, "out" + i);
    const rr = await w.dp.restoreBackup(bid, { targetDir: target });
    assert.equal(rr.ok, false, bad); assert.equal(rr.code, "UNSAFE_PATH", bad);
    assert.ok(!fs.existsSync(target), "no partial result is left behind");
    assert.ok(!fs.existsSync(outside));
  }
  assert.ok(fs.readdirSync(w.root).filter((n) => n.startsWith("out")).length === 0);
  assert.throws(() => DP.safeRel("data/../x"), /unsafe/);
  assert.doesNotThrow(() => DP.safeRel("data/audit/audit-0001.jsonl"));
  assert.doesNotThrow(() => DP.safeRel("config.json"));
  void id;
});

test("restore refuses a backup that does not verify, and records the failure", async () => {
  const w = world();
  const r = await w.dp.createBackup({ reason: "t" });
  const f = path.join(w.backupDir, r.id + ".siybk");
  const b = read(f); b[100] ^= 1; fs.writeFileSync(f, b);
  const x = await w.dp.restoreBackup(r.id, { targetDir: path.join(w.root, "never") });
  assert.equal(x.ok, false); assert.equal(x.code, "VERIFY_FAILED");
  assert.ok(!fs.existsSync(path.join(w.root, "never")));
  assert.ok(w.dp.listEvents({ limit: 20 }).some((e) => e.event === "restore.failed" && e.result === "failed"));
});

test("events: hash-chained, append-only, secrets redacted, tampering detected, forwarded to the audit log when supplied", async () => {
  const forwarded = [];
  const w = world({ audit: { append: (e) => forwarded.push(e) } });
  await w.dp.createBackup({ reason: "t", actor: { id: "adm-9", role: "system_admin", ip: "1.2.3.4" } });
  assert.equal(w.dp.verifyEvents().ok, true);
  assert.ok(forwarded.some((e) => e.action === "backup.created" && e.actorId === "adm-9" && e.ip === "1.2.3.4"));
  w.dp.recordEvent({ event: "x.test", actor: "t", detail: { password: "hunter2", note: "fine" } });
  const raw = read(path.join(w.backupDir, "EVENTS.jsonl")).toString();
  assert.ok(!raw.includes("hunter2")); assert.ok(raw.includes("fine"));
  if (posix) assert.equal(mode(path.join(w.backupDir, "EVENTS.jsonl")), 0o600);
  const f = path.join(w.backupDir, "EVENTS.jsonl");
  fs.writeFileSync(f, raw.replace('"reason":"t"', '"reason":"changed"').replace('"result":"ok"', '"result":"FAKE"'));
  const v = w.dp.verifyEvents();
  assert.equal(v.ok, false); assert.equal(v.reason, "record_modified");
  // a deleted line breaks the chain
  fs.writeFileSync(f, raw.split("\n").filter((l, i) => i !== 1).join("\n"));
  assert.equal(w.dp.verifyEvents().ok, false);
});

test("a failed backup leaves nothing behind that could be mistaken for a good one", async () => {
  const w = world();
  // an unreadable parent makes the data walk succeed but force a failure through a broken audit forward? use a bad pg_dump instead
  const dp = DP.createDataProtection({ rootDir: w.root, dataDir: w.dataDir, configFile: path.join(w.root, "config.json"), backupDir: w.backupDir, env: {}, encryptionKey: KEY, databaseUrl: "postgresql://u:p@h/db", pgDumpBin: "/nonexistent/pg_dump" });
  const r = await dp.createBackup({ reason: "t", database: true });
  assert.equal(r.ok, false); assert.equal(r.code, "PG_DUMP_UNAVAILABLE");
  assert.deepEqual(fs.readdirSync(w.backupDir).filter((n) => /\.(siybk|meta\.json|partial)$/.test(n)), []);
  const auto = await dp.createBackup({ reason: "t" }); // auto => files only, honestly reported
  assert.equal(auto.ok, true); assert.equal(auto.database.included, false); assert.match(auto.database.reason, /pg_dump/);
  assert.equal(dp.listBackups()[0].database, false);
});

test("database dump: password never on a command line, in the manifest, events or archive; failures are redacted and discard the backup", async () => {
  const w = world();
  const stub = path.join(w.root, "pg_dump-stub.sh");
  const envOut = path.join(w.root, "stub-env.txt");
  fs.writeFileSync(stub, `#!/bin/sh\nif [ "$1" = "--version" ]; then echo "pg_dump (stub)"; exit 0; fi\nenv | grep -E '^(PGPASSWORD|PGUSER|PGDATABASE|DATABASE_URL|BACKUP_ENCRYPTION_KEY)=' | sed 's/=.*//' | sort > "${envOut}"\necho "ARGS:$*" >> "${envOut}"\nprintf 'PGDMP-stub-database-contents'\nexit \${STUB_EXIT:-0}\n`, { mode: 0o755 });
  const secret = "S3cr3t!pw";
  const mk = () => DP.createDataProtection({ rootDir: w.root, dataDir: w.dataDir, configFile: path.join(w.root, "config.json"), backupDir: w.backupDir, env: {}, encryptionKey: KEY, databaseUrl: `postgresql://siy:${encodeURIComponent(secret)}@db.local:5432/siymon?sslmode=require`, pgDumpBin: stub });
  process.env.DATABASE_URL = "postgresql://leak:leak@x/y"; process.env.BACKUP_ENCRYPTION_KEY = KEY;
  try {
    const dp = mk();
    const r = await dp.createBackup({ reason: "with db", database: true });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.database.included, true); assert.ok(r.database.size > 10);
    const seen = read(envOut).toString();
    assert.ok(seen.includes("PGPASSWORD") && seen.includes("PGUSER") && seen.includes("PGDATABASE"), "libpq variables are used");
    assert.ok(!/DATABASE_URL|BACKUP_ENCRYPTION_KEY/.test(seen), "the secrets of the parent process are not handed to pg_dump");
    assert.ok(!seen.includes(secret) && !seen.includes("siymon"), "nothing secret on the command line");
    for (const f of fs.readdirSync(w.backupDir)) assert.ok(!read(path.join(w.backupDir, f)).includes(Buffer.from(secret)), "password leaked into " + f);
    // the dump is restorable as a file
    const x = await dp.restoreBackup(r.id, { targetDir: path.join(w.root, "withdb") });
    assert.equal(x.ok, true); assert.equal(x.database.restored, false);
    assert.equal(read(path.join(w.root, "withdb", "database", "postgres.dump")).toString(), "PGDMP-stub-database-contents");

    process.env.STUB_EXIT = "3";
    const f = await dp.createBackup({ reason: "will fail", database: true });
    assert.equal(f.ok, false); assert.equal(f.code, "DB_DUMP_FAILED");
    assert.ok(!f.error.includes(secret));
    assert.equal(dp.listBackups().length, 1, "the failed attempt left no archive");
  } finally { delete process.env.DATABASE_URL; delete process.env.BACKUP_ENCRYPTION_KEY; delete process.env.STUB_EXIT; }
  assert.throws(() => DP.parseDatabaseUrl("mysql://a@b/c"), /postgres/);
  assert.deepEqual(DP.parseDatabaseUrl("postgresql://u%40x:p%3Aw@h:6543/d").PGUSER, "u@x");
});

test("only one backup/restore at a time", async () => {
  const w = world();
  const [a, b] = await Promise.all([w.dp.createBackup({ reason: "a" }), w.dp.createBackup({ reason: "b" })]);
  const codes = [a, b].map((x) => (x.ok ? "ok" : x.code)).sort();
  assert.deepEqual(codes, ["BACKUP_IN_PROGRESS", "ok"]);
  assert.equal(w.dp.listBackups().length, 1);
  assert.ok(!fs.existsSync(path.join(w.backupDir, ".lock")), "lock released");
});

test("a stale lock from a dead process does not block backups", async () => {
  const w = world();
  fs.mkdirSync(w.backupDir, { recursive: true });
  fs.writeFileSync(path.join(w.backupDir, ".lock"), JSON.stringify({ pid: 999999, what: "backup", at: "2020-01-01T00:00:00Z" }));
  assert.equal((await w.dp.createBackup({ reason: "t" })).ok, true);
});

test("backup directory inside the data directory is not archived recursively; symlinks are not followed", async () => {
  const w = world();
  const nested = path.join(w.dataDir, "backups");
  const dp = DP.createDataProtection({ rootDir: w.root, dataDir: w.dataDir, configFile: path.join(w.root, "config.json"), backupDir: nested, env: {}, encryptionKey: KEY });
  let linked = false;
  try { fs.symlinkSync("/etc/passwd", path.join(w.dataDir, "link.json")); linked = true; } catch (_e) { /* not permitted */ }
  const a = await dp.createBackup({ reason: "1" });
  const b = await dp.createBackup({ reason: "2" });
  assert.equal(a.ok && b.ok, true);
  const scan = await dp._scanArchive(path.join(nested, b.id + ".siybk"));
  assert.ok(!scan.files.some((f) => f.path.startsWith("data/backups")), "no backup inside a backup");
  if (linked) assert.ok(!scan.files.some((f) => f.path === "data/link.json"));
});

test("an unreadable JSON file is still backed up (as evidence) and reported as a warning", async () => {
  const w = world();
  fs.writeFileSync(path.join(w.dataDir, "promos.json"), '{"promos": [');
  const r = await w.dp.createBackup({ reason: "t" });
  assert.equal(r.ok, true);
  assert.deepEqual(r.warnings.map((x) => x.path), ["data/promos.json"]);
  const inv = w.dp.inventory();
  assert.deepEqual(inv.totals.unreadableJson, ["data/promos.json"]);
});

test("inventory identifies the affected data: protected records, sensitive documents, record counts", () => {
  const { dp } = world();
  const inv = dp.inventory({ includeUploads: true });
  const row = (p) => inv.files.find((f) => f.path === p);
  assert.equal(row("data/orders.json").protected, true);
  assert.deepEqual(row("data/orders.json").records, { orders: 2 });
  assert.equal(row("data/audit/audit-0001.jsonl").kind, "audit_log");
  assert.equal(row("data/private_uploads/drivers_id/id1.jpg").sensitive, true);
  assert.equal(row("data/admins.json").kind, "credentials");
  assert.equal(row("config.json").sensitive, true);
  assert.ok(row("uploads/menu/a.jpg"));
  assert.ok(inv.totals.protected >= 5);
});

test("integrity report: deleted transaction records and a broken audit chain are detected against the last verified backup", async () => {
  const w = world();
  assert.equal(w.dp.integrityReport().ok, true);
  const r = await w.dp.createBackup({ reason: "baseline" });
  const rep0 = w.dp.integrityReport();
  assert.equal(rep0.ok, true); assert.equal(rep0.baseline.backupId, r.id);
  assert.deepEqual(rep0.counts, { orders: 2, topups: 1, settlements: 0, ledgerEntries: 3, auditSeq: 3 });

  // normal growth is fine
  fs.writeFileSync(path.join(w.dataDir, "orders.json"), JSON.stringify({ orders: [{ id: "o1" }, { id: "o2" }, { id: "o3" }] }));
  assert.equal(w.dp.integrityReport().ok, true);
  // an order and a wallet entry disappear
  fs.writeFileSync(path.join(w.dataDir, "orders.json"), JSON.stringify({ orders: [{ id: "o1" }] }));
  fs.writeFileSync(path.join(w.dataDir, "customers.json"), JSON.stringify({ customers: [{ id: "c1", walletHistory: [{ ref: "a" }] }] }));
  const rep = w.dp.integrityReport();
  assert.equal(rep.ok, false);
  assert.deepEqual(rep.regressions.map((x) => x.counter).sort(), ["ledgerEntries", "orders"]);
  // account deletion keeps ledger entries in the tombstone: not a regression
  fs.writeFileSync(path.join(w.dataDir, "orders.json"), JSON.stringify({ orders: [{ id: "o1" }, { id: "o2" }] }));
  fs.writeFileSync(path.join(w.dataDir, "customers.json"), JSON.stringify({ customers: [], deletedCustomers: [{ id: "c1", walletHistory: [{ ref: "a" }, { ref: "b" }] }] }));
  assert.equal(w.dp.integrityReport().ok, true);
  // a corrupt file is reported, not silently treated as empty
  fs.writeFileSync(path.join(w.dataDir, "topups.json"), "{ nope");
  const bad = w.dp.integrityReport();
  assert.equal(bad.ok, false); assert.deepEqual(bad.unreadable, ["topups"]);
  fs.writeFileSync(path.join(w.dataDir, "topups.json"), JSON.stringify({ topups: [{ id: "t1" }] }));
  // audit tampering
  const seg = path.join(w.dataDir, "audit", "audit-0001.jsonl");
  fs.writeFileSync(seg, read(seg).toString().replace("x.two", "x.2222"));
  const tampered = w.dp.integrityReport();
  assert.equal(tampered.ok, false); assert.equal(tampered.auditChain.ok, false);
});

test("quarantineIfCorrupt preserves an unreadable file before it can be overwritten", () => {
  const dir = tmp(); const f = path.join(dir, "orders.json");
  assert.equal(DP.quarantineIfCorrupt(f), null, "missing file");
  fs.writeFileSync(f, '{"orders":[]}');
  assert.equal(DP.quarantineIfCorrupt(f), null, "valid file");
  fs.writeFileSync(f, '{"orders":[{"id":"o1"');
  const errors = [];
  const q = DP.quarantineIfCorrupt(f, { logger: { error: (m, meta) => errors.push([m, meta]) }, now: () => new Date("2026-10-29T10:00:00Z") });
  assert.equal(path.basename(q), "orders.json.corrupt-20261029T100000Z");
  assert.equal(read(q).toString(), '{"orders":[{"id":"o1"');
  assert.equal(errors.length, 1); assert.equal(errors[0][1].file, "orders.json");
  if (posix) assert.equal(mode(q), 0o600);
});

test("prune removes only old backup archives, keeps at least 3 and the newest verified one, never touches data", async () => {
  let t = Date.parse("2026-10-01T00:00:00Z");
  const w = world({ now: () => new Date((t += 60000)) });
  const ids = [];
  for (let i = 0; i < 6; i++) { const r = await w.dp.createBackup({ reason: "b" + i }); assert.equal(r.ok, true); ids.push(r.id); }
  const before = treeHashes(w.dataDir);
  const p = w.dp.pruneBackups({ keep: 1, actor: "tester" }); // asked for 1, floor is 3
  assert.equal(p.removed.length, 3); assert.equal(p.kept, 3);
  assert.deepEqual(w.dp.listBackups().map((b) => b.id), ids.slice(3).reverse());
  assert.deepEqual(treeHashes(w.dataDir), before);
  assert.equal(w.dp.listEvents({ limit: 100 }).filter((e) => e.event === "backup.pruned").length, 3);
  assert.equal(w.dp.verifyEvents().ok, true);
});

test("hardenPermissions makes private data owner-only and leaves public uploads alone", { skip: !posix }, async () => {
  const w = world();
  fs.chmodSync(w.dataDir, 0o755); fs.chmodSync(path.join(w.dataDir, "private_uploads"), 0o755); fs.chmodSync(path.join(w.root, "config.json"), 0o644); fs.chmodSync(w.uploads, 0o755);
  const r = w.dp.hardenPermissions();
  assert.ok(r.changed.length >= 3);
  assert.equal(mode(w.dataDir), 0o700); assert.equal(mode(path.join(w.dataDir, "private_uploads")), 0o700);
  assert.equal(mode(path.join(w.root, "config.json")), 0o600);
  assert.equal(mode(w.uploads), 0o755, "public uploads are served by a web server: untouched");
  assert.equal(w.dp.hardenPermissions().changed.length, 0, "idempotent");
});

test("status reports honestly what is and is not configured", async () => {
  const w = world({ encryptionKey: "" , requireEncryption: true });
  let s = w.dp.status();
  assert.equal(s.encryptionConfigured, false); assert.equal(s.encryptionRequired, true);
  assert.equal(s.database.configured, false); assert.equal(s.lastBackupAt, null);
  const w2 = world();
  await w2.dp.createBackup({ reason: "t" });
  s = w2.dp.status();
  assert.equal(s.encryptionConfigured, true); assert.ok(s.lastVerifiedAt); assert.equal(s.backupCount, 1); assert.equal(s.eventsIntegrity.ok, true);
});

test("createFromEnv uses the same locations as server.js", () => {
  const root = tmp();
  const prod = DP.createFromEnv({ rootDir: root, env: { NODE_ENV: "production" } });
  assert.equal(prod.paths.uploadsDir, path.join(root, "uploads")); assert.equal(prod.paths.dataDir, path.join(root, "data")); assert.equal(prod.paths.backupDir, path.join(root, "backups"));
  const dev = DP.createFromEnv({ rootDir: root, env: { BACKUP_DIR: path.join(root, "elsewhere"), UPLOAD_DIR: path.join(root, "u") } });
  assert.equal(dev.paths.backupDir, path.join(root, "elsewhere")); assert.equal(dev.paths.uploadsDir, path.join(root, "u"));
});

test("restore (live, only some files): overlays just those files, keeps the replaced ones aside, leaves the rest alone", async () => {
  const w = world();
  const r = await w.dp.createBackup({ reason: "known good" });
  fs.writeFileSync(path.join(w.dataDir, "orders.json"), JSON.stringify({ orders: [{ id: "bad" }, { id: "bad2" }, { id: "bad3" }] }));
  fs.writeFileSync(path.join(w.dataDir, "promos.json"), JSON.stringify({ promos: ["new"] }));
  const x = await w.dp.restoreBackup(r.id, { live: true, confirm: r.id, serverStopped: true, only: ["data/orders.json"] });
  assert.equal(x.ok, true, JSON.stringify(x));
  assert.equal(JSON.parse(read(path.join(w.dataDir, "orders.json"))).orders.length, 2, "orders restored");
  assert.equal(JSON.parse(read(path.join(w.dataDir, "promos.json"))).promos[0], "new", "other files untouched");
  const aside = path.join(w.dataDir + ".pre-restore-" + fs.readdirSync(w.root).find((n) => n.startsWith("data.pre-restore-")).split("pre-restore-")[1], "orders.json");
  assert.equal(JSON.parse(read(aside)).orders.length, 3, "the replaced file was kept, not deleted");
  assert.ok(!fs.readdirSync(w.root).some((n) => n.startsWith("data.restore-")), "no staging directory left behind");
  assert.deepEqual(await w.dp.backupContains(r.id, ["data/orders.json", "data/nope.json"]), ["data/nope.json"]);
  assert.equal((await w.dp.restoreBackup(r.id, { live: true, confirm: r.id, serverStopped: true, only: ["data/../x"] })).code, "UNSAFE_PATH");
});

"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const DP = require("../lib/data-protection");
const { createMigrationRunner } = require("../lib/data-migrations");

const KEY = "m".repeat(40);
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "mig-"));
const read = (p) => fs.readFileSync(p);
const ORDERS = { orders: [{ id: "o1", total: 10 }, { id: "o2", total: 20 }] };

function world({ dpExtra = {}, withData = true } = {}) {
  const root = tmp();
  const dataDir = path.join(root, "data");
  fs.mkdirSync(dataDir, { recursive: true });
  if (withData) {
    fs.writeFileSync(path.join(dataDir, "orders.json"), JSON.stringify(ORDERS, null, 2));
    fs.writeFileSync(path.join(dataDir, "topups.json"), JSON.stringify({ topups: [{ id: "t1" }] }, null, 2));
    fs.writeFileSync(path.join(dataDir, "customers.json"), JSON.stringify({ customers: [{ id: "c1", walletHistory: [{ ref: "a" }] }] }, null, 2));
  }
  fs.writeFileSync(path.join(root, "config.json"), "{}");
  const dp = DP.createDataProtection({ rootDir: root, dataDir, configFile: path.join(root, "config.json"), uploadsDir: path.join(root, "uploads"), backupDir: path.join(root, "backups"), env: {}, encryptionKey: KEY, requireEncryption: true, ...dpExtra });
  const migrationsDir = path.join(root, "migrations");
  fs.mkdirSync(migrationsDir);
  const runner = createMigrationRunner({ dp, migrationsDir });
  const mig = (id, { files = ["orders.json"], up = "", verify = "", description = "test" } = {}) => fs.writeFileSync(path.join(migrationsDir, id + ".js"), `"use strict";\nmodule.exports = { id: ${JSON.stringify(id)}, description: ${JSON.stringify(description)}, files: ${JSON.stringify(files)}, async up(ctx) {${up}}, ${verify ? `async verify(ctx) {${verify}},` : ""} };\n`);
  return { root, dataDir, dp, runner, mig, migrationsDir, ledger: () => JSON.parse(read(path.join(dataDir, "_migrations.json"))), file: (f) => path.join(dataDir, f) };
}
const ADD_NOTE = `const d = ctx.read("orders.json", { orders: [] }); d.orders.forEach((o) => { o.note = "migrated"; }); ctx.write("orders.json", d);`;

test("baseline: recorded in the ledger, changes no data, needs no backup, and is a no-op the second time", async () => {
  const w = world();
  fs.copyFileSync(path.join(__dirname, "..", "migrations", "0001_baseline.js"), path.join(w.migrationsDir, "0001_baseline.js"));
  fs.writeFileSync(w.file("promos.json"), "{ broken");
  const before = sha(read(w.file("orders.json")));
  const r = await w.runner.run({ actor: "tester" });
  assert.equal(r.ok, true, JSON.stringify(r)); assert.deepEqual(r.applied, ["0001_baseline"]);
  assert.equal(r.backupId, null, "nothing is affected, so nothing needs a backup");
  assert.deepEqual(r.warnings, ["promos.json is not valid JSON"]);
  assert.equal(sha(read(w.file("orders.json"))), before);
  assert.equal(w.ledger().applied[0].id, "0001_baseline");
  assert.equal(w.dp.listBackups().length, 0);
  const again = await w.runner.run();
  assert.equal(again.ok, true); assert.equal(again.noop, true);
  assert.equal(w.runner.status().schemaVersion, "0001_baseline");
});

test("a real change: verified backup FIRST, then the migration, ledger last; backup contains the pre-migration bytes", async () => {
  const w = world();
  w.mig("0002_add_note", { up: ADD_NOTE, verify: `const d = ctx.read("orders.json"); return { ok: d.orders.every((o) => o.note === "migrated") };` });
  const orig = read(w.file("orders.json"));
  const r = await w.runner.run({ actor: { id: "adm-1", role: "system_admin" } });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.match(r.backupId, /^siymon-backup-/);
  assert.equal(JSON.parse(read(w.file("orders.json"))).orders[0].note, "migrated");
  const l = w.ledger(); assert.equal(l.applied[0].backupId, r.backupId); assert.equal(l.applied[0].checksum.length, 64);
  // the backup holds the ORIGINAL file
  const out = path.join(w.root, "check");
  assert.equal((await w.dp.restoreBackup(r.backupId, { targetDir: out })).ok, true);
  assert.equal(sha(read(path.join(out, "data", "orders.json"))), sha(orig));
  // events in order
  const ev = w.dp.listEvents({ limit: 50 }).map((e) => e.event).reverse();
  assert.ok(ev.indexOf("backup.created") < ev.indexOf("migration.started") && ev.indexOf("migration.started") < ev.indexOf("migration.applied"), ev.join(","));
  // idempotent
  assert.equal((await w.runner.run()).noop, true);
  assert.equal(JSON.parse(read(w.file("orders.json"))).orders.length, 2);
});

test("dry run shows what would change and touches nothing (no backup, no ledger, no file)", async () => {
  const w = world();
  w.mig("0002_add_note", { up: ADD_NOTE });
  const before = sha(read(w.file("orders.json")));
  const r = await w.runner.run({ dryRun: true });
  assert.equal(r.ok, true); assert.equal(r.dryRun, true);
  assert.equal(r.wouldChange.length, 1); assert.equal(r.wouldChange[0].file, "orders.json"); assert.equal(r.wouldChange[0].changed, true);
  assert.equal(sha(read(w.file("orders.json"))), before);
  assert.ok(!fs.existsSync(w.file("_migrations.json")));
  assert.equal(w.dp.listBackups().length, 0);
});

test("up() throws: live data untouched, ledger unchanged, the run reports failure", async () => {
  const w = world();
  w.mig("0002_boom", { up: `ctx.write("orders.json", { orders: [] }); throw new Error("boom");` });
  const before = sha(read(w.file("orders.json")));
  const r = await w.runner.run();
  assert.equal(r.ok, false); assert.equal(r.code, "MIGRATION_FAILED"); assert.equal(r.rolledBack, false);
  assert.equal(sha(read(w.file("orders.json"))), before, "overlay was discarded");
  assert.ok(!fs.existsSync(w.file("_migrations.json")));
  assert.equal(w.runner.status().pending.length, 1);
});

test("verify() fails after the commit: files are restored from the backup byte for byte, the migrated version is kept aside", async () => {
  const w = world();
  w.mig("0002_bad_verify", { up: ADD_NOTE, verify: `return { ok: false, problems: ["note missing somewhere"] };` });
  const before = read(w.file("orders.json"));
  const r = await w.runner.run();
  assert.equal(r.ok, false); assert.equal(r.code, "MIGRATION_VERIFY_FAILED"); assert.equal(r.rolledBack, true);
  assert.deepEqual(r.restored, ["orders.json"]);
  assert.equal(sha(read(w.file("orders.json"))), sha(before));
  const aside = fs.readdirSync(w.dataDir).filter((n) => n.startsWith("orders.json.rolledback-"));
  assert.equal(aside.length, 1);
  assert.equal(JSON.parse(read(path.join(w.dataDir, aside[0]))).orders[0].note, "migrated");
  assert.ok(!fs.existsSync(w.file("_migrations.json")), "ledger is written last");
  assert.ok(w.dp.listEvents({ limit: 20 }).some((e) => e.event === "migration.rolled_back" && e.result === "failed"));
  assert.equal(w.runner.status().pending.length, 1, "still pending, can be fixed and retried");
  assert.ok(fs.readdirSync(w.dp.paths.backupDir).every((n) => !n.startsWith("rollback-")), "staging removed");
});

test("a migration that removes transaction records is rolled back automatically", async () => {
  const w = world();
  w.mig("0002_drops_orders", { up: `const d = ctx.read("orders.json"); d.orders.pop(); ctx.write("orders.json", d);` });
  const before = sha(read(w.file("orders.json")));
  const r = await w.runner.run();
  assert.equal(r.ok, false); assert.equal(r.code, "PROTECTED_RECORDS_DECREASED"); assert.equal(r.rolledBack, true);
  assert.equal(sha(read(w.file("orders.json"))), before);
  assert.match(r.error, /orders 2->1/);
  // wallet ledger entries are protected too
  const w2 = world();
  w2.mig("0002_drops_ledger", { files: ["customers.json"], up: `const d = ctx.read("customers.json"); d.customers[0].walletHistory = []; ctx.write("customers.json", d);` });
  const r2 = await w2.runner.run();
  assert.equal(r2.code, "PROTECTED_RECORDS_DECREASED");
});

test("undeclared files, forbidden locations and bad declarations are rejected before anything changes", async () => {
  const w = world();
  w.mig("0002_sneaky", { files: ["orders.json"], up: `ctx.write("topups.json", { topups: [] });` });
  const r = await w.runner.run();
  assert.equal(r.ok, false); assert.equal(r.code, "UNDECLARED_FILE");
  assert.equal(JSON.parse(read(w.file("topups.json"))).topups.length, 1);

  for (const bad of ["audit/audit-0001.json", "private_uploads/x.json", "_migrations.json", "../outside.json", "/etc/x.json", "orders.txt"]) {
    const x = world();
    x.mig("0002_bad", { files: [bad], up: "" });
    const rr = await x.runner.run();
    assert.equal(rr.ok, false, bad); assert.equal(rr.code, "INVALID_MIGRATION", bad + " -> " + rr.code);
  }
});

test("unreadable input: nothing is changed, no backup, clear error", async () => {
  const w = world();
  fs.writeFileSync(w.file("orders.json"), "{ not json");
  w.mig("0002_add_note", { up: ADD_NOTE });
  const r = await w.runner.run();
  assert.equal(r.ok, false); assert.equal(r.code, "CORRUPT_INPUT"); assert.deepEqual(r.unreadable, ["orders.json"]);
  assert.equal(read(w.file("orders.json")).toString(), "{ not json");
  assert.equal(w.dp.listBackups().length, 0);
});

test("no verified backup => no migration (production without BACKUP_ENCRYPTION_KEY)", async () => {
  const w = world({ dpExtra: { encryptionKey: "" } });
  w.mig("0002_add_note", { up: ADD_NOTE });
  const before = sha(read(w.file("orders.json")));
  const r = await w.runner.run();
  assert.equal(r.ok, false); assert.equal(r.code, "BACKUP_FAILED"); assert.equal(r.backupCode, "ENCRYPTION_KEY_REQUIRED");
  assert.equal(sha(read(w.file("orders.json"))), before);
  assert.ok(!fs.existsSync(w.file("_migrations.json")));
  assert.ok(w.dp.listEvents({ limit: 10 }).some((e) => e.event === "migration.aborted"));
});

test("creating a new data file: no backup needed; a failure moves the new file aside", async () => {
  const w = world();
  w.mig("0002_new_store", { files: ["loyalty.json"], up: `ctx.write("loyalty.json", { members: [] });`, verify: `return { ok: false };` });
  const r = await w.runner.run();
  assert.equal(r.ok, false); assert.equal(r.rolledBack, true); assert.equal(r.backupId, null);
  assert.ok(!fs.existsSync(w.file("loyalty.json")));
  assert.ok(fs.readdirSync(w.dataDir).some((n) => n.startsWith("loyalty.json.rolledback-")));
  fs.writeFileSync(path.join(w.migrationsDir, "0002_new_store.js"), fs.readFileSync(path.join(w.migrationsDir, "0002_new_store.js"), "utf8").replace("return { ok: false };", "return { ok: true };"));
  const ok = await w.runner.run();
  assert.equal(ok.ok, true); assert.ok(fs.existsSync(w.file("loyalty.json")));
});

test("drift: editing or removing an applied migration stops every later run; out-of-order is refused", async () => {
  const w = world();
  w.mig("0002_add_note", { up: ADD_NOTE });
  assert.equal((await w.runner.run()).ok, true);
  const f = path.join(w.migrationsDir, "0002_add_note.js");
  const src = fs.readFileSync(f, "utf8");
  fs.writeFileSync(f, src + "\n// edited later\n");
  w.mig("0003_next", { up: "" });
  let r = await w.runner.run();
  assert.equal(r.ok, false); assert.equal(r.code, "MIGRATION_MODIFIED");
  fs.unlinkSync(f);
  r = await w.runner.run();
  assert.equal(r.code, "MIGRATION_MISSING");
  fs.writeFileSync(f, src);
  assert.equal((await w.runner.run()).ok, true, "restored file => runs again");
  w.mig("0002_late", { up: "" });
  assert.equal((await w.runner.run()).code, "OUT_OF_ORDER");
});

test("a corrupt ledger stops everything instead of re-running migrations", async () => {
  const w = world();
  w.mig("0002_add_note", { up: ADD_NOTE });
  fs.writeFileSync(w.file("_migrations.json"), "{ nope");
  const before = sha(read(w.file("orders.json")));
  const r = await w.runner.run();
  assert.equal(r.ok, false); assert.equal(r.code, "LEDGER_UNREADABLE");
  assert.equal(sha(read(w.file("orders.json"))), before);
});

test("two runners at once: only one migrates", async () => {
  const w = world();
  w.mig("0002_add_note", { up: ADD_NOTE });
  const other = createMigrationRunner({ dp: w.dp, migrationsDir: w.migrationsDir });
  const [a, b] = await Promise.all([w.runner.run(), other.run()]);
  const codes = [a, b].map((x) => (x.ok ? (x.noop ? "noop" : "applied") : x.code)).sort();
  assert.ok(codes.includes("applied"), codes.join());
  assert.ok(codes.includes("MIGRATION_IN_PROGRESS") || codes.includes("noop"), codes.join());
  assert.equal(JSON.parse(read(w.file("orders.json"))).orders.filter((o) => o.note === "migrated").length, 2);
  assert.equal(w.ledger().applied.length, 1, "applied exactly once");
});

test("multiple pending migrations are one unit: the second failing restores the first one's changes too", async () => {
  const w = world();
  w.mig("0002_add_note", { up: ADD_NOTE });
  w.mig("0003_fails", { files: ["topups.json"], up: `ctx.write("topups.json", { topups: [{ id: "t1", x: 1 }] });`, verify: `return { ok: false };` });
  const o = sha(read(w.file("orders.json"))), t = sha(read(w.file("topups.json")));
  const r = await w.runner.run();
  assert.equal(r.ok, false); assert.equal(r.rolledBack, true);
  assert.equal(sha(read(w.file("orders.json"))), o); assert.equal(sha(read(w.file("topups.json"))), t);
  assert.ok(!fs.existsSync(w.file("_migrations.json")));
});

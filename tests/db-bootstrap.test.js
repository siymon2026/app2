"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const DP = require("../lib/data-protection");
const B = require("../lib/db-bootstrap");

const KEY = "d".repeat(40);
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "dbb-"));

test("decide: the schema step is versioned when migrations exist, never destructive, and gated in production", () => {
  const env = {};
  assert.equal(B.decide({ env, hasDb: false }).schema, "none");
  assert.equal(B.decide({ env, hasDb: true, isProd: false, hasMigrations: false }).schema, "db-push");
  assert.equal(B.decide({ env, hasDb: true, isProd: false, hasMigrations: true }).schema, "migrate-deploy");
  // backup required in production unless the database is known to be empty
  assert.equal(B.decide({ env, hasDb: true, isProd: true, dbHasTables: true }).backupRequired, true);
  assert.equal(B.decide({ env, hasDb: true, isProd: true, dbHasTables: null }).backupRequired, true, "unknown => treated as non-empty");
  assert.equal(B.decide({ env, hasDb: true, isProd: true, dbHasTables: false }).backupRequired, false);
  assert.equal(B.decide({ env, hasDb: true, isProd: false, dbHasTables: true }).backupRequired, false);
  // existing opt-out flags keep working
  const off = B.decide({ env: { PRISMA_DB_PUSH: "0", AUTO_JSON_MIGRATION: "0", PRISMA_GENERATE: "0" }, hasDb: true, isProd: true, dbHasTables: true });
  assert.deepEqual([off.schema, off.json2db, off.generate, off.backupRequired], ["none", false, false, false]);
});

test("hasPrismaMigrations needs a migration.sql inside a migration directory", () => {
  const root = tmp();
  assert.equal(B.hasPrismaMigrations(root), false);
  fs.mkdirSync(path.join(root, "prisma", "migrations", "20260101000000_init"), { recursive: true });
  assert.equal(B.hasPrismaMigrations(root), false);
  fs.writeFileSync(path.join(root, "prisma", "migrations", "20260101000000_init", "migration.sql"), "-- sql");
  assert.equal(B.hasPrismaMigrations(root), true);
});

function dpWith(pgDumpBin, extra = {}) {
  const root = tmp();
  fs.mkdirSync(path.join(root, "data"), { recursive: true });
  fs.writeFileSync(path.join(root, "data", "orders.json"), JSON.stringify({ orders: [{ id: "o1" }] }));
  return DP.createDataProtection({ rootDir: root, env: {}, encryptionKey: KEY, requireEncryption: true, databaseUrl: "postgresql://u:p@h:5432/d", pgDumpBin, ...extra });
}
function stub(ok = true) {
  const f = path.join(tmp(), "pg_dump");
  fs.writeFileSync(f, `#!/bin/sh\nif [ "$1" = "--version" ]; then echo stub; exit 0; fi\nprintf 'PGDMP-x'\nexit ${ok ? 0 : 2}\n`, { mode: 0o755 });
  return f;
}

test("execute: a verified database backup is taken BEFORE the schema command; the command never carries --accept-data-loss", async () => {
  const dp = dpWith(stub());
  const calls = [];
  const run = (cmd, args) => { calls.push([cmd, ...args].join(" ")); if (/db push/.test(calls[calls.length - 1])) assert.equal(dp.listBackups().length, 1, "backup existed when the schema step started"); };
  const plan = B.decide({ env: {}, isProd: true, hasDb: true, hasMigrations: false, dbHasTables: true });
  const r = await B.execute({ plan, dp, run });
  assert.equal(r.ok, true); assert.match(r.backupId, /^siymon-backup-/);
  assert.deepEqual(calls, ["npx prisma generate", "npx prisma db push", "node scripts/migrate-json-to-db.js"]);
  assert.ok(!calls.join(" ").includes("accept-data-loss"));
  assert.equal(dp.listBackups()[0].database, true, "the backup includes the database dump");
  assert.ok(dp.listEvents({ limit: 10 }).some((e) => e.event === "db.schema.applied"));
});

test("execute: no pg_dump / failing backup => the schema step does NOT run and nothing touches the database", async () => {
  for (const bin of ["/nonexistent/pg_dump", stub(false)]) {
    const dp = dpWith(bin);
    const calls = [];
    const plan = B.decide({ env: {}, isProd: true, hasDb: true, hasMigrations: true, dbHasTables: true });
    const r = await B.execute({ plan, dp, run: (c, a) => calls.push([c, ...a].join(" ")) });
    assert.equal(r.ok, false); assert.equal(r.code, "BACKUP_FAILED");
    assert.match(r.error, /PRISMA_DB_PUSH=0/);
    assert.ok(!calls.some((c) => /migrate deploy|db push|migrate-json/.test(c)), calls.join("; "));
    assert.ok(dp.listEvents({ limit: 10 }).some((e) => e.event === "db.schema.aborted"));
  }
});

test("execute: empty database / development => no backup needed; a failing schema command is reported with the backup id", async () => {
  const dp = dpWith("/nonexistent/pg_dump");
  const calls = [];
  const ok = await B.execute({ plan: B.decide({ env: {}, isProd: true, hasDb: true, dbHasTables: false }), dp, run: (c, a) => calls.push([c, ...a].join(" ")) });
  assert.equal(ok.ok, true); assert.equal(ok.backupId, null);
  const dp2 = dpWith(stub());
  const bad = await B.execute({ plan: B.decide({ env: { AUTO_JSON_MIGRATION: "0" }, isProd: true, hasDb: true, hasMigrations: true, dbHasTables: true }), dp: dp2, run: (c, a) => { if (a.includes("deploy")) throw new Error("P3009 failed migration"); } });
  assert.equal(bad.ok, false); assert.equal(bad.code, "SCHEMA_FAILED"); assert.match(bad.error, new RegExp(bad.backupId));
  assert.ok(dp2.listEvents({ limit: 10 }).some((e) => e.event === "db.schema.failed"));
});

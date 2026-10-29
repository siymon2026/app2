"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const DP = require("../lib/data-protection");
const { createMigrationRunner } = require("../lib/data-migrations");
const { backupMain, migrateMain, parseArgs } = require("../lib/data-cli");

const KEY = "c".repeat(40);
function world() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cli-"));
  fs.mkdirSync(path.join(root, "data"), { recursive: true });
  fs.writeFileSync(path.join(root, "data", "orders.json"), JSON.stringify({ orders: [{ id: "o1" }] }));
  fs.writeFileSync(path.join(root, "config.json"), "{}");
  const dp = DP.createDataProtection({ rootDir: root, env: {}, encryptionKey: KEY, requireEncryption: true, uploadsDir: path.join(root, "uploads") });
  const lines = [], errs = [];
  const run = async (...argv) => { lines.length = 0; errs.length = 0; const code = await backupMain(argv, { dp, out: (l) => lines.push(l), err: (l) => errs.push(l) }); return { code, out: lines.join("\n"), err: errs.join("\n") }; };
  return { root, dp, run };
}

test("parseArgs", () => {
  assert.deepEqual(parseArgs(["restore", "id1", "--live", "--confirm", "id1", "--only=a,b"]), { pos: ["restore", "id1"], flags: { live: true, confirm: "id1", only: "a,b" } });
});

test("cli: create -> list -> verify -> restore (extract) -> events; refuses prune without --yes", async () => {
  const w = world();
  assert.equal((await w.run("create")).code, 2, "reason required");
  const c = await w.run("create", "--reason", "cli test");
  assert.equal(c.code, 0, c.err); assert.match(c.out, /encrypted \(AES-256-GCM\)/); assert.ok(!c.out.includes(KEY));
  const id = c.out.match(/siymon-backup-\S+/)[0];
  assert.match((await w.run("list")).out, new RegExp(id + ".*enc.*verified"));
  assert.match((await w.run("verify", id)).out, /OK/);
  const r = await w.run("restore", id, "--to", path.join(w.root, "out"));
  assert.equal(r.code, 0, r.err); assert.ok(fs.existsSync(path.join(w.root, "out", "data", "orders.json")));
  assert.match((await w.run("events")).out, /intact/);
  assert.equal((await w.run("prune", "--keep", "3")).code, 2);
  assert.equal((await w.run("nonsense")).code, 2);
  assert.match((await w.run("inventory")).out, /orders\.json/);
});

test("cli: live restore needs --confirm and --server-stopped; failures exit 1 with the reason", async () => {
  const w = world();
  const id = (await w.run("create", "--reason", "before live restore")).out.match(/siymon-backup-\S+/)[0];
  const a = await w.run("restore", id, "--live");
  assert.equal(a.code, 1); assert.match(a.err, /CONFIRMATION_REQUIRED/);
  const b = await w.run("restore", id, "--live", "--confirm", id);
  assert.match(b.err, /SERVER_MUST_BE_STOPPED/);
  const ok = await w.run("restore", id, "--live", "--confirm", id, "--server-stopped");
  assert.equal(ok.code, 0, ok.err); assert.match(ok.out, /safety backup of the previous state/);
  assert.equal((await w.run("verify", "siymon-backup-20200101T000000Z-aaaaaa")).code, 1);
});

test("cli: migrate status / dry-run / apply", async () => {
  const w = world();
  const mdir = path.join(w.root, "migrations"); fs.mkdirSync(mdir);
  fs.writeFileSync(path.join(mdir, "0002_note.js"), `module.exports={id:"0002_note",description:"add note",files:["orders.json"],async up(c){const d=c.read("orders.json");d.orders.forEach(o=>o.note="x");c.write("orders.json",d);}};`);
  const runner = createMigrationRunner({ dp: w.dp, migrationsDir: mdir });
  const lines = [], errs = [];
  const go = async (...a) => { lines.length = 0; errs.length = 0; const code = await migrateMain(a, { runner, out: (l) => lines.push(l), err: (l) => errs.push(l) }); return { code, out: lines.join("\n"), err: errs.join("\n") }; };
  assert.match((await go("status")).out, /PENDING\s+0002_note/);
  const d = await go("--dry-run");
  assert.equal(d.code, 0); assert.match(d.out, /WOULD CHANGE\s+orders\.json/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(w.root, "data", "orders.json"))).orders[0].note, undefined);
  const a = await go();
  assert.equal(a.code, 0, a.err); assert.match(a.out, /applied: 0002_note/); assert.match(a.out, /verified backup taken first/);
  assert.match((await go()).out, /nothing to migrate/);
  assert.match((await go("status")).out, /schema version: 0002_note/);
});

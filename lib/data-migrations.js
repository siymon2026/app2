"use strict";
/**
 * Versioned data migrations for the JSON stores (spec section 21).
 *
 *   migrations/NNNN_name.js   exports { id, description, files:[...], up(ctx), verify?(ctx) }
 *   data/_migrations.json     ledger of applied migrations (id, checksum of the migration file, time, backup id)
 *
 * Order of operations for a run that has pending migrations:
 *   1. plan: ledger vs files on disk. A modified or missing applied migration, or an out-of-order one, STOPS the run.
 *   2. preflight: every declared data file that exists must parse (otherwise nothing is touched).
 *   3. backup: a full verified backup (lib/data-protection) of the data BEFORE any change. No verified backup => no migration.
 *   4. up() runs against an in-memory overlay; live files are untouched until every up() succeeded.
 *   5. commit: each changed file is written atomically (temp + fsync + rename).
 *   6. verify: the migration's own verify(), every written file parses, protected record counters did not decrease.
 *   7. ledger is written LAST. Any failure in 4-7 puts the affected files back from the backup (current versions are
 *      moved aside as *.rolledback-<time>, never deleted), records the event and reports ok:false.
 * A run with nothing pending touches nothing and takes no backup. A dry run executes up() on the overlay only.
 *
 * Migrations may only declare *.json files directly managed by the app; the audit chain, private documents and the
 * ledger itself are off limits. Run it while the application is stopped (scripts/prestart.js does).
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { protectedRegressions } = require("./data-protection");

const FILE_RE = /^\d{4}_[a-z0-9_]+\.js$/;
const FORBIDDEN = [/^audit\//, /^private_uploads\//, /^_migrations\.json$/, /\.lock$/];
const sha256 = (b) => crypto.createHash("sha256").update(b).digest("hex");
const errMsg = (e) => String(e && e.message ? e.message : e);
const stamp = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
const clone = (v) => JSON.parse(JSON.stringify(v));

class MigrationError extends Error {
  constructor(code, message, extra) { super(message || code); this.code = code; Object.assign(this, extra || {}); }
}

function normFile(f) {
  const s = String(f || "");
  if (!s || s.includes("\0") || s.includes("\\") || s.startsWith("/") || !/\.json$/.test(s) || s.split("/").some((p) => p === "" || p === "." || p === ".."))
    throw new MigrationError("INVALID_DECLARATION", `invalid data file "${s.slice(0, 60)}" (only relative *.json paths are allowed)`);
  if (FORBIDDEN.some((re) => re.test(s))) throw new MigrationError("INVALID_DECLARATION", `"${s}" cannot be changed by a migration`);
  return s;
}

function createMigrationRunner({ dp, migrationsDir, dataDir, now = () => new Date(), logger = null } = {}) {
  if (!dp) throw new Error("data-migrations: dp is required");
  const dDir = path.resolve(dataDir || dp.paths.dataDir);
  const mDir = path.resolve(migrationsDir || path.join(dp.paths.rootDir, "migrations"));
  const ledgerFile = path.join(dDir, "_migrations.json");
  const lockFile = path.join(dp.paths.backupDir, ".migrate.lock");
  const log = (lvl, msg, meta) => { if (logger && logger[lvl]) logger[lvl](msg, meta); };

  function loadMigrations() {
    let names = [];
    try { names = fs.readdirSync(mDir).filter((n) => FILE_RE.test(n)).sort(); } catch (_e) { return []; }
    return names.map((n) => {
      const abs = path.join(mDir, n);
      const id = n.replace(/\.js$/, "");
      let m;
      try { delete require.cache[abs]; m = require(abs); } catch (e) { throw new MigrationError("INVALID_MIGRATION", `${n} cannot be loaded: ${errMsg(e)}`); }
      if (!m || m.id !== id) throw new MigrationError("INVALID_MIGRATION", `${n}: exported id must be "${id}"`);
      if (typeof m.up !== "function") throw new MigrationError("INVALID_MIGRATION", `${n}: up() is required`);
      if (!Array.isArray(m.files)) throw new MigrationError("INVALID_MIGRATION", `${n}: files[] (the affected data files) is required`);
      let files;
      try { files = m.files.map(normFile); } catch (e) { throw new MigrationError("INVALID_MIGRATION", `${n}: ${errMsg(e)}`); }
      return { id, description: String(m.description || ""), files, up: m.up, verify: typeof m.verify === "function" ? m.verify : null, checksum: sha256(fs.readFileSync(abs)) };
    });
  }

  function readLedger() {
    let raw;
    try { raw = fs.readFileSync(ledgerFile, "utf8"); } catch (e) { if (e.code === "ENOENT") return { version: 1, applied: [] }; throw new MigrationError("LEDGER_UNREADABLE", "migration ledger cannot be read"); }
    try { const l = JSON.parse(raw); if (!l || !Array.isArray(l.applied)) throw new Error("shape"); return l; } catch (_e) { throw new MigrationError("LEDGER_UNREADABLE", "migration ledger is corrupt; refusing to guess which migrations ran"); }
  }

  /** Pure inspection: nothing is written. */
  function plan() {
    const migrations = loadMigrations();
    const ledger = readLedger();
    const byId = new Map(migrations.map((m) => [m.id, m]));
    const problems = [];
    for (const a of ledger.applied) {
      const m = byId.get(a.id);
      if (!m) problems.push({ code: "MIGRATION_MISSING", id: a.id, message: "an applied migration file is missing" });
      else if (m.checksum !== a.checksum) problems.push({ code: "MIGRATION_MODIFIED", id: a.id, message: "an applied migration file was changed after it ran" });
    }
    const appliedIds = new Set(ledger.applied.map((a) => a.id));
    const pending = migrations.filter((m) => !appliedIds.has(m.id));
    const lastApplied = ledger.applied.length ? ledger.applied[ledger.applied.length - 1].id : null;
    for (const m of pending) if (lastApplied && m.id < lastApplied) problems.push({ code: "OUT_OF_ORDER", id: m.id, message: `pending migration is older than the last applied one (${lastApplied})` });
    return { schemaVersion: lastApplied, applied: ledger.applied.map((a) => ({ id: a.id, appliedAt: a.appliedAt, backupId: a.backupId || null })), pending, problems, migrations };
  }
  function status() {
    try {
      const p = plan();
      return { ok: p.problems.length === 0, schemaVersion: p.schemaVersion, applied: p.applied, pending: p.pending.map((m) => ({ id: m.id, description: m.description, files: m.files })), problems: p.problems };
    } catch (e) { return { ok: false, schemaVersion: null, applied: [], pending: [], problems: [{ code: e.code || "ERROR", message: errMsg(e) }] }; }
  }

  // ---- overlay context
  const abs = (f) => path.join(dDir, f);
  function makeCtx(m, overlay, messages) {
    const allowed = new Set(m.files);
    const must = (f) => { const n = normFile(f); if (!allowed.has(n)) throw new MigrationError("UNDECLARED_FILE", `${m.id} touched "${n}" which it did not declare in files[]`); return n; };
    return {
      id: m.id, dataDir: dDir,
      exists: (f) => { const n = must(f); return overlay.has(n) || fs.existsSync(abs(n)); },
      read: (f, fallback) => {
        const n = must(f);
        if (overlay.has(n)) return clone(overlay.get(n));
        try { return JSON.parse(fs.readFileSync(abs(n), "utf8")); } catch (e) { if (e.code === "ENOENT") return fallback; throw new MigrationError("CORRUPT_INPUT", `${n} is not valid JSON`); }
      },
      write: (f, value) => {
        const n = must(f);
        let v; try { v = clone(value); } catch (_e) { throw new MigrationError("INVALID_VALUE", `${n}: value is not JSON-serialisable`); }
        if (v === undefined) throw new MigrationError("INVALID_VALUE", `${n}: undefined cannot be stored`);
        overlay.set(n, v);
      },
      log: (msg) => messages.push(`${m.id}: ${String(msg).slice(0, 300)}`),
    };
  }
  /** Read-only view of the LIVE data, for verify() after commit. */
  function liveCtx(m) {
    const allowed = new Set(m.files);
    return {
      id: m.id, dataDir: dDir,
      exists: (f) => fs.existsSync(abs(normFile(f))),
      read: (f, fallback) => { const n = normFile(f); try { return JSON.parse(fs.readFileSync(abs(n), "utf8")); } catch (e) { if (e.code === "ENOENT") return fallback; throw new MigrationError("CORRUPT_INPUT", `${n} is not valid JSON`); } },
      declared: () => [...allowed],
    };
  }

  function atomicWrite(file, text, modeFallback = 0o600) {
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    let mode = modeFallback;
    try { mode = fs.statSync(file).mode & 0o777; } catch (_e) { /* new file */ }
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    const fd = fs.openSync(tmp, "w", mode);
    try { fs.writeSync(fd, text); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(tmp, file);
  }

  function acquireLock() {
    fs.mkdirSync(dp.paths.backupDir, { recursive: true, mode: 0o700 });
    for (let i = 0; i < 2; i++) {
      try { const fd = fs.openSync(lockFile, "wx", 0o600); fs.writeSync(fd, JSON.stringify({ pid: process.pid, at: now().toISOString() })); fs.closeSync(fd); return () => { try { fs.unlinkSync(lockFile); } catch (_e) { /* gone */ } }; }
      catch (e) {
        if (e.code !== "EEXIST") throw e;
        let pid = 0; try { pid = JSON.parse(fs.readFileSync(lockFile, "utf8")).pid; } catch (_e) { /* unreadable */ }
        let alive = true; if (pid) { try { process.kill(pid, 0); } catch (_e) { alive = false; } }
        if (!alive) { try { fs.unlinkSync(lockFile); } catch (_e) { /* race */ } continue; }
        throw new MigrationError("MIGRATION_IN_PROGRESS", "another migration is running");
      }
    }
    throw new MigrationError("MIGRATION_IN_PROGRESS", "could not acquire the migration lock");
  }

  const fail = (code, error, extra) => ({ ok: false, code, error, ...(extra || {}) });

  /** Puts the files this run changed back to their backed-up state. Current versions are kept as *.rolledback-<time>. */
  async function rollback(backupId, files, actor) {
    const t = stamp(now());
    const rels = files.map((f) => "data/" + f);
    const staging = path.join(dp.paths.backupDir, `rollback-${backupId}-${t}`);
    const restored = [], movedAside = [], errors = [];
    let extracted = null;
    if (backupId) {
      extracted = await dp.restoreBackup(backupId, { targetDir: staging, only: rels, actor });
      if (!extracted.ok) errors.push(`restore from backup failed: ${extracted.code}`);
    }
    for (const f of files) {
      const cur = abs(f);
      try {
        const src = extracted && extracted.ok ? path.join(staging, "data", f) : null;
        if (fs.existsSync(cur)) { fs.renameSync(cur, `${cur}.rolledback-${t}`); movedAside.push(f); }
        if (src && fs.existsSync(src)) { fs.mkdirSync(path.dirname(cur), { recursive: true }); const tmp = `${cur}.${process.pid}.rb.tmp`; fs.copyFileSync(src, tmp); fs.renameSync(tmp, cur); restored.push(f); }
      } catch (e) { errors.push(`${f}: ${errMsg(e)}`); }
    }
    try { fs.rmSync(staging, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
    return { restored, movedAside, errors };
  }

  /**
   * @param {{dryRun?:boolean, actor?:any}} o
   * @returns {Promise<object>} { ok, noop?, dryRun?, applied?, backupId?, warnings?, code?, error?, rolledBack? }
   */
  async function run(o = {}) {
    const actor = o.actor || "system";
    let pl;
    try { pl = plan(); } catch (e) { return fail(e.code || "PLAN_FAILED", errMsg(e)); }
    if (pl.problems.length) {
      dp.recordEvent({ event: "migration.refused", result: "failed", actor, detail: { problems: pl.problems.map((p) => p.code + ":" + p.id) } });
      return fail(pl.problems[0].code, pl.problems[0].message, { problems: pl.problems });
    }
    if (!pl.pending.length) return { ok: true, noop: true, applied: [], schemaVersion: pl.schemaVersion };

    const prepare = (p) => {
      const ids = p.pending.map((m) => m.id);
      const affected = [...new Set(p.pending.flatMap((m) => m.files))].sort();
      const unreadable = [];
      for (const f of affected) { if (fs.existsSync(abs(f))) { try { JSON.parse(fs.readFileSync(abs(f), "utf8")); } catch (_e) { unreadable.push(f); } } }
      return { ids, affected, unreadable };
    };
    let { ids, affected, unreadable } = prepare(pl);
    if (unreadable.length) return fail("CORRUPT_INPUT", "data files to be migrated are not valid JSON; nothing was changed: " + unreadable.join(", "), { unreadable });

    const messages = [];
    if (o.dryRun) {
      const overlay = new Map();
      try { for (const m of pl.pending) await m.up(makeCtx(m, overlay, messages)); } catch (e) { return fail(e.code || "MIGRATION_FAILED", errMsg(e), { dryRun: true }); }
      const wouldChange = [...overlay.entries()].map(([f, v]) => {
        let before = null; try { const b = fs.readFileSync(abs(f)); before = { bytes: b.length, sha256: sha256(b) }; } catch (_e) { /* new file */ }
        const text = JSON.stringify(v, null, 2);
        return { file: f, before, after: { bytes: Buffer.byteLength(text), sha256: sha256(text) }, changed: !before || before.sha256 !== sha256(text) };
      });
      return { ok: true, dryRun: true, pending: ids, affected, wouldChange, messages };
    }

    let release;
    try { release = acquireLock(); } catch (e) { return fail(e.code || "LOCK_FAILED", errMsg(e)); }
    // Re-read the state UNDER the lock: another process may have applied these migrations while we waited.
    try {
      pl = plan();
      if (pl.problems.length) { release(); return fail(pl.problems[0].code, pl.problems[0].message, { problems: pl.problems }); }
      if (!pl.pending.length) { release(); return { ok: true, noop: true, applied: [], schemaVersion: pl.schemaVersion }; }
      ({ ids, affected, unreadable } = prepare(pl));
      if (unreadable.length) { release(); return fail("CORRUPT_INPUT", "data files to be migrated are not valid JSON; nothing was changed: " + unreadable.join(", "), { unreadable }); }
    } catch (e) { release(); return fail(e.code || "PLAN_FAILED", errMsg(e)); }
    let backupId = null;
    const committed = [];
    try {
      const counts0 = dp.protectedCounts();
      const existing = affected.filter((f) => fs.existsSync(abs(f)));
      if (existing.length) {
        const b = await dp.createBackup({ reason: `automatic backup before migration ${ids.join(", ")}`, actor, includeUploads: false, database: false });
        if (!b.ok) {
          dp.recordEvent({ event: "migration.aborted", result: "failed", actor, detail: { pending: ids, reason: "backup_failed", backup: b.code } });
          return fail("BACKUP_FAILED", `migration not started: the pre-migration backup could not be created and verified (${b.code})`, { backupCode: b.code });
        }
        backupId = b.id;
        const missing = await dp.backupContains(backupId, existing.map((f) => "data/" + f));
        if (missing.length) {
          dp.recordEvent({ event: "migration.aborted", result: "failed", actor, id: backupId, detail: { pending: ids, reason: "backup_incomplete" } });
          return fail("BACKUP_INCOMPLETE", "migration not started: the backup does not contain every affected file", { missing });
        }
      }
      dp.recordEvent({ event: "migration.started", actor, id: backupId || undefined, detail: { pending: ids, affected, backupTaken: !!backupId } });

      const overlay = new Map();
      for (const m of pl.pending) await m.up(makeCtx(m, overlay, messages));

      for (const [f, v] of overlay) { atomicWrite(abs(f), JSON.stringify(v, null, 2)); committed.push(f); }

      const warnings = [];
      for (const m of pl.pending) {
        if (!m.verify) continue;
        const r = await m.verify(liveCtx(m));
        if (!r || r.ok !== true) throw new MigrationError("MIGRATION_VERIFY_FAILED", `${m.id}: verification failed${r && r.problems ? " (" + r.problems.slice(0, 3).join("; ") + ")" : ""}`);
        if (r.warnings) warnings.push(...r.warnings);
      }
      for (const f of committed) { try { JSON.parse(fs.readFileSync(abs(f), "utf8")); } catch (_e) { throw new MigrationError("MIGRATION_VERIFY_FAILED", `${f} is not valid JSON after the migration`); } }
      const reg = protectedRegressions(counts0, dp.protectedCounts());
      if (reg.length) throw new MigrationError("PROTECTED_RECORDS_DECREASED", "a migration may not remove transaction, ledger or audit records: " + reg.map((r) => `${r.counter} ${r.before}->${r.after}`).join(", "));

      const ledger = readLedger();
      const at = now().toISOString();
      for (const m of pl.pending) ledger.applied.push({ id: m.id, checksum: m.checksum, appliedAt: at, backupId, files: m.files, actor: typeof actor === "object" ? String(actor.id || "system") : String(actor) });
      ledger.lastRun = { at, ids, backupId };
      atomicWrite(ledgerFile, JSON.stringify(ledger, null, 2));
      dp.recordEvent({ event: "migration.applied", actor, id: backupId || undefined, detail: { applied: ids, files: committed, warnings: warnings.length } });
      log("info", "data migrations applied", { applied: ids, backupId });
      return { ok: true, applied: ids, backupId, files: committed, warnings, messages, schemaVersion: ids[ids.length - 1] };
    } catch (e) {
      const code = e && e.code && /^[A-Z_]+$/.test(e.code) ? e.code : "MIGRATION_FAILED";
      let rb = { restored: [], movedAside: [], errors: [] };
      if (committed.length) rb = await rollback(backupId, committed, actor);
      dp.recordEvent({ event: "migration.rolled_back", result: "failed", actor, id: backupId || undefined, detail: { pending: ids, failure: code, error: errMsg(e).slice(0, 300), restored: rb.restored, rollbackErrors: rb.errors } });
      log("error", "data migration failed and was rolled back", { failure: code, restored: rb.restored.length });
      return fail(code, errMsg(e), { rolledBack: committed.length > 0, restored: rb.restored, movedAside: rb.movedAside, rollbackErrors: rb.errors, backupId });
    } finally { release(); }
  }

  return { plan, status, run, ledgerFile, migrationsDir: mDir };
}

function createMigrationRunnerFromEnv({ dp, rootDir, ...rest }) {
  return createMigrationRunner({ dp, migrationsDir: path.join(path.resolve(rootDir || dp.paths.rootDir), "migrations"), ...rest });
}

module.exports = { createMigrationRunner, createMigrationRunnerFromEnv, MigrationError, normFile };

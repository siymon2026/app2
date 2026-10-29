"use strict";
/**
 * Guarded PostgreSQL schema change for scripts/prestart.js (spec section 21).
 *
 * Before: prestart ran `prisma db push` on every production start with no backup and no versioning.
 * Now:
 *   - prisma/migrations/<timestamp>_name/migration.sql present  -> `prisma migrate deploy` (versioned, applies only what is pending)
 *   - none present (the repository ships none yet)              -> `prisma db push` (never with --accept-data-loss)
 *   - in production, if the database already has tables (or that cannot be determined), a verified pg_dump backup
 *     must exist BEFORE the schema step. No pg_dump / backup failure => the schema step does NOT run (fail closed).
 *   - PRISMA_DB_PUSH=0 skips the schema step entirely (existing flag, unchanged).
 * The application itself does not read PostgreSQL yet (the JSON stores are authoritative); see docs/DATA-PROTECTION.md.
 */
const fs = require("fs");
const path = require("path");

function hasPrismaMigrations(rootDir) {
  try {
    const dir = path.join(rootDir, "prisma", "migrations");
    return fs.readdirSync(dir, { withFileTypes: true }).some((d) => d.isDirectory() && fs.existsSync(path.join(dir, d.name, "migration.sql")));
  } catch (_e) { return false; }
}

/** Pure decision. dbHasTables: true | false | null (unknown). */
function decide({ env = {}, isProd = false, hasDb = false, hasMigrations = false, dbHasTables = null } = {}) {
  const flag = (k, d) => String(env[k] === undefined || env[k] === "" ? d : env[k]) === "1";
  const plan = { generate: false, schema: "none", backupRequired: false, json2db: false, notes: [] };
  if (!hasDb) { plan.notes.push("DATABASE_URL not set: database steps skipped"); return plan; }
  plan.generate = flag("PRISMA_GENERATE", "1");
  plan.json2db = flag("AUTO_JSON_MIGRATION", "1");
  if (flag("PRISMA_DB_PUSH", "1")) plan.schema = hasMigrations ? "migrate-deploy" : "db-push";
  else plan.notes.push("PRISMA_DB_PUSH=0: schema step skipped");
  if (plan.schema === "db-push") plan.notes.push("no prisma/migrations in the repository: using db push (non-destructive mode, never --accept-data-loss)");
  plan.backupRequired = plan.schema !== "none" && isProd && dbHasTables !== false;
  if (plan.backupRequired && dbHasTables === null) plan.notes.push("could not tell whether the database is empty: treating it as non-empty");
  return plan;
}

/** Whether the database already has user tables. null when it cannot be determined (never guessed). */
async function detectDbHasTables(url, { timeoutMs = 8000 } = {}) {
  let Client;
  try { ({ Client } = require("pg")); } catch (_e) { return null; }
  const c = new Client({ connectionString: url, connectionTimeoutMillis: timeoutMs });
  try {
    await c.connect();
    const r = await c.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema')");
    return r.rows[0].n > 0;
  } catch (_e) { return null; } finally { try { await c.end(); } catch (_e) { /* not connected */ } }
}

/**
 * @param {{plan:object, dp:object, run:(cmd:string,args:string[])=>void, log?:Function}} o  run() throws on a non-zero exit
 * @returns {Promise<{ok:boolean, code?:string, error?:string, backupId?:string|null, schema?:string}>}
 */
async function execute({ plan, dp, run, log = () => {} }) {
  let backupId = null;
  if (plan.generate) run("npx", ["prisma", "generate"]);
  if (plan.schema !== "none") {
    if (plan.backupRequired) {
      const b = await dp.createBackup({ reason: "automatic backup before database schema change (" + plan.schema + ")", actor: "prestart", includeUploads: false, database: true });
      if (!b.ok) {
        dp.recordEvent({ event: "db.schema.aborted", result: "failed", actor: "prestart", detail: { schema: plan.schema, failure: b.code } });
        return { ok: false, code: "BACKUP_FAILED", error: `database schema step NOT run: no verified backup (${b.code}). Install pg_dump (postgresql-client) and set BACKUP_ENCRYPTION_KEY, or set PRISMA_DB_PUSH=0 to skip schema changes.` };
      }
      backupId = b.id;
      log(`verified backup ${backupId} taken before the schema change`);
    }
    try {
      if (plan.schema === "migrate-deploy") run("npx", ["prisma", "migrate", "deploy"]);
      else run("npx", ["prisma", "db", "push"]);
    } catch (e) {
      dp.recordEvent({ event: "db.schema.failed", result: "failed", actor: "prestart", id: backupId || undefined, detail: { schema: plan.schema, error: String(e && e.message ? e.message : e).slice(0, 200) } });
      return { ok: false, code: "SCHEMA_FAILED", error: String(e && e.message ? e.message : e) + (backupId ? ` (restore the database from backup ${backupId}; see docs/DATA-PROTECTION.md)` : ""), backupId };
    }
    dp.recordEvent({ event: "db.schema.applied", actor: "prestart", id: backupId || undefined, detail: { schema: plan.schema, backupTaken: !!backupId } });
  }
  if (plan.json2db) run("node", ["scripts/migrate-json-to-db.js"]);
  return { ok: true, backupId, schema: plan.schema };
}

module.exports = { decide, execute, detectDbHasTables, hasPrismaMigrations };

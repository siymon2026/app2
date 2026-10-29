/*
  Production prestart checks & optional DB bootstrap.

  What it does:
  - Validates critical env vars (JWT_SECRET, PORT, and optionally DATABASE_URL)
  - Ensures logs/uploads dirs exist
  - Applies pending versioned DATA migrations (migrations/*.js) with a verified backup taken first (DATA_MIGRATIONS=0 skips)
  - If DATABASE_URL is set (or REQUIRE_DATABASE_URL=1), it will:
      - prisma generate
      - prisma migrate deploy (when prisma/migrations exists) or prisma db push (when it does not)
        In production the schema step only runs after a VERIFIED database backup (see lib/db-bootstrap.js)
      - migrate JSON -> DB (best-effort upsert)

  Notes:
  - This script is safe to run multiple times.
  - You can disable any step using env flags below.
*/

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

require("dotenv").config();

const ROOT = path.join(__dirname, "..");
const isProd = String(process.env.NODE_ENV || "").toLowerCase() === "production";

function die(msg) {
  console.error(`[FATAL] ${msg}`);
  process.exit(1);
}

function requireNonEmpty(name) {
  const v = String(process.env[name] || "").trim();
  if (!v) die(`${name} is required`);
  return v;
}

function ensureInt(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    if (fallback !== undefined) return fallback;
    return;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0 || n > 65535) {
    die(`${name} must be an integer between 1 and 65535`);
  }
  return n;
}

// --- Validate env ---
if (isProd) {
  requireNonEmpty("JWT_SECRET");
}
ensureInt("PORT", 3000);

const requireDb = String(process.env.REQUIRE_DATABASE_URL || "").trim() === "1";
const hasDb = Boolean(String(process.env.DATABASE_URL || "").trim());
if (requireDb && !hasDb) {
  die("DATABASE_URL is required (REQUIRE_DATABASE_URL=1)");
}

// --- Ensure dirs ---
const uploadsDir = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : (isProd ? path.join(ROOT, "uploads") : path.join(ROOT, "public", "uploads"));

const logDir = process.env.LOG_DIR ? path.resolve(process.env.LOG_DIR) : path.join(ROOT, "logs");

try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch (_e) {}
try { fs.mkdirSync(logDir, { recursive: true }); } catch (_e) {}

// --- Data protection (spec section 21) ---
const { createFromEnv } = require("../lib/data-protection");
const { createMigrationRunnerFromEnv } = require("../lib/data-migrations");
const dbBootstrap = require("../lib/db-bootstrap");

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd: ROOT, shell: false, ...opts });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed with code ${r.status}`);
}

(async () => {
  const dp = createFromEnv({ rootDir: ROOT, env: process.env });
  try { dp.hardenPermissions(); } catch (e) { console.warn(`[WARN] permission hardening skipped: ${e.message || e}`); }
  if (isProd && !String(process.env.BACKUP_ENCRYPTION_KEY || "").trim()) {
    console.warn("[WARN] BACKUP_ENCRYPTION_KEY is not set: in production backups (and any migration/schema change that needs one) are refused until it is configured");
  }

  // 1) versioned data migrations: verified backup first, rollback on failure
  if (String(process.env.DATA_MIGRATIONS || "1") !== "0") {
    const r = await createMigrationRunnerFromEnv({ dp, rootDir: ROOT }).run({ actor: "prestart" });
    if (!r.ok) {
      const msg = `data migration failed (${r.code}): ${r.error}${r.rolledBack ? " - affected files were restored from backup " + r.backupId : ""}`;
      if (isProd) die(msg);
      console.warn(`[WARN] ${msg}`);
    } else if (!r.noop) {
      console.log(`[OK] data migrations applied: ${r.applied.join(", ")}${r.backupId ? " (verified backup " + r.backupId + ")" : ""}`);
    }
  }

  // 2) optional PostgreSQL schema + JSON mirror (guarded)
  const prismaEnabled = String(process.env.PRISMA_BOOTSTRAP || (hasDb ? "1" : "0")) === "1";
  if (prismaEnabled && hasDb) {
    try {
      const hasMigrations = dbBootstrap.hasPrismaMigrations(ROOT);
      const dbHasTables = isProd ? await dbBootstrap.detectDbHasTables(process.env.DATABASE_URL) : null;
      const plan = dbBootstrap.decide({ env: process.env, isProd, hasDb, hasMigrations, dbHasTables });
      plan.notes.forEach((n) => console.log(`[INFO] ${n}`));
      const res = await dbBootstrap.execute({ plan, dp, run, log: (m) => console.log(`[OK] ${m}`) });
      if (!res.ok) throw new Error(res.error);
    } catch (e) {
      // In production, prefer failing fast if DB is expected.
      if (isProd && (requireDb || String(process.env.FAIL_ON_DB_BOOTSTRAP_ERROR || "1") === "1")) die(e.message || String(e));
      console.warn(`[WARN] DB bootstrap skipped/failed: ${e.message || e}`);
    }
  }

  console.log("[OK] prestart checks done");
})().catch((e) => die(e && e.message ? e.message : String(e)));

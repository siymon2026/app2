"use strict";
/**
 * Data protection (spec section 21): verified backups, safe restore, integrity checks, backup/restore event log.
 *
 * What is protected: everything the application really stores (see docs/DATA-PROTECTION.md)
 *   data/            JSON stores, audit chain (data/audit), private documents (data/private_uploads)
 *   config.json      runtime configuration
 *   uploads/         public uploads (optional)
 *   PostgreSQL       pg_dump of DATABASE_URL (optional, only when pg_dump exists)
 *
 * Guarantees (all covered by tests/data-protection.test.js):
 *  - A backup is reported successful ONLY after it was re-read end to end (checksum of the file, decryption /
 *    authentication, every entry hashed against the manifest, JSON files parsed). Otherwise it is removed and an
 *    event "backup.failed" is recorded.
 *  - Encryption: AES-256-GCM, key derived with scrypt from BACKUP_ENCRYPTION_KEY (never stored, never logged).
 *    In production an unencrypted backup is refused unless BACKUP_ALLOW_UNENCRYPTED=1 is set explicitly.
 *  - Files are created 0600 inside a 0700 directory. Backups are never served over HTTP.
 *  - Restore never overwrites live data silently: default = extract to a NEW directory; "live" needs the backup id as
 *    confirmation, a stopped server, a fresh verified pre-restore backup, and it MOVES (never deletes) the current data aside.
 *  - Archive paths are validated (no "..", absolute paths, or unexpected roots) before anything is written.
 *  - Every backup / verify / restore / prune is appended to a hash-chained event log (backups/EVENTS.jsonl) and, when an
 *    audit log is supplied (server), to the main audit chain.
 *  - Nothing here deletes transaction records or audit segments; prune only removes old backup archives, only on request.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const zlib = require("zlib");
const { pipeline } = require("stream");
const { pipeline: pipelineP } = require("stream/promises");
const { Readable } = require("stream");
const { spawn, spawnSync } = require("child_process");
const { sanitize, canonical } = require("./audit-log");

const MAGIC_ENC = Buffer.from("SIYBKE1\n");
const MAGIC_PLAIN = Buffer.from("SIYBKP1\n");
const HEADER_ENC_LEN = 52; // magic 8 + salt 16 + iv 12 + key-check 16
const TAG_LEN = 16;
const KEYCHECK_LABEL = "siymon-backup-keycheck-v1";
const CHUNK = 64 * 1024;
const MAX_CHUNK = 1024 * 1024;
const MAX_MANIFEST = 64 * 1024 * 1024;
const MAX_JSON_CHECK = 32 * 1024 * 1024;
const ID_RE = /^siymon-backup-\d{8}T\d{6}Z-[0-9a-f]{6}$/;
const DB_ENTRY = "database/postgres.dump";
const GENESIS = "0".repeat(64);
const MIN_KEY_LEN = 32;
const LOCK_STALE_MS = 2 * 60 * 60 * 1000;

class DPError extends Error {
  constructor(code, message) { super(message || code); this.code = code; }
}

/** Classification of data (used by inventory and the integrity checks). */
const PROTECTED_RULES = Object.freeze([
  { re: /^audit\//, kind: "audit_log", protected: true },
  { re: /^(orders|topups|settlements)\.json$/, kind: "transaction_records", protected: true },
  { re: /^(customers|drivers)\.json$/, kind: "accounts_and_wallet_ledger", protected: true },
  { re: /^private_uploads\//, kind: "private_documents", sensitive: true },
  { re: /^(admins|refresh_tokens|restaurant_users)\.json$/, kind: "credentials", sensitive: true },
  { re: /^config\.json$/, kind: "configuration", sensitive: true },
]);

const sha256Hex = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
const u16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16BE(n); return b; };
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; };
const stamp = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
const isInside = (child, parent) => { const r = path.relative(path.resolve(parent), path.resolve(child)); return r === "" || (!!r && !r.startsWith("..") && !path.isAbsolute(r)); };
const errMsg = (e) => String(e && e.message ? e.message : e);

function deriveKey(passphrase, salt) { return crypto.scryptSync(Buffer.from(String(passphrase), "utf8"), salt, 32); }
function keyCheck(key) { return crypto.createHmac("sha256", key).update(KEYCHECK_LABEL).digest().subarray(0, 16); }

async function sha256File(file) {
  const h = crypto.createHash("sha256");
  await pipelineP(fs.createReadStream(file), h);
  return h.digest("hex");
}

/** Parses DATABASE_URL into libpq environment variables so no secret appears on a command line. */
function parseDatabaseUrl(url) {
  let u;
  try { u = new URL(String(url)); } catch (_e) { throw new DPError("DATABASE_URL_INVALID", "DATABASE_URL is not a valid URL"); }
  if (!/^postgres(ql)?:$/.test(u.protocol)) throw new DPError("DATABASE_URL_INVALID", "DATABASE_URL must be a postgres:// URL");
  const env = {
    PGHOST: u.hostname, PGPORT: u.port || "5432", PGUSER: decodeURIComponent(u.username || ""),
    PGPASSWORD: decodeURIComponent(u.password || ""), PGDATABASE: decodeURIComponent(u.pathname.replace(/^\//, "")),
  };
  const ssl = u.searchParams.get("sslmode");
  if (ssl) env.PGSSLMODE = ssl;
  return env;
}

/** Remove every occurrence of the given secrets from a message. */
function redact(msg, secrets) {
  let t = String(msg == null ? "" : msg);
  for (const s of secrets || []) if (s && String(s).length >= 4) t = t.split(String(s)).join("***");
  return t;
}

/** Reads a stream of Buffers byte-exactly. */
class ByteReader {
  constructor(iterable) { this.it = iterable[Symbol.asyncIterator](); this.buf = Buffer.alloc(0); this.done = false; }
  async fill(n) {
    while (this.buf.length < n && !this.done) {
      const { value, done } = await this.it.next();
      if (done) { this.done = true; break; }
      this.buf = this.buf.length ? Buffer.concat([this.buf, value]) : value;
    }
  }
  async read(n) {
    await this.fill(n);
    if (this.buf.length < n) throw new DPError("ARCHIVE_CORRUPT", "archive is truncated");
    const out = this.buf.subarray(0, n);
    this.buf = this.buf.subarray(n);
    return out;
  }
  async drain() {
    let extra = this.buf.length;
    this.buf = Buffer.alloc(0);
    while (!this.done) {
      const { value, done } = await this.it.next();
      if (done) { this.done = true; break; }
      extra += value.length;
    }
    return extra;
  }
}

/** Validates an archive path and returns its parts. Only data/, uploads/, config.json and the database dump are allowed. */
function safeRel(rel) {
  if (typeof rel !== "string" || !rel || rel.length > 1000 || rel.includes("\0") || rel.includes("\\") || rel.startsWith("/") || /^[a-zA-Z]:/.test(rel)) throw new DPError("UNSAFE_PATH", "unsafe path in archive");
  const parts = rel.split("/");
  if (parts.some((p) => p === "" || p === "." || p === "..")) throw new DPError("UNSAFE_PATH", "unsafe path in archive");
  if (!(parts[0] === "data" || parts[0] === "uploads" || rel === "config.json" || rel === DB_ENTRY)) throw new DPError("UNSAFE_PATH", "unexpected location in archive");
  return parts;
}

/** Walks a directory (no symlinks, no lock/temp files), returns [{rel, abs}] sorted. */
function walk(dir, prefix, skipDirs = []) {
  const out = [];
  const rec = (abs, rel) => {
    let items = [];
    try { items = fs.readdirSync(abs, { withFileTypes: true }); } catch (_e) { return; }
    for (const it of items) {
      const a = path.join(abs, it.name);
      const r = rel ? rel + "/" + it.name : it.name;
      if (skipDirs.some((s) => isInside(a, s))) continue;
      if (it.isSymbolicLink()) continue;
      if (it.isDirectory()) rec(a, r);
      else if (it.isFile()) {
        if (/\.(lock|tmp|partial)$/.test(it.name)) continue;
        out.push({ rel: prefix + "/" + r, abs: a });
      }
    }
  };
  rec(dir, "");
  return out.sort((x, y) => (x.rel < y.rel ? -1 : x.rel > y.rel ? 1 : 0));
}

/**
 * A data file that exists but cannot be parsed is copied aside BEFORE the application overwrites it
 * (readJson() returns the fallback for unreadable files, so the next save would otherwise destroy the evidence).
 * Returns the quarantine path or null.
 */
function quarantineIfCorrupt(file, { logger = null, now = () => new Date() } = {}) {
  let raw;
  try { raw = fs.readFileSync(file); } catch (_e) { return null; } // missing file: nothing to protect
  try { JSON.parse(raw.toString("utf8")); return null; } catch (_e) { /* corrupt, keep a copy */ }
  const dest = `${file}.corrupt-${stamp(now())}`;
  try {
    fs.writeFileSync(dest, raw, { mode: 0o600 });
    if (logger && logger.error) logger.error("data file unreadable: copy preserved before it is overwritten", { file: path.basename(file), preserved: path.basename(dest), bytes: raw.length });
    return dest;
  } catch (e) {
    if (logger && logger.error) logger.error("could not preserve unreadable data file", { file: path.basename(file), error: errMsg(e) });
    return null;
  }
}

function readAuditSeq(dataDir) {
  try { const h = JSON.parse(fs.readFileSync(path.join(dataDir, "audit", "HEAD.json"), "utf8")); return Number.isFinite(Number(h.seq)) ? Number(h.seq) : null; } catch (_e) { return null; }
}

/** Counters of records that must never shrink. null = file absent, "unreadable" = present but not parseable. */
function protectedCounts(dataDir) {
  const rd = (f) => {
    const p = path.join(dataDir, f);
    if (!fs.existsSync(p)) return null;
    try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (_e) { return "unreadable"; }
  };
  const len = (o, k) => (o === null ? null : o === "unreadable" ? "unreadable" : Array.isArray(o[k]) ? o[k].length : 0);
  const ledger = (arr) => (Array.isArray(arr) ? arr.reduce((n, x) => n + (x && Array.isArray(x.walletHistory) ? x.walletHistory.length : 0), 0) : 0);
  const orders = rd("orders.json"), topups = rd("topups.json"), settlements = rd("settlements.json"), customers = rd("customers.json"), drivers = rd("drivers.json");
  const bad = (o) => o === "unreadable";
  return {
    orders: len(orders, "orders"), topups: len(topups, "topups"), settlements: len(settlements, "settlements"),
    ledgerEntries: bad(customers) || bad(drivers) ? "unreadable" : (customers === null && drivers === null) ? null : ledger(customers && customers.customers) + ledger(customers && customers.deletedCustomers) + ledger(drivers && drivers.drivers),
    auditSeq: readAuditSeq(dataDir),
  };
}

/** Compares two protectedCounts() snapshots. Anything that went down (or became unreadable) is a possible loss. */
function protectedRegressions(prev, curr) {
  const out = [];
  for (const k of Object.keys(prev || {})) {
    const a = prev[k], b = curr ? curr[k] : null;
    if (typeof a !== "number") continue;
    if (b === "unreadable") out.push({ counter: k, before: a, after: "unreadable" });
    else if (b === null || b === undefined) out.push({ counter: k, before: a, after: "missing" });
    else if (typeof b === "number" && b < a) out.push({ counter: k, before: a, after: b });
  }
  return out;
}

function createDataProtection(opts = {}) {
  const rootDir = path.resolve(opts.rootDir || process.cwd());
  const dataDir = path.resolve(opts.dataDir || path.join(rootDir, "data"));
  const configFile = path.resolve(opts.configFile || path.join(rootDir, "config.json"));
  const uploadsDir = opts.uploadsDir ? path.resolve(opts.uploadsDir) : null;
  const backupDir = path.resolve(opts.backupDir || path.join(rootDir, "backups"));
  const env = opts.env || process.env;
  const logger = opts.logger || null;
  const audit = opts.audit || null;
  const auditHmacKey = opts.auditHmacKey !== undefined ? opts.auditHmacKey : (env.AUDIT_HMAC_KEY || "");
  const clock = opts.now || (() => new Date());
  const encryptionKey = opts.encryptionKey !== undefined ? opts.encryptionKey : String(env.BACKUP_ENCRYPTION_KEY || "");
  const requireEncryption = opts.requireEncryption !== undefined ? !!opts.requireEncryption : String(env.NODE_ENV || "").toLowerCase() === "production";
  const allowUnencrypted = opts.allowUnencrypted !== undefined ? !!opts.allowUnencrypted : String(env.BACKUP_ALLOW_UNENCRYPTED || "") === "1";
  const databaseUrl = opts.databaseUrl !== undefined ? opts.databaseUrl : String(env.DATABASE_URL || "");
  const pgDumpBin = opts.pgDumpBin || "pg_dump";
  const eventsFile = path.join(backupDir, "EVENTS.jsonl");
  const lockFile = path.join(backupDir, ".lock");
  const log = (lvl, msg, meta) => { if (logger && logger[lvl]) logger[lvl](msg, meta); };

  const paths = (id) => {
    if (!ID_RE.test(String(id || ""))) throw new DPError("INVALID_ID", "invalid backup id");
    return { file: path.join(backupDir, id + ".siybk"), meta: path.join(backupDir, id + ".meta.json") };
  };
  const normActor = (a) => {
    if (a && typeof a === "object") return { id: String(a.id || "system").slice(0, 80), role: String(a.role || "").slice(0, 40), ip: String(a.ip || "").slice(0, 60), type: String(a.type || (a.role ? "admin" : "system")).slice(0, 20) };
    return { id: String(a || "system").slice(0, 80), role: "", ip: "", type: "system" };
  };

  function ensureBackupDir() {
    fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
    try { fs.chmodSync(backupDir, 0o700); } catch (_e) { /* best effort (non-POSIX) */ }
  }

  // ------------------------------------------------------------------ events (hash-chained, append-only)
  function readEvents() {
    let txt = "";
    try { txt = fs.readFileSync(eventsFile, "utf8"); } catch (_e) { return []; }
    const out = [];
    for (const line of txt.split("\n")) {
      if (!line.trim()) continue;
      try { out.push(JSON.parse(line)); } catch (_e) { out.push({ unreadable: true, raw: line.slice(0, 120) }); }
    }
    return out;
  }
  const evHash = (prev, rec) => sha256Hex(prev + "\n" + canonical(rec));

  /** Appends one event. Never throws (an event-log failure must not break a backup), but reports through the logger. */
  function recordEvent(ev) {
    try {
      ensureBackupDir();
      const rows = readEvents();
      const last = rows[rows.length - 1];
      const prev = last && last.hash ? last.hash : (last ? "UNREADABLE_TAIL" : GENESIS);
      const actor = normActor(ev.actor);
      const detail = sanitize(ev.detail || {});
      const base = { seq: (last && Number(last.seq) ? Number(last.seq) : 0) + 1, at: clock().toISOString(), event: String(ev.event), result: String(ev.result || "ok"), actor, ...(ev.id ? { id: ev.id } : {}), detail, prev };
      base.hash = evHash(prev, (({ hash, ...r }) => r)(base));
      fs.appendFileSync(eventsFile, JSON.stringify(base) + "\n", { encoding: "utf8", mode: 0o600 });
      if (audit && audit.append) {
        try { audit.append({ actorType: actor.type, actorId: actor.id, role: actor.role, ip: actor.ip, action: base.event, result: base.result, targetId: ev.id || null, ...detail }); } catch (_e) { /* audit is best effort here */ }
      }
      return base;
    } catch (e) {
      log("error", "backup event not recorded", { event: ev && ev.event, error: errMsg(e) });
      return null;
    }
  }
  function verifyEvents() {
    const rows = readEvents();
    let prev = GENESIS;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r.unreadable) return { ok: false, count: rows.length, brokenAt: i + 1, reason: "unreadable_record" };
      if (r.prev !== prev) return { ok: false, count: rows.length, brokenAt: r.seq, reason: "chain_broken" };
      if (evHash(prev, (({ hash, ...x }) => x)(r)) !== r.hash) return { ok: false, count: rows.length, brokenAt: r.seq, reason: "record_modified" };
      prev = r.hash;
    }
    return { ok: true, count: rows.length };
  }
  function listEvents({ limit = 100 } = {}) {
    const rows = readEvents().filter((r) => !r.unreadable);
    return rows.slice(-Math.max(1, Math.min(1000, Number(limit) || 100))).reverse();
  }

  // ------------------------------------------------------------------ locking
  function acquireLock(what) {
    ensureBackupDir();
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const fd = fs.openSync(lockFile, "wx", 0o600);
        fs.writeSync(fd, JSON.stringify({ pid: process.pid, what, at: clock().toISOString() }));
        fs.closeSync(fd);
        return () => { try { fs.unlinkSync(lockFile); } catch (_e) { /* already gone */ } };
      } catch (e) {
        if (e.code !== "EEXIST") throw e;
        let age = 0, info = {};
        try { age = Date.now() - fs.statSync(lockFile).mtimeMs; info = JSON.parse(fs.readFileSync(lockFile, "utf8")); } catch (_e) { /* unreadable lock */ }
        let alive = true;
        if (info.pid) { try { process.kill(info.pid, 0); } catch (_e) { alive = false; } }
        if (age > LOCK_STALE_MS || (!alive && info.pid)) { try { fs.unlinkSync(lockFile); } catch (_e) { /* race */ } continue; }
        throw new DPError("BACKUP_IN_PROGRESS", "another backup/restore operation is running (" + (info.what || "unknown") + ")");
      }
    }
    throw new DPError("BACKUP_IN_PROGRESS", "could not acquire the backup lock");
  }

  // ------------------------------------------------------------------ inventory
  function classify(rel) {
    for (const r of PROTECTED_RULES) if (r.re.test(rel)) return { kind: r.kind, protected: !!r.protected, sensitive: !!r.sensitive || !!r.protected };
    return { kind: "application_data", protected: false, sensitive: false };
  }
  /** Identifies the affected data: every file that a backup contains, with size, record count, classification, validity. */
  function inventory({ includeUploads = false } = {}) {
    const files = [];
    const skip = [backupDir];
    const add = (rel, abs) => {
      let st; try { st = fs.statSync(abs); } catch (_e) { return; }
      const row = { path: rel, bytes: st.size, ...classify(rel.replace(/^data\//, "")) };
      if (/\.json$/.test(rel) && st.size <= MAX_JSON_CHECK) {
        try {
          const v = JSON.parse(fs.readFileSync(abs, "utf8"));
          row.valid = true;
          if (Array.isArray(v)) row.records = v.length;
          else if (v && typeof v === "object") { const arrs = Object.entries(v).filter(([, x]) => Array.isArray(x)); if (arrs.length) row.records = Object.fromEntries(arrs.map(([k, x]) => [k, x.length])); }
        } catch (_e) { row.valid = false; }
      }
      files.push(row);
    };
    for (const f of walk(dataDir, "data", skip)) add(f.rel, f.abs);
    if (fs.existsSync(configFile)) add("config.json", configFile);
    if (includeUploads && uploadsDir && fs.existsSync(uploadsDir)) for (const f of walk(uploadsDir, "uploads", skip)) add(f.rel, f.abs);
    const total = files.reduce((n, f) => n + f.bytes, 0);
    return { files, totals: { files: files.length, bytes: total, protected: files.filter((f) => f.protected).length, sensitive: files.filter((f) => f.sensitive).length, unreadableJson: files.filter((f) => f.valid === false).map((f) => f.path) } };
  }

  // ------------------------------------------------------------------ database dump
  function dbStatus() {
    const configured = !!String(databaseUrl || "").trim();
    let available = false;
    try { const r = spawnSync(pgDumpBin, ["--version"], { encoding: "utf8", timeout: 10000 }); available = !r.error && r.status === 0; } catch (_e) { available = false; }
    return { configured, pgDumpAvailable: available };
  }
  function childEnv(pgEnv) {
    const e = { ...process.env };
    delete e.DATABASE_URL; delete e.BACKUP_ENCRYPTION_KEY; delete e.AUDIT_HMAC_KEY; delete e.JWT_SECRET;
    return { ...e, ...pgEnv };
  }

  // ------------------------------------------------------------------ backup creation
  function resolveDatabasePlan(want) {
    if (want === false) return { include: false, reason: "excluded by request" };
    const st = dbStatus();
    if (!st.configured) { if (want === true) throw new DPError("DATABASE_NOT_CONFIGURED", "database backup requested but DATABASE_URL is not set"); return { include: false, reason: "DATABASE_URL not set" }; }
    if (!st.pgDumpAvailable) { if (want === true) throw new DPError("PG_DUMP_UNAVAILABLE", "database backup requested but pg_dump is not available"); return { include: false, reason: "pg_dump not available" }; }
    return { include: true };
  }

  /**
   * Creates an encrypted backup and verifies it. Returns { ok:true, id, ... } or { ok:false, code, error }. Never throws.
   * @param {{reason?:string, actor?:any, includeUploads?:boolean, database?:"auto"|boolean}} o
   */
  async function createBackup(o = {}) {
    const actor = normActor(o.actor);
    const reason = String(o.reason || "manual").slice(0, 200);
    let release = null, id = null, finalFile = null, metaFile = null, partial = null;
    try {
      const encrypted = !!encryptionKey;
      if (encrypted && String(encryptionKey).length < MIN_KEY_LEN) throw new DPError("ENCRYPTION_KEY_WEAK", `BACKUP_ENCRYPTION_KEY must be at least ${MIN_KEY_LEN} characters`);
      if (!encrypted && requireEncryption && !allowUnencrypted) throw new DPError("ENCRYPTION_KEY_REQUIRED", "BACKUP_ENCRYPTION_KEY is required to create backups in production");
      const dbWant = o.database === undefined ? "auto" : o.database;
      const dbPlan = resolveDatabasePlan(dbWant === "auto" ? "auto" : !!dbWant);
      release = acquireLock("backup");
      const includeUploads = o.includeUploads !== false;
      const now = clock();
      id = `siymon-backup-${stamp(now)}-${crypto.randomBytes(3).toString("hex")}`;
      ({ file: finalFile, meta: metaFile } = paths(id));
      partial = finalFile + ".partial";
      recordEvent({ event: "backup.started", actor, id, detail: { reason, encrypted, includeUploads, database: dbPlan.include } });

      const entries = [];
      for (const f of walk(dataDir, "data", [backupDir])) entries.push(f);
      if (fs.existsSync(configFile)) entries.push({ rel: "config.json", abs: configFile });
      if (includeUploads && uploadsDir && fs.existsSync(uploadsDir)) for (const f of walk(uploadsDir, "uploads", [backupDir])) entries.push(f);
      const state = { files: [], skipped: [], database: dbPlan.include ? { included: true } : { included: false, reason: dbPlan.reason } };
      const counts = protectedCounts(dataDir);

      // header
      let key = null, iv = null, header;
      if (encrypted) {
        const salt = crypto.randomBytes(16); iv = crypto.randomBytes(12); key = deriveKey(encryptionKey, salt);
        header = Buffer.concat([MAGIC_ENC, salt, iv, keyCheck(key)]);
      } else header = MAGIC_PLAIN;
      fs.writeFileSync(partial, header, { mode: 0o600 });

      async function* frames() {
        for (const e of entries) {
          let fh;
          try { fh = await fs.promises.open(e.abs, "r"); } catch (err) { state.skipped.push({ path: e.rel, reason: err.code || "open_failed" }); continue; }
          try {
            const st = await fh.stat();
            if (!st.isFile()) { state.skipped.push({ path: e.rel, reason: "not_a_regular_file" }); continue; }
            const pb = Buffer.from(e.rel, "utf8");
            const mode = st.mode & 0o777;
            yield Buffer.concat([Buffer.from([1]), u16(pb.length), pb, u32(mode)]);
            const hash = crypto.createHash("sha256");
            let remaining = st.size, total = 0;
            const buf = Buffer.allocUnsafe(CHUNK);
            while (remaining > 0) {
              const { bytesRead } = await fh.read(buf, 0, Math.min(CHUNK, remaining), null);
              if (!bytesRead) break;
              remaining -= bytesRead; total += bytesRead;
              const piece = buf.subarray(0, bytesRead);
              hash.update(piece);
              const out = Buffer.allocUnsafe(4 + bytesRead);
              out.writeUInt32BE(bytesRead, 0); piece.copy(out, 4);
              yield out;
            }
            yield u32(0);
            state.files.push({ path: e.rel, size: total, sha256: hash.digest("hex"), mode });
          } finally { await fh.close().catch(() => {}); }
        }
        if (dbPlan.include) yield* dbFrames();
        const manifest = {
          format: 1, id, createdAt: now.toISOString(), reason, actor: { id: actor.id, role: actor.role }, encrypted,
          app: { name: "siymon", version: String(opts.appVersion || "") },
          includeUploads, files: state.files, skipped: state.skipped,
          totals: { files: state.files.length, bytes: state.files.reduce((n, f) => n + f.size, 0) },
          database: state.database, protectedCounts: counts,
        };
        const mb = Buffer.from(JSON.stringify(manifest), "utf8");
        yield Buffer.concat([Buffer.from([0xff]), u32(mb.length), mb]);
      }
      async function* dbFrames() {
        const pgEnv = parseDatabaseUrl(databaseUrl);
        const secrets = [pgEnv.PGPASSWORD];
        const child = spawn(pgDumpBin, ["--format=custom", "--no-password"], { env: childEnv(pgEnv), stdio: ["ignore", "pipe", "pipe"], shell: false });
        let stderr = "";
        child.stderr.on("data", (d) => { if (stderr.length < 4000) stderr += d.toString(); });
        const exited = new Promise((resolve) => { child.on("error", (e) => resolve({ error: e })); child.on("close", (code) => resolve({ code })); });
        const pb = Buffer.from(DB_ENTRY, "utf8");
        yield Buffer.concat([Buffer.from([1]), u16(pb.length), pb, u32(0o600)]);
        const hash = crypto.createHash("sha256"); let total = 0;
        for await (const c of child.stdout) {
          for (let o = 0; o < c.length; o += CHUNK) {
            const piece = c.subarray(o, Math.min(c.length, o + CHUNK));
            hash.update(piece); total += piece.length;
            yield Buffer.concat([u32(piece.length), piece]);
          }
        }
        const r = await exited;
        if (r.error || r.code !== 0) throw new DPError("DB_DUMP_FAILED", "pg_dump failed: " + redact(r.error ? errMsg(r.error) : (stderr.trim().slice(0, 300) || "exit code " + r.code), secrets));
        yield u32(0);
        const entry = { path: DB_ENTRY, size: total, sha256: hash.digest("hex"), mode: 0o600 };
        state.files.push(entry);
        state.database = { included: true, format: "pg_dump custom", size: total, sha256: entry.sha256 };
      }

      const stages = [Readable.from(frames(), { objectMode: false }), zlib.createGzip({ level: 6 })];
      let cipher = null;
      if (encrypted) { cipher = crypto.createCipheriv("aes-256-gcm", key, iv); stages.push(cipher); }
      stages.push(fs.createWriteStream(partial, { flags: "a", mode: 0o600 }));
      await pipelineP(...stages);
      if (cipher) fs.appendFileSync(partial, cipher.getAuthTag());
      fs.renameSync(partial, finalFile); partial = null;
      try { fs.chmodSync(finalFile, 0o600); } catch (_e) { /* best effort */ }

      const bytes = fs.statSync(finalFile).size;
      const meta = {
        id, createdAt: now.toISOString(), reason, actor: { id: actor.id, role: actor.role }, bytes, sha256: await sha256File(finalFile),
        encrypted, includeUploads, files: state.files.length, dataBytes: state.files.reduce((n, f) => n + f.size, 0),
        database: state.database, skipped: state.skipped.length, protectedCounts: counts, verified: null,
      };
      writeMeta(metaFile, meta);

      const v = await verifyBackup(id, { quiet: true, actor });
      if (!v.ok) throw new DPError("VERIFY_FAILED", `backup verification failed (${v.code}); the archive was discarded`);
      const result = { ok: true, id, bytes, files: meta.files, dataBytes: meta.dataBytes, encrypted, includeUploads, database: state.database, warnings: v.warnings, verifiedAt: v.verifiedAt, protectedCounts: counts };
      recordEvent({ event: "backup.created", actor, id, detail: { reason, bytes, files: meta.files, encrypted, database: state.database.included, warnings: v.warnings.length } });
      return result;
    } catch (e) {
      const code = e && e.code && /^[A-Z_]+$/.test(e.code) ? e.code : "BACKUP_FAILED";
      for (const f of [partial, finalFile, metaFile]) { if (f) { try { fs.unlinkSync(f); } catch (_e) { /* not created */ } } }
      if (code !== "BACKUP_IN_PROGRESS") recordEvent({ event: "backup.failed", result: "failed", actor, id: id || undefined, detail: { reason, failure: code, error: redact(errMsg(e), [encryptionKey]) } });
      log("error", "backup failed", { code, error: redact(errMsg(e), [encryptionKey]) });
      return { ok: false, code, error: redact(errMsg(e), [encryptionKey]) };
    } finally { if (release) release(); }
  }

  function writeMeta(file, meta) {
    const tmp = file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(meta, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, file);
  }
  function readMeta(file) { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (_e) { return null; } }

  // ------------------------------------------------------------------ reading archives
  /**
   * Streams an archive: decrypts, authenticates, parses every entry, hashes it, optionally hands bytes to a sink.
   * Throws DPError with a precise code. Resolves { files:[{path,size,sha256,mode,jsonValid}], manifest, encrypted }.
   */
  async function scanArchive(file, { onFile = null } = {}) {
    const st = fs.statSync(file);
    const head = Buffer.alloc(HEADER_ENC_LEN);
    const fd = fs.openSync(file, "r");
    try { fs.readSync(fd, head, 0, HEADER_ENC_LEN, 0); } finally { fs.closeSync(fd); }
    let encrypted, start, end, decipher = null;
    if (head.subarray(0, 8).equals(MAGIC_ENC)) {
      encrypted = true;
      if (!encryptionKey) throw new DPError("KEY_REQUIRED", "this backup is encrypted: BACKUP_ENCRYPTION_KEY is required");
      if (st.size < HEADER_ENC_LEN + TAG_LEN + 1) throw new DPError("ARCHIVE_CORRUPT", "archive is too short");
      const salt = head.subarray(8, 24), iv = head.subarray(24, 36), kc = head.subarray(36, 52);
      const key = deriveKey(encryptionKey, salt);
      if (!crypto.timingSafeEqual(keyCheck(key), kc)) throw new DPError("KEY_MISMATCH", "BACKUP_ENCRYPTION_KEY does not match this backup");
      const tag = Buffer.alloc(TAG_LEN);
      const fd2 = fs.openSync(file, "r");
      try { fs.readSync(fd2, tag, 0, TAG_LEN, st.size - TAG_LEN); } finally { fs.closeSync(fd2); }
      decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);
      start = HEADER_ENC_LEN; end = st.size - TAG_LEN - 1;
    } else if (head.subarray(0, 8).equals(MAGIC_PLAIN)) {
      encrypted = false; start = 8; end = st.size - 1;
      if (end < start) throw new DPError("ARCHIVE_CORRUPT", "archive is too short");
    } else throw new DPError("ARCHIVE_CORRUPT", "unknown backup format");

    const rs = fs.createReadStream(file, { start, end });
    const gunzip = zlib.createGunzip();
    const chain = decipher ? [rs, decipher, gunzip] : [rs, gunzip];
    const last = pipeline(...chain, () => {}); // errors are delivered through the async iterator below
    const rd = new ByteReader(last);
    const files = [];
    let manifest = null;
    try {
      for (;;) {
        const t = (await rd.read(1))[0];
        if (t === 0xff) {
          const n = (await rd.read(4)).readUInt32BE(0);
          if (n > MAX_MANIFEST) throw new DPError("ARCHIVE_CORRUPT", "manifest too large");
          try { manifest = JSON.parse((await rd.read(n)).toString("utf8")); } catch (_e) { throw new DPError("ARCHIVE_CORRUPT", "manifest unreadable"); }
          break;
        }
        if (t !== 1) throw new DPError("ARCHIVE_CORRUPT", "unexpected data in archive");
        const pl = (await rd.read(2)).readUInt16BE(0);
        const rel = (await rd.read(pl)).toString("utf8");
        const mode = (await rd.read(4)).readUInt32BE(0);
        const sink = onFile ? await onFile(rel, mode) : null;
        const hash = crypto.createHash("sha256");
        let size = 0, jsonParts = /\.json$/.test(rel) ? [] : null, jsonLen = 0, jsonSkipped = false, firstChunk = null;
        try {
          for (;;) {
            const n = (await rd.read(4)).readUInt32BE(0);
            if (n === 0) break;
            if (n > MAX_CHUNK) throw new DPError("ARCHIVE_CORRUPT", "chunk too large");
            const chunk = await rd.read(n);
            if (!firstChunk) firstChunk = Buffer.from(chunk.subarray(0, 8));
            hash.update(chunk); size += n;
            if (sink) await sink.write(chunk);
            if (jsonParts) { jsonLen += n; if (jsonLen > MAX_JSON_CHECK) { jsonParts = null; jsonSkipped = true; } else jsonParts.push(Buffer.from(chunk)); }
          }
        } catch (e) { if (sink && sink.abort) await sink.abort(); throw e; }
        if (sink) await sink.end();
        const row = { path: rel, size, sha256: hash.digest("hex"), mode };
        if (rel === DB_ENTRY) row.magicOk = !!firstChunk && firstChunk.subarray(0, 5).toString("latin1") === "PGDMP";
        if (/\.json$/.test(rel)) {
          if (jsonSkipped) row.jsonValid = null;
          else { try { JSON.parse(Buffer.concat(jsonParts).toString("utf8")); row.jsonValid = true; } catch (_e) { row.jsonValid = false; } }
        }
        files.push(row);
      }
      const extra = await rd.drain(); // reads to the end so that the GCM tag is verified
      if (extra > 0) throw new DPError("ARCHIVE_CORRUPT", "unexpected trailing data");
    } catch (e) {
      rs.destroy(); gunzip.destroy();
      if (e instanceof DPError) throw e;
      const m = errMsg(e);
      if (/authenticate|Unsupported state/i.test(m)) throw new DPError("ARCHIVE_TAMPERED", "archive failed authentication (modified or wrong key)");
      throw new DPError("ARCHIVE_CORRUPT", "archive could not be read: " + m.slice(0, 120));
    }
    return { files, manifest, encrypted };
  }

  function compareWithManifest(files, manifest) {
    const problems = [];
    if (!manifest || !Array.isArray(manifest.files)) return [{ path: "(manifest)", problem: "missing" }];
    const got = new Map(files.map((f) => [f.path, f]));
    const want = new Map(manifest.files.map((f) => [f.path, f]));
    for (const [p, w] of want) {
      const g = got.get(p);
      if (!g) problems.push({ path: p, problem: "missing_in_archive" });
      else if (g.size !== w.size || g.sha256 !== w.sha256) problems.push({ path: p, problem: "content_mismatch" });
    }
    for (const p of got.keys()) if (!want.has(p)) problems.push({ path: p, problem: "not_in_manifest" });
    return problems;
  }

  /** Full verification of a stored backup. Records an event unless quiet. */
  async function verifyBackup(id, o = {}) {
    const actor = normActor(o.actor);
    const done = (r) => {
      if (!o.quiet || !r.ok) recordEvent({ event: r.ok ? "backup.verified" : "backup.verify_failed", result: r.ok ? "ok" : "failed", actor, id: String(id || "").slice(0, 60), detail: r.ok ? { files: r.files, bytes: r.bytes, warnings: r.warnings.length } : { failure: r.code } });
      return r;
    };
    let p;
    try { p = paths(id); } catch (e) { return { ok: false, code: e.code, error: e.message }; }
    const meta = readMeta(p.meta);
    if (!meta) return done({ ok: false, code: "META_MISSING", error: "backup metadata is missing or unreadable" });
    if (!fs.existsSync(p.file)) return done({ ok: false, code: "FILE_MISSING", error: "backup archive is missing" });
    try {
      const sum = await sha256File(p.file);
      if (sum !== meta.sha256) return done({ ok: false, code: "FILE_CHECKSUM_MISMATCH", error: "backup archive does not match its recorded checksum" });
      const scan = await scanArchive(p.file);
      const problems = compareWithManifest(scan.files, scan.manifest);
      if (problems.length) return done({ ok: false, code: "MANIFEST_MISMATCH", error: "archive content does not match its manifest", problems: problems.slice(0, 10) });
      if (scan.manifest.id !== id) return done({ ok: false, code: "MANIFEST_MISMATCH", error: "manifest belongs to a different backup" });
      const db = scan.files.find((f) => f.path === DB_ENTRY);
      if (db && !db.magicOk) return done({ ok: false, code: "DB_DUMP_INVALID", error: "database dump has an unexpected header" });
      const warnings = scan.files.filter((f) => f.jsonValid === false).map((f) => ({ path: f.path, warning: "json_unreadable_at_backup_time" }));
      const verifiedAt = clock().toISOString();
      writeMeta(p.meta, { ...meta, verified: { at: verifiedAt, ok: true, files: scan.files.length, warnings: warnings.length } });
      return done({ ok: true, id, files: scan.files.length, bytes: scan.files.reduce((n, f) => n + f.size, 0), encrypted: scan.encrypted, warnings, verifiedAt, database: scan.manifest.database || { included: false } });
    } catch (e) {
      return done({ ok: false, code: e.code && /^[A-Z_]+$/.test(e.code) ? e.code : "VERIFY_ERROR", error: redact(errMsg(e), [encryptionKey]) });
    }
  }

  /** Which of the given archive paths (e.g. "data/orders.json") are NOT inside the stored backup. */
  async function backupContains(id, rels) {
    const p = paths(id);
    const scan = await scanArchive(p.file);
    const have = new Set(scan.files.map((f) => f.path));
    return rels.filter((r) => !have.has(r));
  }

  function listBackups() {
    let names = [];
    try { names = fs.readdirSync(backupDir); } catch (_e) { return []; }
    const rows = [];
    for (const n of names) {
      const m = n.match(/^(siymon-backup-\d{8}T\d{6}Z-[0-9a-f]{6})\.meta\.json$/);
      if (!m) continue;
      const meta = readMeta(path.join(backupDir, n));
      if (!meta) { rows.push({ id: m[1], createdAt: null, unreadableMeta: true, archivePresent: fs.existsSync(path.join(backupDir, m[1] + ".siybk")) }); continue; }
      rows.push({ id: meta.id, createdAt: meta.createdAt, bytes: meta.bytes, encrypted: !!meta.encrypted, files: meta.files, includeUploads: !!meta.includeUploads, database: !!(meta.database && meta.database.included), reason: meta.reason, actor: meta.actor, verified: meta.verified || null, archivePresent: fs.existsSync(path.join(backupDir, meta.id + ".siybk")) });
    }
    return rows.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }
  const latestVerified = () => listBackups().find((b) => b.verified && b.verified.ok && b.archivePresent) || null;

  function status() {
    const db = dbStatus();
    const list = listBackups();
    const lastVerified = list.find((b) => b.verified && b.verified.ok && b.archivePresent);
    return {
      encryptionConfigured: !!encryptionKey && String(encryptionKey).length >= MIN_KEY_LEN,
      encryptionRequired: requireEncryption && !allowUnencrypted,
      database: db, backupCount: list.length,
      lastBackupAt: list[0] ? list[0].createdAt : null, lastVerifiedAt: lastVerified && lastVerified.verified ? lastVerified.verified.at : null,
      eventsIntegrity: verifyEvents(),
    };
  }

  // ------------------------------------------------------------------ restore
  const fileSink = (dest, mode) => {
    fs.mkdirSync(path.dirname(dest), { recursive: true, mode: 0o700 });
    const fd = fs.openSync(dest, "wx", ((mode & 0o777) | 0o600) & 0o777);
    return {
      write: async (b) => { fs.writeSync(fd, b); },
      end: async () => { fs.closeSync(fd); },
      abort: async () => { try { fs.closeSync(fd); } catch (_e) { /* closed */ } },
    };
  };
  const rmrf = (p) => { try { fs.rmSync(p, { recursive: true, force: true }); } catch (_e) { /* best effort */ } };

  /** Extracts selected archive entries into per-prefix staging locations. Verifies sizes and hashes against the manifest. */
  async function extractTo(file, dest, filter) {
    const written = [];
    const scan = await scanArchive(file, {
      onFile: async (rel, mode) => {
        safeRel(rel);
        if (filter && !filter(rel)) return null;
        const d = dest(rel);
        if (!d) return null;
        written.push(d);
        return fileSink(d, mode);
      },
    });
    const problems = compareWithManifest(scan.files, scan.manifest);
    if (problems.length) throw new DPError("MANIFEST_MISMATCH", "archive content does not match its manifest");
    return scan;
  }

  function verifyRestoredAudit(dir) {
    const auditDir = path.join(dir, "audit");
    if (!fs.existsSync(auditDir)) return { present: false };
    try {
      const { createAuditLog } = require("./audit-log");
      const v = createAuditLog({ dir: auditDir, hmacKey: auditHmacKey }).verify();
      return { present: true, ok: !!v.ok, records: v.count, reason: v.reason || null, brokenAt: v.brokenAt || null };
    } catch (e) { return { present: true, ok: false, reason: errMsg(e) }; }
  }

  /**
   * Restores a backup.
   *  mode "extract" (default): into a NEW directory (targetDir) laid out as data/, uploads/, config.json, database/.
   *  mode "live": swaps data/, config.json, uploads/ in place. Requires { live:true, confirm:<backup id>, serverStopped:true }.
   *     The current files are MOVED to "<name>.pre-restore-<stamp>" (never deleted) and a fresh verified backup is taken first.
   * The database dump is never restored automatically; its extracted path is returned (see docs).
   */
  async function restoreBackup(id, o = {}) {
    const actor = normActor(o.actor);
    const live = !!o.live;
    let release = null;
    const staged = []; // dirs/files created for staging, removed on failure
    try {
      const p = paths(id);
      if (live) {
        if (o.confirm !== id) throw new DPError("CONFIRMATION_REQUIRED", "live restore needs the backup id as explicit confirmation");
        if (o.serverStopped !== true) throw new DPError("SERVER_MUST_BE_STOPPED", "stop the application before a live restore, then confirm it is stopped");
      }
      const v = await verifyBackup(id, { actor, quiet: true });
      if (!v.ok) throw new DPError("VERIFY_FAILED", `backup did not pass verification (${v.code}); nothing was restored`);
      const only = Array.isArray(o.only) && o.only.length ? new Set(o.only.map((r) => { safeRel(r); return r; })) : null;
      const filter = only ? (rel) => only.has(rel) : null;
      const sfx = stamp(clock()) + "-" + crypto.randomBytes(2).toString("hex");

      if (!live) {
        const target = path.resolve(String(o.targetDir || path.join(backupDir, `restore-${id}-${sfx}`)));
        for (const live2 of [dataDir, uploadsDir, configFile].filter(Boolean)) {
          if (isInside(target, live2) || isInside(live2, target)) throw new DPError("UNSAFE_TARGET", "restore target must not overlap live data (use live mode)");
        }
        if (fs.existsSync(target) && fs.readdirSync(target).length) throw new DPError("TARGET_NOT_EMPTY", "restore target already exists and is not empty");
        release = acquireLock("restore");
        recordEvent({ event: "restore.started", actor, id, detail: { mode: "extract", only: only ? [...only] : null } });
        const tmp = target + ".partial-" + sfx;
        staged.push(tmp);
        const scan = await extractTo(p.file, (rel) => { safeRel(rel); const d = path.resolve(tmp, rel); if (!isInside(d, tmp)) throw new DPError("UNSAFE_PATH", "unsafe path"); return d; }, filter);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        if (fs.existsSync(target)) fs.rmdirSync(target);
        fs.renameSync(tmp, target); staged.length = 0;
        const auditCheck = verifyRestoredAudit(path.join(target, "data"));
        recordEvent({ event: "restore.completed", actor, id, detail: { mode: "extract", files: scan.files.length, target: path.basename(target), audit: auditCheck } });
        return { ok: true, mode: "extract", id, targetDir: target, files: scan.files.length, audit: auditCheck, database: scan.files.some((f) => f.path === DB_ENTRY) ? { dumpPath: path.join(target, DB_ENTRY), restored: false, note: "restore the database manually with pg_restore (see docs/DATA-PROTECTION.md)" } : { included: false } };
      }

      // ---- live
      release = acquireLock("restore");
      recordEvent({ event: "restore.started", actor, id, detail: { mode: "live", only: only ? [...only] : null } });
      release(); release = null; // createBackup takes the same lock
      const pre = await createBackup({ reason: `automatic safety backup before restoring ${id}`, actor, includeUploads: !only, database: false });
      if (!pre.ok) throw new DPError("PRE_RESTORE_BACKUP_FAILED", `could not create the safety backup (${pre.code}); nothing was restored`);
      release = acquireLock("restore");
      const targets = [];
      if (!only || [...only].some((r) => r.startsWith("data/"))) targets.push({ key: "data", live: dataDir, isDir: true });
      if (!only || only.has("config.json")) targets.push({ key: "config.json", live: configFile, isDir: false });
      if ((!only || [...only].some((r) => r.startsWith("uploads/"))) && uploadsDir) targets.push({ key: "uploads", live: uploadsDir, isDir: true });
      const stagedOf = (t) => `${t.live}.restore-${sfx}`;
      const dbOut = path.join(backupDir, `restore-${id}-${sfx}.database.dump`);
      const fullDirRestore = !only; // a partial restore overlays files instead of swapping directories
      for (const t of targets) staged.push(stagedOf(t));
      const scan = await extractTo(p.file, (rel) => {
        const parts = safeRel(rel);
        if (rel === DB_ENTRY) return dbOut;
        const t = targets.find((x) => x.key === parts[0] || x.key === rel);
        if (!t) return null;
        if (!t.isDir) return stagedOf(t);
        if (!fullDirRestore) return path.resolve(stagedOf(t), parts.slice(1).join("/"));
        const d = path.resolve(stagedOf(t), parts.slice(1).join("/"));
        if (!isInside(d, stagedOf(t))) throw new DPError("UNSAFE_PATH", "unsafe path");
        return d;
      }, filter);
      const swaps = [];
      try {
        for (const t of targets) {
          const s = stagedOf(t);
          if (!fs.existsSync(s)) { if (t.isDir) fs.mkdirSync(s, { recursive: true, mode: 0o700 }); else continue; }
          if (!fullDirRestore && t.isDir) {
            // partial restore: overlay the extracted files onto the live directory, keeping the replaced ones aside
            const keepDir = `${t.live}.pre-restore-${sfx}`;
            for (const f of walk(s, "x")) {
              const relIn = f.rel.slice(2);
              const dst = path.join(t.live, relIn);
              if (fs.existsSync(dst)) { const k = path.join(keepDir, relIn); fs.mkdirSync(path.dirname(k), { recursive: true }); fs.renameSync(dst, k); swaps.push({ undo: () => { fs.renameSync(k, dst); } }); }
              fs.mkdirSync(path.dirname(dst), { recursive: true });
              fs.renameSync(f.abs, dst);
              swaps.push({ undo: () => { fs.renameSync(dst, f.abs); } });
            }
            rmrf(s);
            continue;
          }
          const kept = `${t.live}.pre-restore-${sfx}`;
          let moved = false;
          if (fs.existsSync(t.live)) { fs.renameSync(t.live, kept); moved = true; }
          try { fs.renameSync(s, t.live); } catch (e) { if (moved) fs.renameSync(kept, t.live); throw e; }
          swaps.push({ undo: () => { fs.renameSync(t.live, `${t.live}.failed-restore-${sfx}`); if (moved) fs.renameSync(kept, t.live); }, kept: moved ? kept : null, live: t.live });
        }
      } catch (e) {
        for (const s of swaps.reverse()) { try { s.undo(); } catch (_e) { /* continue undoing */ } }
        throw new DPError("SWAP_FAILED", "could not put the restored files in place; the previous data was put back (" + errMsg(e).slice(0, 100) + ")");
      }
      staged.length = 0;
      try { hardenPermissions(); } catch (_e) { /* best effort */ }
      const auditCheck = verifyRestoredAudit(dataDir);
      const kept = swaps.filter((s) => s.kept).map((s) => path.basename(s.kept));
      recordEvent({ event: "restore.completed", actor, id, detail: { mode: "live", files: scan.files.length, preRestoreBackup: pre.id, previousDataKeptAs: kept, audit: auditCheck } });
      return { ok: true, mode: "live", id, files: scan.files.length, safetyBackupId: pre.id, previousKeptAs: swaps.filter((s) => s.kept).map((s) => s.kept), audit: auditCheck, database: scan.files.some((f) => f.path === DB_ENTRY) ? { dumpPath: dbOut, restored: false } : { included: false } };
    } catch (e) {
      for (const s of staged) rmrf(s);
      const code = e && e.code && /^[A-Z_]+$/.test(e.code) ? e.code : "RESTORE_FAILED";
      recordEvent({ event: "restore.failed", result: "failed", actor, id: String(id || "").slice(0, 60), detail: { failure: code, error: redact(errMsg(e), [encryptionKey]) } });
      return { ok: false, code, error: redact(errMsg(e), [encryptionKey]) };
    } finally { if (release) release(); }
  }

  // ------------------------------------------------------------------ retention (explicit only)
  /** Removes OLD BACKUP ARCHIVES only. Never touches data, transaction records or the audit log. Always keeps the newest verified one. */
  function pruneBackups({ keep = 5, actor = "system" } = {}) {
    const k = Math.max(3, Math.floor(Number(keep) || 0));
    const list = listBackups().filter((b) => !b.unreadableMeta);
    const removed = [];
    const newestVerified = list.find((b) => b.verified && b.verified.ok && b.archivePresent);
    list.slice(k).forEach((b) => {
      if (newestVerified && b.id === newestVerified.id) return;
      const p = paths(b.id);
      try { fs.unlinkSync(p.file); } catch (_e) { /* already gone */ }
      try { fs.unlinkSync(p.meta); } catch (_e) { /* already gone */ }
      removed.push(b.id);
      recordEvent({ event: "backup.pruned", actor, id: b.id, detail: { keep: k } });
    });
    return { ok: true, kept: list.length - removed.length, removed };
  }

  // ------------------------------------------------------------------ permissions
  /** Private data is owner-only. Public uploads are deliberately left alone (a web server may need to read them). */
  function hardenPermissions() {
    const changed = [];
    const set = (p, mode) => {
      try { const st = fs.statSync(p); if ((st.mode & 0o777) !== mode) { fs.chmodSync(p, mode); changed.push({ path: path.relative(rootDir, p) || ".", from: (st.mode & 0o777).toString(8), to: mode.toString(8) }); } } catch (_e) { /* missing or unsupported */ }
    };
    set(dataDir, 0o700);
    set(path.join(dataDir, "private_uploads"), 0o700);
    set(path.join(dataDir, "audit"), 0o700);
    set(configFile, 0o600);
    if (fs.existsSync(backupDir)) {
      set(backupDir, 0o700);
      try { for (const n of fs.readdirSync(backupDir)) { const f = path.join(backupDir, n); if (fs.statSync(f).isFile()) set(f, 0o600); } } catch (_e) { /* ignore */ }
    }
    if (changed.length) recordEvent({ event: "permissions.hardened", actor: "system", detail: { changed: changed.length } });
    return { changed };
  }

  // ------------------------------------------------------------------ integrity of protected records
  /** Compares the live counters of protected records with the latest verified backup and checks the audit chain. */
  function integrityReport() {
    const now = protectedCounts(dataDir);
    const last = latestVerified();
    let baseline = null, regressions = [];
    if (last) {
      const meta = readMeta(path.join(backupDir, last.id + ".meta.json"));
      baseline = meta && meta.protectedCounts ? { backupId: last.id, at: last.createdAt, counts: meta.protectedCounts } : null;
      if (baseline) regressions = protectedRegressions(baseline.counts, now);
    }
    let auditChain = { present: false };
    try { if (fs.existsSync(path.join(dataDir, "audit"))) { const v = require("./audit-log").createAuditLog({ dir: path.join(dataDir, "audit"), hmacKey: auditHmacKey }).verify(); auditChain = { present: true, ok: !!v.ok, records: v.count, reason: v.reason || null, brokenAt: v.brokenAt || null }; } } catch (e) { auditChain = { present: true, ok: false, reason: errMsg(e) }; }
    const unreadable = Object.entries(now).filter(([, v]) => v === "unreadable").map(([k]) => k);
    return { ok: !regressions.length && !unreadable.length && (!auditChain.present || auditChain.ok), counts: now, baseline, regressions, unreadable, auditChain, backupEvents: verifyEvents() };
  }

  return {
    paths: { rootDir, dataDir, configFile, uploadsDir, backupDir },
    inventory, createBackup, verifyBackup, restoreBackup, backupContains, listBackups, latestVerified, pruneBackups, status,
    listEvents, verifyEvents, recordEvent, hardenPermissions, integrityReport, dbStatus,
    protectedCounts: () => protectedCounts(dataDir),
    _scanArchive: scanArchive,
  };
}

/** Same path rules as server.js, for scripts that run without the server. */
function createFromEnv({ rootDir, env = process.env, ...rest } = {}) {
  const root = path.resolve(rootDir || process.cwd());
  const isProd = String(env.NODE_ENV || "").toLowerCase() === "production";
  return createDataProtection({
    rootDir: root, env,
    dataDir: path.join(root, "data"),
    configFile: path.join(root, "config.json"),
    uploadsDir: path.resolve(env.UPLOAD_DIR || (isProd ? path.join(root, "uploads") : path.join(root, "public", "uploads"))),
    backupDir: path.resolve(env.BACKUP_DIR || path.join(root, "backups")),
    ...rest,
  });
}

module.exports = {
  createDataProtection, createFromEnv, quarantineIfCorrupt, protectedCounts, protectedRegressions, parseDatabaseUrl, safeRel, redact,
  DPError, PROTECTED_RULES, DB_ENTRY, ID_RE, MIN_KEY_LEN,
};

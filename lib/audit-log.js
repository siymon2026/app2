"use strict";
/**
 * Tamper-evident, append-only audit log (spec section 19 + 21 + 23).
 *
 * Storage: JSON Lines segments under <dir>/audit-NNNN.jsonl. One record per line.
 * Integrity: every record carries `seq`, `prev` (hash of the previous record) and `hash`
 *   hash = sha256( prev + "\n" + canonicalJson(record without hash) )
 *   or HMAC-SHA256 with AUDIT_HMAC_KEY when a key is supplied (an attacker who can edit
 *   the files but does not hold the key cannot recompute a valid chain).
 * Append-only: this module exposes NO update and NO delete. Segments rotate by size and are
 *   never removed, so the old "keep last N entries" truncation no longer erases history.
 * Redaction: secrets (passwords, tokens, one-time codes, card/IBAN numbers ...) are masked
 *   BEFORE the record is hashed or written, so they never reach disk.
 *
 * Honest limit: a hash chain DETECTS alteration/deletion/reordering (verify()); it cannot
 * PREVENT someone with write access to the server's disk from editing files. Preventing that
 * needs OS permissions (the files are created 0600) and an off-host copy of the chain head
 * (see headFile / docs/SETTINGS-AUDIT.md).
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const SEGMENT_MAX_BYTES = 8 * 1024 * 1024;
const MAX_STRING = 500;
const MAX_DEPTH = 5;
const MAX_KEYS = 60;
const MAX_ARRAY = 40;
const GENESIS = "0".repeat(64);

/** Keys whose VALUE must never be stored. Matched case-insensitively on the key name. */
const SECRET_KEY = /(pass(word|wd)?|secret|token|authorization|cookie|(^|[^a-z])otp([^a-z]|$)|otp_?code|verif(y|ication)?_?code|(^|[^a-z])pin(_?code)?$|^code$|cvv|cvc|private_?key|api_?key|signature|vapid|jwt)/i;
/** Keys whose value is a financial/ID number: keep only the last 4 characters. */
const MASK_KEY = /((^|[^a-z])(iban|rib)([^a-z]|$)|bank_?account(?!_?name)|account_?(no|number)|card_?(no|number)|cardnum|identity_?(no|number)|(^|[^a-z])cin([^a-z]|$)|passport)/i;

function mask(v) {
  const s = String(v == null ? "" : v);
  if (!s) return "";
  const keep = s.replace(/\s+/g, "").slice(-4);
  return "****" + keep;
}

/** Deep, bounded, secret-free copy. Never throws. */
function sanitize(value, depth = 0, keyHint = "") {
  try {
    if (value === null || value === undefined) return null;
    if (SECRET_KEY.test(keyHint)) return "[redacted]";
    if (MASK_KEY.test(keyHint)) return typeof value === "object" ? "[redacted]" : mask(value);
    const t = typeof value;
    if (t === "string") return value.length > MAX_STRING ? value.slice(0, MAX_STRING) + "…" : value;
    if (t === "number") return Number.isFinite(value) ? value : null;
    if (t === "boolean") return value;
    if (t === "bigint") return String(value);
    if (t === "function" || t === "symbol") return null;
    if (depth >= MAX_DEPTH) return "[truncated]";
    if (Array.isArray(value)) return value.slice(0, MAX_ARRAY).map((x) => sanitize(x, depth + 1, keyHint));
    if (value instanceof Date) return value.toISOString();
    if (t === "object") {
      const out = {};
      let n = 0;
      for (const k of Object.keys(value)) {
        if (n++ >= MAX_KEYS) { out["…"] = "[truncated]"; break; }
        if (k === "__proto__" || k === "constructor" || k === "prototype") continue;
        out[k] = sanitize(value[k], depth + 1, k);
      }
      return out;
    }
    return null;
  } catch (_e) {
    return "[unserializable]";
  }
}

/** Deterministic JSON: object keys sorted, so hashing does not depend on key order. */
function canonical(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v === undefined ? null : v);
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canonical(v[k])).join(",") + "}";
}

function createAuditLog(opts = {}) {
  const dir = opts.dir;
  if (!dir) throw new Error("audit-log: dir is required");
  const hmacKey = opts.hmacKey ? String(opts.hmacKey) : "";
  const segmentMax = Number(opts.segmentMaxBytes) > 0 ? Number(opts.segmentMaxBytes) : SEGMENT_MAX_BYTES;
  const clock = opts.now || (() => new Date());
  const genId = opts.genId || (() => crypto.randomBytes(8).toString("hex"));
  const logger = opts.logger || null;
  const headFile = path.join(dir, "HEAD.json"); // last seq+hash, a convenient value to copy off-host

  let state = null; // { seq, hash, segment, segBytes }

  const hashOf = (prev, rec) => {
    const body = prev + "\n" + canonical(rec);
    return hmacKey ? crypto.createHmac("sha256", hmacKey).update(body).digest("hex") : crypto.createHash("sha256").update(body).digest("hex");
  };
  const segName = (n) => "audit-" + String(n).padStart(4, "0") + ".jsonl";
  const listSegments = () => {
    try {
      return fs.readdirSync(dir).filter((f) => /^audit-\d{4,}\.jsonl$/.test(f)).sort();
    } catch (_e) { return []; }
  };
  const readSegment = (name) => {
    let txt = "";
    try { txt = fs.readFileSync(path.join(dir, name), "utf-8"); } catch (_e) { return []; }
    const out = [];
    for (const line of txt.split("\n")) {
      if (!line.trim()) continue;
      try { out.push({ rec: JSON.parse(line), raw: line }); } catch (_e) { out.push({ rec: null, raw: line }); }
    }
    return out;
  };

  function init() {
    if (state) return state;
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const segs = listSegments();
    let seq = 0, hash = GENESIS, segment = 1, segBytes = 0;
    if (segs.length) {
      const last = segs[segs.length - 1];
      segment = Number(last.match(/\d+/)[0]);
      const rows = readSegment(last).filter((r) => r.rec);
      try { segBytes = fs.statSync(path.join(dir, last)).size; } catch (_e) { segBytes = 0; }
      if (rows.length) { const r = rows[rows.length - 1].rec; seq = r.seq; hash = r.hash; }
      else if (segs.length > 1) {
        // last segment empty: continue from the previous one
        const prevRows = readSegment(segs[segs.length - 2]).filter((r) => r.rec);
        if (prevRows.length) { const r = prevRows[prevRows.length - 1].rec; seq = r.seq; hash = r.hash; }
      }
    }
    state = { seq, hash, segment, segBytes };
    return state;
  }

  /**
   * Append one record. Returns the stored record, or null on failure (audit logging must never
   * break the request that triggered it, but a failure is reported through the logger).
   */
  function append(entry) {
    try {
      const st = init();
      const clean = sanitize(entry && typeof entry === "object" ? entry : { action: String(entry || "") });
      const base = { id: genId(), at: clock().toISOString(), ...clean, seq: st.seq + 1, prev: st.hash };
      base.hash = hashOf(st.hash, (({ hash, ...r }) => r)(base));
      const line = JSON.stringify(base) + "\n";
      if (st.segBytes > 0 && st.segBytes + Buffer.byteLength(line) > segmentMax) { st.segment += 1; st.segBytes = 0; }
      fs.appendFileSync(path.join(dir, segName(st.segment)), line, { encoding: "utf-8", mode: 0o600 });
      st.segBytes += Buffer.byteLength(line);
      st.seq = base.seq; st.hash = base.hash;
      try { fs.writeFileSync(headFile, JSON.stringify({ seq: st.seq, hash: st.hash, at: base.at, keyed: !!hmacKey }), { mode: 0o600 }); } catch (_e) {}
      return base;
    } catch (e) {
      if (logger && logger.error) logger.error("audit append failed", { error: String(e && e.message ? e.message : e) });
      return null;
    }
  }

  /** Every record, oldest first. Used by query/verify; fine for the JSON-storage scale of this project. */
  function readAll() {
    init();
    const out = [];
    for (const s of listSegments()) for (const r of readSegment(s)) out.push(r);
    return out;
  }

  /** Re-computes the whole chain. */
  function verify() {
    init();
    let prev = GENESIS, expectSeq = 1, count = 0;
    const segs = listSegments();
    for (let i = 0; i < segs.length; i++) {
      const rows = readSegment(segs[i]);
      for (const r of rows) {
        if (!r.rec) return { ok: false, count, brokenAt: expectSeq, segment: segs[i], reason: "unparseable_line" };
        const rec = r.rec;
        if (rec.seq !== expectSeq) return { ok: false, count, brokenAt: expectSeq, segment: segs[i], reason: rec.seq > expectSeq ? "missing_records" : "duplicate_or_reordered" };
        if (rec.prev !== prev) return { ok: false, count, brokenAt: rec.seq, segment: segs[i], reason: "chain_broken" };
        const { hash, ...body } = rec;
        if (hashOf(prev, body) !== hash) return { ok: false, count, brokenAt: rec.seq, segment: segs[i], reason: "record_modified" };
        prev = hash; expectSeq += 1; count += 1;
      }
    }
    // Truncation of the tail is caught by comparing with HEAD.json (written after every append).
    let head = null;
    try { head = JSON.parse(fs.readFileSync(headFile, "utf-8")); } catch (_e) {}
    if (head && Number.isFinite(head.seq) && head.seq > count) return { ok: false, count, brokenAt: count + 1, reason: "tail_truncated", expected: head.seq };
    return { ok: true, count, head: count ? { seq: count, hash: prev } : null, keyed: !!hmacKey };
  }

  const toMs = (v) => { if (!v) return null; const n = Date.parse(v); return Number.isFinite(n) ? n : null; };

  /**
   * Newest first. Filters: actorId, actorType, role, action (exact, or prefix when it ends with "*"),
   * result, targetId, q (substring over the record), from, to (ISO). Pagination: limit (<=500), offset.
   */
  function query(f = {}) {
    const all = readAll();
    const from = toMs(f.from), to = toMs(f.to);
    const q = f.q ? String(f.q).toLowerCase().slice(0, 100) : "";
    const act = f.action ? String(f.action) : "";
    const match = (rec) => {
      if (f.actorId && String(rec.actorId || "") !== String(f.actorId)) return false;
      if (f.actorType && String(rec.actorType || "") !== String(f.actorType)) return false;
      if (f.role && String(rec.role || "") !== String(f.role)) return false;
      if (f.result && String(rec.result || "") !== String(f.result)) return false;
      if (f.targetId && String(rec.targetId || "") !== String(f.targetId)) return false;
      if (act) {
        const a = String(rec.action || "");
        if (act.endsWith("*") ? !a.startsWith(act.slice(0, -1)) : a !== act) return false;
      }
      const t = Date.parse(rec.at);
      if (from !== null && !(t >= from)) return false;
      if (to !== null && !(t <= to)) return false;
      if (q && !JSON.stringify(rec).toLowerCase().includes(q)) return false;
      return true;
    };
    const hits = [];
    for (let i = all.length - 1; i >= 0; i--) { const r = all[i].rec; if (r && match(r)) hits.push(r); }
    const limit = Math.max(1, Math.min(500, Number(f.limit) || 100));
    const offset = Math.max(0, Number(f.offset) || 0);
    return { total: hits.length, limit, offset, logs: hits.slice(offset, offset + limit) };
  }

  /**
   * One-time import of the legacy data/audit_logs.json ({logs:[newest..oldest]}).
   * Safe by construction: the legacy file is never modified or deleted, a byte-for-byte backup is
   * written and its sha256 is checked BEFORE importing, and a marker prevents a second import.
   * Imported rows keep their original fields and are flagged legacy:true (their authenticity before
   * the migration cannot be proven; the chain protects them from the migration forward).
   */
  function migrateLegacy(legacyFile) {
    init();
    const marker = path.join(dir, "MIGRATED.json");
    if (fs.existsSync(marker)) return { ok: true, skipped: "already_migrated" };
    if (!legacyFile || !fs.existsSync(legacyFile)) return { ok: true, skipped: "no_legacy_file" };
    if (st0().seq > 0) return { ok: true, skipped: "chain_not_empty" };
    const raw = fs.readFileSync(legacyFile);
    const sha = crypto.createHash("sha256").update(raw).digest("hex");
    const backup = path.join(dir, "legacy-audit_logs." + clock().toISOString().replace(/[:.]/g, "-") + ".json.bak");
    fs.writeFileSync(backup, raw, { mode: 0o600 });
    if (crypto.createHash("sha256").update(fs.readFileSync(backup)).digest("hex") !== sha) return { ok: false, error: "backup_verification_failed" };
    let logs = [];
    try { const j = JSON.parse(raw.toString("utf-8")); logs = Array.isArray(j.logs) ? j.logs : []; } catch (_e) { return { ok: false, error: "legacy_file_unreadable" }; }
    let n = 0;
    for (let i = logs.length - 1; i >= 0; i--) { // oldest first
      const l = logs[i];
      if (!l || typeof l !== "object") continue;
      const { id, at, ...rest } = l;
      if (append({ ...rest, legacy: true, legacyId: id, legacyAt: at })) n += 1;
    }
    fs.writeFileSync(marker, JSON.stringify({ at: clock().toISOString(), imported: n, legacySha256: sha, backup: path.basename(backup) }), { mode: 0o600 });
    return { ok: true, imported: n, backup: path.basename(backup), legacySha256: sha };
  }
  const st0 = () => init();

  return { append, query, verify, migrateLegacy, readAll, headFile, dir, _hashOf: hashOf };
}

module.exports = { createAuditLog, sanitize, canonical, GENESIS };

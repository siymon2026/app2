"use strict";
/**
 * Command-line front ends (spec section 21). Thin: all rules live in lib/data-protection.js and lib/data-migrations.js.
 * scripts/backup.js and scripts/migrate-data.js call these. Exit codes: 0 ok, 1 failed, 2 usage error.
 * Nothing printed here contains the encryption key or DATABASE_URL.
 */
const os = require("os");

function parseArgs(argv) {
  const pos = [], flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=");
      if (v !== undefined) flags[k] = v;
      else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith("--") && ["reason", "to", "confirm", "keep", "only", "limit"].includes(k)) flags[k] = argv[++i];
      else flags[k] = true;
    } else pos.push(a);
  }
  return { pos, flags };
}
const actorOf = () => { let u = "unknown"; try { u = os.userInfo().username; } catch (_e) { /* no passwd entry */ } return { id: "cli:" + u, role: "", ip: "", type: "system" }; };
const fmtBytes = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : n >= 1024 ? (n / 1024).toFixed(1) + " KB" : n + " B");

const BACKUP_USAGE = `Usage: node scripts/backup.js <command>
  status                         what is configured (key, pg_dump), last backup, event-log integrity
  inventory [--uploads]          the data a backup would contain (size, records, protected/sensitive)
  create --reason "text" [--no-uploads] [--db | --no-db]
  list
  verify <backup-id>             full re-read: checksum, decryption, every file against the manifest
  restore <id> [--to <new-dir>]  extract into a NEW directory (default: backups/restore-<id>-<time>)
  restore <id> --live --confirm <id> --server-stopped [--only data/orders.json,data/topups.json]
                                 swap live data (application MUST be stopped). Current data is moved aside, never deleted.
  prune --keep <n> --yes         delete old backup archives only (minimum kept: 3)
  events [--limit n]             backup / restore / migration event log
  integrity                      protected records vs last verified backup + audit chain
  harden                         owner-only permissions on private data`;

async function backupMain(argv, { dp, out = console.log, err = console.error } = {}) {
  const { pos, flags } = parseArgs(argv);
  const cmd = pos[0];
  const fail = (r) => { err(`FAILED: ${r.code || "ERROR"}: ${r.error || ""}`.trim()); return 1; };
  switch (cmd) {
    case "status": { const s = dp.status(); out(JSON.stringify(s, null, 2)); return 0; }
    case "inventory": {
      const inv = dp.inventory({ includeUploads: !!flags.uploads });
      for (const f of inv.files) out(`${f.protected ? "P" : f.sensitive ? "S" : " "} ${String(f.bytes).padStart(10)}  ${f.path}${f.records !== undefined ? "  " + JSON.stringify(f.records) : ""}${f.valid === false ? "  [NOT VALID JSON]" : ""}`);
      out(`\n${inv.totals.files} files, ${fmtBytes(inv.totals.bytes)}; P=protected records (${inv.totals.protected}), S=sensitive (${inv.totals.sensitive})`);
      if (inv.totals.unreadableJson.length) out("Unreadable JSON: " + inv.totals.unreadableJson.join(", "));
      return 0;
    }
    case "create": {
      if (!flags.reason || flags.reason === true || String(flags.reason).trim().length < 3) { err("--reason \"text\" is required"); return 2; }
      const r = await dp.createBackup({ reason: String(flags.reason), actor: actorOf(), includeUploads: !flags["no-uploads"], database: flags.db ? true : flags["no-db"] ? false : "auto" });
      if (!r.ok) return fail(r);
      out(`OK  ${r.id}\n    ${fmtBytes(r.bytes)} archive, ${r.files} files, ${r.encrypted ? "encrypted (AES-256-GCM)" : "NOT ENCRYPTED"}, verified ${r.verifiedAt}`);
      out(`    database: ${r.database.included ? "included (" + fmtBytes(r.database.size) + ")" : "not included - " + r.database.reason}`);
      for (const w of r.warnings) out(`    WARNING ${w.path}: ${w.warning}`);
      return 0;
    }
    case "list": {
      const l = dp.listBackups();
      if (!l.length) out("(no backups)");
      for (const b of l) out(`${b.id}  ${b.createdAt || "?"}  ${b.bytes ? fmtBytes(b.bytes) : "?"}  ${b.encrypted ? "enc" : "PLAIN"}  ${b.verified && b.verified.ok ? "verified " + b.verified.at : "NOT VERIFIED"}${b.database ? "  +db" : ""}${b.archivePresent ? "" : "  [ARCHIVE MISSING]"}  ${b.reason || ""}`);
      return 0;
    }
    case "verify": {
      if (!pos[1]) { err(BACKUP_USAGE); return 2; }
      const r = await dp.verifyBackup(pos[1], { actor: actorOf() });
      if (!r.ok) return fail(r);
      out(`OK  ${r.id}: ${r.files} files, ${fmtBytes(r.bytes)} of data, ${r.encrypted ? "encrypted" : "not encrypted"}`);
      for (const w of r.warnings) out(`    WARNING ${w.path}: ${w.warning}`);
      return 0;
    }
    case "restore": {
      const id = pos[1];
      if (!id) { err(BACKUP_USAGE); return 2; }
      const only = flags.only && flags.only !== true ? String(flags.only).split(",").map((x) => x.trim()).filter(Boolean) : undefined;
      const r = await dp.restoreBackup(id, { actor: actorOf(), live: !!flags.live, confirm: flags.confirm === true ? "" : flags.confirm, serverStopped: !!flags["server-stopped"], targetDir: flags.to && flags.to !== true ? String(flags.to) : undefined, only });
      if (!r.ok) return fail(r);
      if (r.mode === "extract") out(`OK  extracted ${r.files} files to ${r.targetDir}\n    audit chain in the restored copy: ${r.audit.present ? (r.audit.ok ? "intact (" + r.audit.records + " records)" : "BROKEN: " + r.audit.reason) : "not present"}`);
      else {
        out(`OK  live restore from ${r.id}: ${r.files} files\n    safety backup of the previous state: ${r.safetyBackupId}`);
        for (const k of r.previousKeptAs) out(`    previous data kept as: ${k}`);
        out(`    audit chain: ${r.audit.present ? (r.audit.ok ? "intact (" + r.audit.records + " records)" : "BROKEN: " + r.audit.reason) : "not present"}`);
      }
      if (r.database && r.database.dumpPath) out(`    database dump extracted to ${r.database.dumpPath} (NOT restored automatically - see docs/DATA-PROTECTION.md)`);
      return 0;
    }
    case "prune": {
      if (!flags.yes) { err("prune deletes old backup archives; add --yes to confirm (data and audit logs are never touched)"); return 2; }
      const r = dp.pruneBackups({ keep: Number(flags.keep) || 5, actor: actorOf() });
      out(`removed ${r.removed.length}, kept ${r.kept}`); r.removed.forEach((i) => out("  - " + i));
      return 0;
    }
    case "events": {
      const v = dp.verifyEvents();
      out(`event log integrity: ${v.ok ? "intact" : "BROKEN (" + v.reason + " at " + v.brokenAt + ")"}  (${v.count} records)`);
      for (const e of dp.listEvents({ limit: Number(flags.limit) || 30 })) out(`${e.at}  ${String(e.result).padEnd(6)} ${e.event}  ${e.id || ""}  by ${e.actor && e.actor.id}`);
      return v.ok ? 0 : 1;
    }
    case "integrity": {
      const r = dp.integrityReport();
      out(JSON.stringify(r, null, 2));
      return r.ok ? 0 : 1;
    }
    case "harden": { const r = dp.hardenPermissions(); out(r.changed.length ? r.changed.map((c) => `${c.path}: ${c.from} -> ${c.to}`).join("\n") : "permissions already restrictive"); return 0; }
    default: err(BACKUP_USAGE); return 2;
  }
}

async function migrateMain(argv, { runner, out = console.log, err = console.error } = {}) {
  const { pos, flags } = parseArgs(argv);
  if (pos[0] === "status") {
    const s = runner.status();
    out(`schema version: ${s.schemaVersion || "(none applied)"}`);
    s.applied.forEach((a) => out(`  applied  ${a.id}  ${a.appliedAt}  backup ${a.backupId || "-"}`));
    s.pending.forEach((m) => out(`  PENDING  ${m.id}  ${m.description}  [${m.files.join(", ") || "no data files"}]`));
    s.problems.forEach((p) => out(`  PROBLEM  ${p.code} ${p.id || ""} ${p.message}`));
    return s.ok ? 0 : 1;
  }
  const r = await runner.run({ dryRun: !!flags["dry-run"], actor: actorOf() });
  if (!r.ok) { err(`FAILED: ${r.code}: ${r.error}${r.rolledBack ? "\n  the affected files were restored from backup " + r.backupId : ""}`); return 1; }
  if (r.noop) { out("nothing to migrate"); return 0; }
  if (r.dryRun) { out(`dry run: ${r.pending.join(", ")}`); r.wouldChange.forEach((c) => out(`  ${c.changed ? "WOULD CHANGE" : "unchanged   "}  ${c.file}  ${c.before ? fmtBytes(c.before.bytes) : "(new)"} -> ${fmtBytes(c.after.bytes)}`)); return 0; }
  out(`applied: ${r.applied.join(", ")}${r.backupId ? "\n  verified backup taken first: " + r.backupId : "\n  no backup needed (no existing data file is affected)"}`);
  (r.warnings || []).forEach((w) => out("  WARNING " + w));
  return 0;
}

module.exports = { backupMain, migrateMain, parseArgs, BACKUP_USAGE };

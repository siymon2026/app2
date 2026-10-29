"use strict";
/**
 * Admin routes for data protection (spec section 21). system_admin only unless a role is granted the permission explicitly.
 *   GET  /api/admin/backups                  backup.read    list + honest status (key configured? pg_dump present? last verified)
 *   POST /api/admin/backups                  backup.create  create + verify a backup. 201 only when the verification passed
 *   POST /api/admin/backups/:id/verify       backup.read    full re-verification of a stored backup
 *   GET  /api/admin/backups/events           backup.read    hash-chained event log (newest first)
 *   GET  /api/admin/data-integrity           backup.read    protected record counters vs the last verified backup + audit chain
 * Deliberately NOT offered over HTTP: downloading a backup (contains identity documents and credentials) and restoring one
 * (needs a stopped server). Both are CLI operations: scripts/backup.js. Every call is recorded by lib/data-protection.
 */
function registerBackupRoutes(app, d) {
  const { requireAdmin, dp, auditLog = null, actorOf } = d;
  const s = (v, n = 200) => String(v == null ? "" : v).slice(0, n);
  const who = (req) => ({ ...actorOf(req), type: "admin" });
  const seen = (req, action, extra) => { if (auditLog) auditLog.append({ actorType: "admin", actorId: who(req).id, role: who(req).role, ip: who(req).ip, action, result: "ok", ...extra }); };

  app.get("/api/admin/backups", requireAdmin, (req, res) => {
    seen(req, "backup.view");
    res.json({ ok: true, status: dp.status(), backups: dp.listBackups().slice(0, 100) });
  });

  app.get("/api/admin/backups/events", requireAdmin, (req, res) => {
    res.json({ ok: true, integrity: dp.verifyEvents(), events: dp.listEvents({ limit: req.query && req.query.limit }) });
  });

  app.get("/api/admin/data-integrity", requireAdmin, (req, res) => {
    const r = dp.integrityReport();
    seen(req, "data.integrity.check", { integrity: r.ok ? "intact" : "ATTENTION", regressions: r.regressions.length });
    res.json({ ok: true, report: r });
  });

  app.post("/api/admin/backups", requireAdmin, async (req, res) => {
    const b = req.body || {};
    const reason = s(b.reason, 200).trim();
    if (reason.length < 3) return res.status(400).json({ ok: false, error: "A reason (3-200 characters) is required", code: "REASON_REQUIRED" });
    const database = b.includeDatabase === undefined || b.includeDatabase === "auto" ? "auto" : !!b.includeDatabase;
    const r = await dp.createBackup({ reason, actor: who(req), includeUploads: b.includeUploads !== false, database });
    if (r.ok) return res.status(201).json({ ok: true, backup: { id: r.id, bytes: r.bytes, files: r.files, encrypted: r.encrypted, includeUploads: r.includeUploads, database: r.database, warnings: r.warnings, verifiedAt: r.verifiedAt } });
    const status = r.code === "BACKUP_IN_PROGRESS" ? 409 : ["ENCRYPTION_KEY_REQUIRED", "ENCRYPTION_KEY_WEAK", "DATABASE_NOT_CONFIGURED", "PG_DUMP_UNAVAILABLE"].includes(r.code) ? 422 : 500;
    res.status(status).json({ ok: false, code: r.code, error: r.error });
  });

  app.post("/api/admin/backups/:id/verify", requireAdmin, async (req, res) => {
    const r = await dp.verifyBackup(s(req.params.id, 80), { actor: who(req) });
    if (r.code === "INVALID_ID") return res.status(400).json({ ok: false, code: r.code, error: r.error });
    if (r.code === "META_MISSING" || r.code === "FILE_MISSING") return res.status(404).json({ ok: false, code: r.code, error: r.error });
    res.status(r.ok ? 200 : 422).json(r.ok ? { ok: true, id: r.id, files: r.files, bytes: r.bytes, encrypted: r.encrypted, warnings: r.warnings, verifiedAt: r.verifiedAt } : { ok: false, code: r.code, error: r.error });
  });
}

module.exports = { registerBackupRoutes };

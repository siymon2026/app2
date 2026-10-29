"use strict";
/**
 * Routes of the settings center and the audit log (spec section 19).
 *   GET  /api/admin/settings                    groups the caller may read (+ whether they may change each)
 *   PUT  /api/admin/settings/:group             validated, audited, fail-closed change (per-group permission)
 *   GET  /api/admin/audit-logs                  read-only list with filters         (audit.read)
 *   GET  /api/admin/audit-logs/verify           re-computes the hash chain          (audit.read)
 *   GET  /api/admin/audit-logs/export.csv       filtered export, max 5000 rows      (audit.read)
 *   GET  /api/public/i18n                       supported languages + announcement  (public, read-only)
 * There is no update/delete route for the audit log. Reading, verifying and exporting it are themselves audited.
 */
function registerSettingsRoutes(app, d) {
  const { requireAdmin, auditLog, settings, adminRoles, onSettingsChanged = () => {} } = d;

  const actorOf = (req) => ({ id: String(req.adminId || ""), role: adminRoles.normalizeRole(req.adminRole) || "", ip: String(req.ip || "") });
  const canOf = (req) => (perm) => adminRoles.can(req.adminRole, perm);
  const s = (v, n = 80) => String(v == null ? "" : v).slice(0, n);
  const filtersOf = (q = {}) => ({ actorId: s(q.actorId), actorType: s(q.actorType, 30), role: s(q.role, 30), action: s(q.action, 60), result: s(q.result, 20), targetId: s(q.targetId, 80), q: s(q.q, 100), from: s(q.from, 40), to: s(q.to, 40) });
  const access = (req, action, extra) => auditLog.append({ ...{ actorType: "admin", actorId: actorOf(req).id, role: actorOf(req).role, ip: actorOf(req).ip }, action, result: "ok", ...extra });

  app.get("/api/admin/settings", requireAdmin, (req, res) => {
    res.json({ ok: true, groups: settings.snapshot(canOf(req)) });
  });

  app.put("/api/admin/settings/:group", requireAdmin, (req, res) => {
    const r = settings.update(s(req.params.group, 40), req.body, actorOf(req), canOf(req));
    if (!r.ok) return res.status(r.status || 400).json({ ok: false, error: r.error, code: r.code });
    onSettingsChanged(r);
    res.json({ ok: true, group: r.group, changed: r.changed, values: r.next });
  });

  app.get("/api/public/i18n", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, ...settings.i18n() });
  });

  app.get("/api/admin/audit-logs", requireAdmin, (req, res) => {
    const f = filtersOf(req.query);
    const r = auditLog.query({ ...f, limit: req.query && req.query.limit, offset: req.query && req.query.offset });
    access(req, "audit.view", { filters: f, returned: r.logs.length });
    res.json({ ok: true, total: r.total, limit: r.limit, offset: r.offset, logs: r.logs });
  });

  app.get("/api/admin/audit-logs/verify", requireAdmin, (req, res) => {
    const v = auditLog.verify();
    access(req, "audit.verify", { integrity: v.ok ? "intact" : "BROKEN", records: v.count, brokenAt: v.brokenAt || null, reason: v.reason || null });
    res.json({ ok: true, integrity: v });
  });

  app.get("/api/admin/audit-logs/export.csv", requireAdmin, (req, res) => {
    const f = filtersOf(req.query);
    const first = auditLog.query({ ...f, limit: 500, offset: 0 });
    let rows = first.logs;
    for (let off = 500; off < Math.min(first.total, 5000); off += 500) rows = rows.concat(auditLog.query({ ...f, limit: 500, offset: off }).logs);
    const cell = (v) => {
      let t = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
      if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; // spreadsheet formula injection
      return '"' + t.replace(/"/g, '""') + '"';
    };
    const cols = ["seq", "at", "actorType", "actorId", "role", "action", "group", "targetId", "result", "changed", "reason", "ip"];
    const csv = "\uFEFF" + [cols.join(",")].concat(rows.map((x) => cols.map((c) => cell(x[c])).join(","))).join("\r\n");
    access(req, "audit.export", { filters: f, rows: rows.length });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=audit-log.csv");
    res.send(csv);
  });

  return { actorOf, canOf };
}

module.exports = { registerSettingsRoutes };

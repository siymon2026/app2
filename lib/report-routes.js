"use strict";
/**
 * Report endpoints (section 17). Three audiences, one engine (lib/reports.js):
 *
 *   Back office  GET /api/admin/reports                  which reports the signed-in role may open (+ store / driver pick-lists)
 *                GET /api/admin/reports/:type            ?from=&to=&preset=&granularity=&status=&storeId=&driverId=&lang=&format=&table=
 *   Business     GET /api/store/reports, /api/store/reports/:type      (own data only; permission `reports.read`)
 *   Driver       GET /api/driver/reports/earnings                      (own deliveries only)
 *
 * format = json (default) | csv | xlsx | pdf | html (printable; the browser prints it to PDF — the Arabic path).
 *
 * Authorisation, in order: (1) the caller's authentication middleware, (2) lib/admin-roles.js RULES (coarse gate),
 * (3) this file re-checks the report's own permission, (4) lib/reports.js scopes the DATA — a store sees only its own
 * orders and a driver only theirs, taken from the authenticated identity and never from the query string.
 * Reads are rate-limited per actor; every export and every view of a financial report is audit-logged.
 */
const R = require("./reports");
const LB = require("./report-labels");
const X = require("./export-files");

const FORMATS = Object.freeze(["json", "csv", "xlsx", "pdf", "html"]);
const JSON_ROWS_CAP = 2000;
const CONTENT = {
  csv: ["text/csv; charset=utf-8", "csv"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"],
  pdf: ["application/pdf", "pdf"],
  html: ["text/html; charset=utf-8", "html"],
};

function makeLimiter(now) {
  const hits = new Map();
  return function allow(key, max, windowMs) {
    const t = now();
    const arr = (hits.get(key) || []).filter((x) => t - x < windowMs);
    if (arr.length >= max) {
      hits.set(key, arr);
      return { ok: false, retryAfter: Math.max(1, Math.ceil((windowMs - (t - arr[0])) / 1000)) };
    }
    arr.push(t);
    hits.set(key, arr);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.length || t - v[v.length - 1] > windowMs) hits.delete(k);
    return { ok: true };
  };
}

function registerReportRoutes(app, d) {
  const {
    requireAdmin, requireStore = null, requireDriver = null, adminRoles, appendAuditLog = () => {}, loaders,
    getConfig = () => ({}), logger = null, now = Date.now,
  } = d;
  const allow = makeLimiter(now);

  const tzOf = () => {
    const cfg = getConfig() || {};
    const tz = String(process.env.REPORTS_TZ || cfg.timezone || R.DEFAULT_TZ);
    return R.validTz(tz) ? tz : R.DEFAULT_TZ;
  };

  /** Loads only what the report needs (a business never triggers a read of wallets, drivers or other stores' ledgers). */
  function loadData(def, tz) {
    const cfg = getConfig() || {};
    const D = { now: now(), currency: String(cfg.currency || "MAD"), tz };
    for (const need of def.needs) {
      if (need === "orders") D.orders = loaders.orders() || [];
      else if (need === "stores") D.stores = loaders.stores() || [];
      else if (need === "drivers") D.drivers = loaders.drivers() || [];
      else if (need === "customers") D.customers = loaders.customers() || [];
      else if (need === "settlements") D.settlements = loaders.settlements() || [];
      else if (need === "topups") D.topups = loaders.topups() || [];
      else if (need === "cases" || need === "exSettings") {
        if (!D.cases && loaders.exceptions) {
          const ex = loaders.exceptions() || {};
          D.cases = Array.isArray(ex.cases) ? ex.cases : [];
          D.exSettings = ex.settings && typeof ex.settings === "object" ? ex.settings : {};
        }
      }
    }
    return D;
  }

  const fail = (res, status, code, error, extra) => res.status(status).json({ ok: false, error, code, ...(extra || {}) });

  function present(res, report, lang, format, opts) {
    // JSON: bounded size; exports: complete (up to a hard cap that asks for a narrower range)
    if (format === "json") {
      const tables = report.tables.map((t) => ({ ...t, totalRows: t.rows.length, truncated: t.rows.length > JSON_ROWS_CAP, rows: t.rows.slice(0, JSON_ROWS_CAP) }));
      return res.json({ ok: true, report: { ...report, tables }, labels: LB.labelsFor(report, lang) });
    }
    if (report.tables.some((t) => t.rows.length > X.MAX_EXPORT_ROWS)) {
      return fail(res, 413, "TOO_MANY_ROWS", `Export is limited to ${X.MAX_EXPORT_ROWS} rows per table; choose a shorter period`);
    }
    // a standard PDF font cannot draw Arabic: the PDF uses English labels (Arabic users get the printable page / Excel)
    const outLang = format === "pdf" && lang === "ar" ? "en" : lang;
    const L = LB.labelsFor(report, outLang);
    let body;
    if (format === "csv") body = Buffer.from(X.toCsv(report, L, { table: opts.table }), "utf8");
    else if (format === "xlsx") body = X.toXlsx(report, L, { rtl: lang === "ar" });
    else if (format === "pdf") body = X.toPdf(report, L);
    else body = Buffer.from(X.toHtml(report, L, { lang: outLang }), "utf8");
    const [mime, ext] = CONTENT[format];
    const name = `siymon-${report.type}-${report.meta.fromKey}_${report.meta.toKey}.${ext}`;
    res.setHeader("Content-Type", mime);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (format === "pdf") res.setHeader("X-Report-Lang", outLang);
    if (format === "html") res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'");
    else res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
    return res.send(body);
  }

  /** Shared pipeline once the caller is authenticated and a scope/ctx has been derived from the identity. */
  function run(req, res, { type, ctx, actor }) {
    const def = R.REPORTS[type];
    if (!def) return fail(res, 404, "UNKNOWN_REPORT", "Unknown report");
    const format = req.query.format === undefined || req.query.format === "" ? "json" : String(req.query.format);
    if (!FORMATS.includes(format)) return fail(res, 400, "BAD_FORMAT", "format must be json, csv, xlsx, pdf or html");
    const exporting = format !== "json";
    const rl = allow(`${actor.type}:${actor.id}:${exporting ? "x" : "r"}`, exporting ? 20 : 120, 60000);
    if (!rl.ok) {
      res.setHeader("Retry-After", String(rl.retryAfter));
      return fail(res, 429, "RATE_LIMITED", "Too many report requests; try again shortly");
    }
    const tz = tzOf();
    const pp = R.parseParams(req.query || {}, { now: now(), tz });
    if (!pp.ok) return fail(res, 400, pp.code, pp.error);
    const params = pp.params;
    try {
      const D = loadData(def, tz);
      // admin-only filters are validated against real records, so a typo never silently means "everything"
      if (ctx.scope === "admin") {
        if (ctx.storeId) {
          const stores = D.stores || (loaders.stores() || []);
          if (!stores.some((s) => String(s.id) === String(ctx.storeId))) return fail(res, 404, "UNKNOWN_STORE", "Unknown store");
        }
        if (ctx.driverId) {
          const drivers = D.drivers || (loaders.drivers() || []);
          if (!drivers.some((s) => String(s.id) === String(ctx.driverId))) return fail(res, 404, "UNKNOWN_DRIVER", "Unknown driver");
        }
      }
      const gen = R.generate(type, D, params, ctx);
      if (!gen.ok) return fail(res, gen.status || 400, gen.code, gen.error);
      if (exporting || (ctx.scope === "admin" && def.fin)) {
        appendAuditLog({
          actorType: actor.type, actorId: String(actor.id || ""), role: actor.role || "", ...(actor.storeId ? { storeId: String(actor.storeId) } : {}),
          action: exporting ? "report.export" : "report.view", report: type, format, from: params.range.fromKey, to: params.range.toKey,
          ...(ctx.scope === "admin" && ctx.storeId ? { filterStoreId: String(ctx.storeId) } : {}),
        });
      }
      return present(res, gen.report, params.lang, format, { table: typeof req.query.table === "string" ? req.query.table : undefined });
    } catch (e) {
      if (logger && logger.error) logger.error("report failed", { type, scope: ctx.scope, message: String((e && e.message) || e).slice(0, 300) });
      return fail(res, 500, "REPORT_FAILED", "Report could not be generated");
    }
  }

  const str = (v) => (typeof v === "string" ? v.trim().slice(0, 80) : "");

  /* ---------------------------- back office ---------------------------- */
  app.get("/api/admin/reports", requireAdmin, (req, res) => {
    const can = (p) => adminRoles.can(req.adminRole, p);
    const lg = ["ar", "fr", "en"].includes(String(req.query.lang)) ? String(req.query.lang) : "en";
    const types = R.availableTypes("admin", can).map((id) => ({
      id, title: LB.pick(LB.TITLE[id], lg), gran: R.REPORTS[id].gran, fin: R.REPORTS[id].fin, formats: FORMATS, storeFilter: ["sales", "order-financials", "commissions", "settlements", "exceptions", "reconcile", "driver-earnings"].includes(id),
      driverFilter: id === "driver-earnings", statusFilter: id === "order-financials",
    }));
    const wantStores = types.some((t) => t.storeFilter);
    const stores = wantStores ? (loaders.stores() || []).map((s) => ({ id: String(s.id), name: s.name })) : [];
    const drivers = can("drivers.read") || can("finance.read") ? (loaders.drivers() || []).map((x) => ({ id: String(x.id), name: String(x.name || x.fullName || x.id).slice(0, 80) })) : [];
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, types, stores, drivers, tz: tzOf(), maxRangeDays: R.MAX_RANGE_DAYS, jsonRowsCap: JSON_ROWS_CAP, exportMaxRows: X.MAX_EXPORT_ROWS });
  });

  app.get("/api/admin/reports/:type([a-z-]+)", requireAdmin, (req, res) => {
    const type = String(req.params.type || "");
    const def = R.REPORTS[type];
    if (!def) return fail(res, 404, "UNKNOWN_REPORT", "Unknown report");
    if (!adminRoles.can(req.adminRole, def.admin)) return fail(res, 403, "FORBIDDEN", "Forbidden");
    const ctx = {
      scope: "admin", finance: adminRoles.can(req.adminRole, "finance.read"),
      ...(str(req.query.storeId) ? { storeId: str(req.query.storeId) } : {}),
      ...(str(req.query.driverId) ? { driverId: str(req.query.driverId) } : {}),
    };
    run(req, res, { type, ctx, actor: { type: "admin", id: req.adminId, role: String(req.adminRole || "") } });
  });

  /* ---------------------------- businesses ---------------------------- */
  if (requireStore) {
    const storeTypes = R.availableTypes("store");
    app.get("/api/store/reports", requireStore("reports.read"), (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      res.json({
        ok: true, storeId: String(req.storeId),
        types: storeTypes.map((id) => ({ id, title: LB.pick(LB.TITLE[id], ["ar", "fr", "en"].includes(String(req.query.lang)) ? String(req.query.lang) : "en"), gran: R.REPORTS[id].gran, fin: R.REPORTS[id].fin, formats: FORMATS, storeFilter: false, driverFilter: false, statusFilter: id === "order-financials" })),
        stores: [], drivers: [], tz: tzOf(), maxRangeDays: R.MAX_RANGE_DAYS, jsonRowsCap: JSON_ROWS_CAP, exportMaxRows: X.MAX_EXPORT_ROWS,
      });
    });
    app.get("/api/store/reports/:type([a-z-]+)", requireStore("reports.read"), (req, res) => {
      const type = String(req.params.type || "");
      // the store id comes ONLY from the authenticated membership (requireStore), never from the request
      const ctx = { scope: "store", finance: true, storeId: String(req.storeId) };
      run(req, res, { type, ctx, actor: { type: "store", id: req.storeUserId || req.storeId, role: String(req.storeRole || ""), storeId: req.storeId } });
    });
  }

  /* ---------------------------- drivers ---------------------------- */
  if (requireDriver) {
    app.get("/api/driver/reports/earnings", requireDriver, (req, res) => {
      const ctx = { scope: "driver", finance: true, driverId: String(req.driverId) };
      run(req, res, { type: "driver-earnings", ctx, actor: { type: "driver", id: req.driverId, role: "driver" } });
    });
  }

  return { run };
}

module.exports = { registerReportRoutes, FORMATS, JSON_ROWS_CAP };

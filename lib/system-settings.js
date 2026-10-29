"use strict";
/**
 * System settings center (spec section 19).
 *
 * One registry for every operational setting the supervisors may change. Each group has:
 *   - read()            current values (always inside the safe bounds)
 *   - validate(body)    STRICT: unknown keys and out-of-range values are rejected (never silently clamped)
 *   - write(patch)      persists to the setting's real storage (config.json, exceptions.json, complaints.json)
 * and update() wraps them with the rule the spec asks for: a settings change is audited with actor, role,
 * timestamp (added by the audit store), previous value, new value and result — and it is FAIL-CLOSED: the
 * audit record is written BEFORE the change is applied; if the audit store cannot be written the change is refused.
 * Rejected attempts (validation failure) are audited too, with result "rejected".
 *
 * Nothing here is a mock: each group is a thin adapter over the module/file that actually consumes the setting.
 */

const LANGS = Object.freeze(["ar", "fr", "en"]);
const LIMIT_BOUNDS = Object.freeze({ adminRateLimitMax: [50, 5000], apiRateLimitMax: [300, 20000], loginMaxAttempts: [3, 30] });
const LIMIT_DEFAULTS = Object.freeze({ adminRateLimitMax: 600, apiRateLimitMax: 3000, loginMaxAttempts: 10 });
const GLOBAL_TEXT_MAX = 280;
const DISPATCH_BOUNDS = Object.freeze({ ttlSec: [10, 120], rings: [1, 5] });

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const bad = (error, code, status = 400) => ({ ok: false, status, error, code });
const unknownKeys = (body, allowed) => Object.keys(body).filter((k) => !allowed.includes(k));
const intIn = (v, [lo, hi]) => { if (v === "" || v === null || typeof v === "boolean") return null; const n = Number(v); return Number.isInteger(n) && n >= lo && n <= hi ? n : null; };
const cleanText = (v) => String(v == null ? "" : v).replace(/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ").replace(/[ \t]+/g, " ").trim();

/** Limits as the running server should apply them right now (env value = default, config = override within bounds). */
function limitsFromConfig(cfg = {}, env = process.env) {
  const out = {};
  for (const k of Object.keys(LIMIT_DEFAULTS)) {
    let dflt = LIMIT_DEFAULTS[k];
    if (k === "adminRateLimitMax" && Number(env.ADMIN_RATE_LIMIT_MAX) > 0) dflt = Number(env.ADMIN_RATE_LIMIT_MAX);
    const [lo, hi] = LIMIT_BOUNDS[k];
    const n = Number(cfg[k]);
    out[k] = Number.isFinite(n) && n >= lo && n <= hi ? Math.round(n) : Math.min(hi, Math.max(lo, dflt));
  }
  return out;
}

function i18nFromConfig(cfg = {}) {
  const sup = Array.isArray(cfg.supportedLanguages) ? cfg.supportedLanguages.filter((l) => LANGS.includes(l)) : [];
  const supportedLanguages = sup.length ? LANGS.filter((l) => sup.includes(l)) : [...LANGS];
  const defaultLanguage = supportedLanguages.includes(cfg.defaultLanguage) ? cfg.defaultLanguage : supportedLanguages.includes("ar") ? "ar" : supportedLanguages[0];
  const a = isObj(cfg.globalAnnouncement) ? cfg.globalAnnouncement : {};
  const announcement = { ar: cleanText(a.ar).slice(0, GLOBAL_TEXT_MAX), fr: cleanText(a.fr).slice(0, GLOBAL_TEXT_MAX), en: cleanText(a.en).slice(0, GLOBAL_TEXT_MAX) };
  return { supportedLanguages, defaultLanguage, announcement };
}

function createSystemSettings(deps) {
  const { loadConfig, updateConfig, deliveryPricing, driverEarnings, dispatchService, exceptionsLib, complaintsLib,
    readJson, writeJson, exceptionsFile, complaintsFile, audit, env = process.env } = deps;

  const cfg0 = () => loadConfig() || {};
  // updateConfig merges into the RAW config file (never re-saves the normalized view, which carries the admin password default).
  const patchConfig = (patch) => updateConfig(patch);
  const pick = (body, map) => { const o = {}; for (const [pub, key] of Object.entries(map)) if (body[pub] !== undefined) o[key] = body[pub]; return o; };

  const GROUPS = {};
  const add = (g) => { GROUPS[g.id] = g; };

  /* ---------- delivery price per km (config.json) ---------- */
  const DP = { mode: "deliveryPricingMode", pricePerKm: "deliveryPricePerKm", baseFee: "deliveryBaseFee", maxKm: "deliveryMaxKm" };
  add({
    id: "delivery_pricing", readPerm: "finance.read", writePerm: "settings.write", sensitive: true,
    get: () => deliveryPricing.settingsFromConfig(cfg0()),
    validate(body) {
      const u = unknownKeys(body, Object.keys(DP)); if (u.length) return bad("Unknown setting: " + u[0].slice(0, 40), "UNKNOWN_SETTING");
      const v = deliveryPricing.validateUpdate(pick(body, DP));
      return v.ok ? { ok: true, patch: v.values } : bad(v.error, "OUT_OF_RANGE");
    },
    write: (patch) => patchConfig(patch),
    bounds: { pricePerKm: [0, 50], baseFee: [0, 100], maxKm: [1, 60] },
  });

  /* ---------- driver base pay + per-km (config.json) ---------- */
  const DE = { mode: "driverEarningsMode", base: "driverEarningBase", perKm: "driverEarningPerKm" };
  add({
    id: "driver_earnings", readPerm: "finance.read", writePerm: "settings.write", sensitive: true,
    get: () => driverEarnings.settingsFromConfig(cfg0()),
    validate(body) {
      const u = unknownKeys(body, Object.keys(DE)); if (u.length) return bad("Unknown setting: " + u[0].slice(0, 40), "UNKNOWN_SETTING");
      const v = driverEarnings.validateUpdate(pick(body, DE));
      return v.ok ? { ok: true, patch: v.values } : bad(v.error, "OUT_OF_RANGE");
    },
    write: (patch) => patchConfig(patch),
    bounds: { base: [0, 200], perKm: [0, 50] },
  });

  /* ---------- H3 dispatch rules, search limit, offer timeout (config.json) ---------- */
  add({
    id: "dispatch", readPerm: "dispatch.manage", writePerm: "settings.dispatch", sensitive: true,
    get() {
      const s = dispatchService.settings();
      return { mode: s.mode, auto: s.auto, ttlSec: Math.round(s.ttlMs / 1000), rings: s.rings, pickup: s.pickupFallback ? { lat: Number(s.pickupFallback.lat), lng: Number(s.pickupFallback.lng), name: String(s.pickupFallback.name || "") } : null };
    },
    validate(body) {
      const u = unknownKeys(body, ["mode", "auto", "ttlSec", "rings", "pickup"]); if (u.length) return bad("Unknown setting: " + u[0].slice(0, 40), "UNKNOWN_SETTING");
      const patch = {};
      if (body.rings !== undefined) {
        const n = intIn(body.rings, DISPATCH_BOUNDS.rings);
        if (n === null) return bad(`rings must be a whole number between ${DISPATCH_BOUNDS.rings[0]} and ${DISPATCH_BOUNDS.rings[1]}`, "OUT_OF_RANGE");
        patch.dispatchRings = n;
      }
      const { rings, ...rest } = body;
      const r = dispatchService.settingsPatch(rest);
      if (!r.ok) return bad(r.error, String(r.error || "invalid").toUpperCase(), r.status || 400);
      return { ok: true, patch: { ...r.patch, ...patch } };
    },
    write: (patch) => patchConfig(patch),
    bounds: { ttlSec: DISPATCH_BOUNDS.ttlSec, rings: DISPATCH_BOUNDS.rings },
  });

  /* ---------- preparation-time thresholds, alert timers, redelivery attempts (exceptions.json) ---------- */
  const loadX = () => readJson(exceptionsFile, { cases: [], settings: {} }) || { cases: [], settings: {} };
  add({
    id: "exceptions", readPerm: "exceptions.read", writePerm: "exceptions.settings", sensitive: true,
    get: () => exceptionsLib.clampSettings(loadX().settings),
    validate(body) {
      const v = exceptionsLib.validateSettingsPatch(body);
      return v.ok ? { ok: true, patch: v.value } : bad(v.error, v.code || "INVALID");
    },
    write(patch) { const j = loadX(); j.settings = { ...exceptionsLib.clampSettings(j.settings), ...patch }; writeJson(exceptionsFile, j); },
    bounds: exceptionsLib.BOUNDS,
  });

  /* ---------- complaint response deadlines (complaints.json) ---------- */
  const loadC = () => readJson(complaintsFile, { complaints: [], settings: {} }) || { complaints: [], settings: {} };
  add({
    id: "complaints", readPerm: "complaints.read", writePerm: "complaints.settings", sensitive: true,
    get: () => complaintsLib.clampSettings(loadC().settings),
    validate(body) {
      const v = complaintsLib.validateSettingsPatch(body);
      return v.ok ? { ok: true, patch: v.value } : bad(v.error, v.code || "INVALID");
    },
    write(patch) { const j = loadC(); j.settings = { ...complaintsLib.clampSettings(j.settings), ...patch }; writeJson(complaintsFile, j); },
    bounds: complaintsLib.BOUNDS,
  });

  /* ---------- security / operational limits actually enforced by the rate limiters ---------- */
  add({
    id: "limits", readPerm: "settings.read", writePerm: "settings.write", sensitive: true,
    get: () => limitsFromConfig(cfg0(), env),
    validate(body) {
      const keys = Object.keys(LIMIT_BOUNDS);
      const u = unknownKeys(body, keys); if (u.length) return bad("Unknown setting: " + u[0].slice(0, 40), "UNKNOWN_SETTING");
      const patch = {};
      for (const k of keys) {
        if (body[k] === undefined) continue;
        const n = intIn(body[k], LIMIT_BOUNDS[k]);
        if (n === null) return bad(`${k} must be a whole number between ${LIMIT_BOUNDS[k][0]} and ${LIMIT_BOUNDS[k][1]}`, "OUT_OF_RANGE");
        patch[k] = n;
      }
      return { ok: true, patch };
    },
    write: (patch) => patchConfig(patch),
    bounds: LIMIT_BOUNDS,
  });

  /* ---------- supported languages + global text (config.json) ---------- */
  add({
    id: "i18n", readPerm: "settings.read", writePerm: "settings.write", sensitive: false,
    get: () => i18nFromConfig(cfg0()),
    validate(body) {
      const u = unknownKeys(body, ["supportedLanguages", "defaultLanguage", "announcement"]); if (u.length) return bad("Unknown setting: " + u[0].slice(0, 40), "UNKNOWN_SETTING");
      const cur = i18nFromConfig(cfg0());
      const patch = {};
      let sup = cur.supportedLanguages;
      if (body.supportedLanguages !== undefined) {
        if (!Array.isArray(body.supportedLanguages) || !body.supportedLanguages.length || body.supportedLanguages.some((l) => !LANGS.includes(l))) return bad("supportedLanguages must be a non-empty list of ar, fr, en", "INVALID_LANGUAGES");
        sup = LANGS.filter((l) => body.supportedLanguages.includes(l));
        patch.supportedLanguages = sup;
      }
      if (body.defaultLanguage !== undefined) {
        if (!sup.includes(body.defaultLanguage)) return bad("defaultLanguage must be one of the supported languages", "INVALID_DEFAULT_LANGUAGE");
        patch.defaultLanguage = body.defaultLanguage;
      } else if (patch.supportedLanguages && !sup.includes(cur.defaultLanguage)) {
        patch.defaultLanguage = sup.includes("ar") ? "ar" : sup[0]; // default can never point at a disabled language
      }
      if (body.announcement !== undefined) {
        if (!isObj(body.announcement)) return bad("announcement must be an object with ar, fr, en", "INVALID_TEXT");
        const next = { ...cur.announcement };
        for (const k of Object.keys(body.announcement)) {
          if (!LANGS.includes(k)) return bad("Unknown language: " + k.slice(0, 10), "INVALID_TEXT");
          const t = cleanText(body.announcement[k]);
          if (t.length > GLOBAL_TEXT_MAX) return bad(`announcement.${k} must be at most ${GLOBAL_TEXT_MAX} characters`, "OUT_OF_RANGE");
          next[k] = t;
        }
        patch.globalAnnouncement = next;
      }
      return { ok: true, patch };
    },
    write: (patch) => patchConfig(patch),
    bounds: { announcementMax: [0, GLOBAL_TEXT_MAX], languages: LANGS },
  });

  /* ---------------------------------------------------------------- */

  const ids = () => Object.keys(GROUPS);
  const publicView = (g, can) => ({ id: g.id, sensitive: !!g.sensitive, values: g.get(), bounds: g.bounds || null, canWrite: can(g.writePerm) });

  /** All groups the caller may READ, with their current values and whether they may also change them. */
  function snapshot(can) {
    return ids().filter((id) => can(GROUPS[id].readPerm) || can(GROUPS[id].writePerm)).map((id) => publicView(GROUPS[id], can));
  }

  const baseOf = (actor, groupId) => ({ actorType: "admin", actorId: String((actor && actor.id) || ""), role: String((actor && actor.role) || ""), ip: String((actor && actor.ip) || ""), group: groupId, targetId: "settings:" + groupId });
  const changedKeys = (prev, next) => { const p = isObj(prev) ? prev : {}, n = isObj(next) ? next : {}; return [...new Set([...Object.keys(p), ...Object.keys(n)])].filter((k) => !same(p[k], n[k])); };

  /**
   * Two-phase audited change, FAIL-CLOSED.
   *   begin():  records the intent (previous value + what is about to change). Returns null if the audit store
   *             cannot be written — the caller must then refuse the change.
   *   finish(): records the outcome: result "ok" with previous and new value, or "failed".
   * Used by update() below and by legacy writers (PUT /api/config) that change several groups in one save.
   */
  function begin(actor, groupId, previous, extra = {}) {
    return audit.append({ ...baseOf(actor, groupId), action: "settings.update", result: "applying", sensitive: true, previous, ...extra });
  }
  function finish(intent, actor, groupId, previous, next, error) {
    const base = { ...baseOf(actor, groupId), action: "settings.update", intentSeq: intent ? intent.seq : null };
    if (error) return audit.append({ ...base, result: "failed", error: String(error && error.message ? error.message : error).slice(0, 200) });
    return audit.append({ ...base, result: "ok", previous, next, changed: changedKeys(previous, next) });
  }

  /** Validate -> audit intent (fail-closed) -> apply -> audit outcome. `actor` = {id, role, ip}; `can(perm)` = caller's permission test. */
  function update(groupId, body, actor, can) {
    const g = GROUPS[groupId];
    if (!g) return bad("Unknown settings group", "UNKNOWN_GROUP", 404);
    if (!can(g.writePerm)) {
      audit.append({ ...baseOf(actor, g.id), action: "settings.update", result: "denied", reason: "missing_permission", permission: g.writePerm });
      return bad("Forbidden", "FORBIDDEN", 403);
    }
    if (!isObj(body)) return bad("Body must be an object", "INVALID_BODY");
    const previous = g.get();
    const v = g.validate(body);
    if (!v.ok) {
      audit.append({ ...baseOf(actor, g.id), action: "settings.update", result: "rejected", reason: v.code, error: String(v.error).slice(0, 200), attempted: body, previous });
      return v;
    }
    if (!Object.keys(v.patch).length) return bad("Nothing to change", "EMPTY");
    const intent = begin(actor, g.id, previous, { patch: v.patch });
    if (!intent) return bad("Audit log unavailable; the change was NOT applied", "AUDIT_UNAVAILABLE", 503);
    try { g.write(v.patch); } catch (e) {
      finish(intent, actor, g.id, previous, null, e);
      return bad("Could not save the setting", "WRITE_FAILED", 500);
    }
    const next = g.get();
    finish(intent, actor, g.id, previous, next);
    return { ok: true, group: g.id, changed: changedKeys(previous, next), previous, next };
  }

  return { GROUPS, ids, snapshot, update, begin, finish, changedKeys, limits: () => limitsFromConfig(cfg0(), env), i18n: () => i18nFromConfig(cfg0()) };
}

module.exports = { createSystemSettings, limitsFromConfig, i18nFromConfig, LANGS, LIMIT_BOUNDS, LIMIT_DEFAULTS, GLOBAL_TEXT_MAX, DISPATCH_BOUNDS };

"use strict";
/**
 * Back-office roles (least privilege), enforced on the SERVER for every
 * request that goes through requireAdmin.
 *
 * - "system_admin" = full access. Admin accounts created before roles existed
 *   have no role field and are treated as system_admin, so nothing breaks.
 * - Every other role is DENY-BY-DEFAULT: a route not listed in RULES is
 *   reachable by system_admin only, so new/forgotten endpoints are safe.
 * - Staff management and the system settings are never reachable by a
 *   restricted role, so a restricted account cannot grant itself or anyone
 *   else more privileges.
 */

const ROLES = Object.freeze(["system_admin", "order_supervisor", "driver_supervisor", "accountant", "support"]);
const FULL = "system_admin";

const PERMISSIONS = Object.freeze({
  order_supervisor: [
    "orders.read", "orders.manage", "orders.exception", "dispatch.manage",
    "drivers.read", "stores.read", "customers.read", "support.use", "reports.read",
    "exceptions.read", "exceptions.manage",
    "feedback.moderate", "complaints.read", "complaints.manage",
    "zones.read",
  ],
  driver_supervisor: [
    "drivers.read", "drivers.review", "drivers.documents", "dispatch.manage", "orders.read",
    "exceptions.read", "complaints.read",
    "zones.read",
  ],
  accountant: [
    "finance.read", "finance.write", "wallet.adjust", "topups.review",
    "orders.read", "stores.read", "drivers.read", "reports.read",
    "exceptions.read", "exceptions.manage",
  ],
  support: [
    "support.use", "support.manage", "orders.read", "customers.read", "stores.read", "drivers.read",
    "exceptions.read", "exceptions.manage",
    "feedback.moderate", "complaints.read", "complaints.manage",
  ],
});

/** Marks routes any signed-in staff member may call (no extra permission). */
const SELF = "self";

// [methods, regex, permission | {GET: perm, default: perm}]
const RULES = [
  [["GET"], /^\/api\/admin\/me$/, SELF],
  [["GET"], /^\/api\/config$/, SELF], // sensitive fields are redacted per role in the handler

  // System settings center (section 19). The handler lists/changes only the groups the role holds permission for;
  // refused attempts are audited per group. Audit log: read-only, system_admin unless audit.read is granted explicitly.
  [["GET"], /^\/api\/admin\/settings$/, SELF],
  [["PUT"], /^\/api\/admin\/settings\/[^/]+$/, SELF],
  [["GET"], /^\/api\/admin\/audit-logs(\/verify|\/export\.csv)?$/, "audit.read"],

  // Data protection (section 21): backups are created/verified over HTTP, but never downloaded or restored over HTTP.
  [["GET"], /^\/api\/admin\/backups(\/events)?$/, "backup.read"],
  [["POST"], /^\/api\/admin\/backups$/, "backup.create"],
  [["POST"], /^\/api\/admin\/backups\/[^/]+\/verify$/, "backup.read"],
  [["GET"], /^\/api\/admin\/data-integrity$/, "backup.read"],

  [["GET"], /^\/api\/orders(\/[^/]+)?$/, "orders.read"],
  [["PATCH"], /^\/api\/orders\/[^/]+$/, "orders.manage"],
  [["POST"], /^\/api\/print\/wifi$/, "orders.manage"], // ticket printing is part of managing orders
  [["POST"], /^\/api\/admin\/orders\/[^/]+\/verify-exception$/, "orders.exception"],
  [["GET"], /^\/api\/admin\/orders\/[^/]+\/(store-)?chat$/, "support.use"],
  [["GET", "POST"], /^\/api\/admin\/support(\/[^/]+)?$/, "support.use"],
  [["GET"], /^\/api\/admin\/support-channels$/, "support.use"],
  [["POST", "PUT", "DELETE"], /^\/api\/admin\/support-channels(\/[^/]+)?$/, "support.manage"], // contact numbers: system_admin + support role
  [["GET", "POST"], /^\/api\/admin\/store-support\/.+$/, "support.use"], // store tickets
  [["GET"], /^\/api\/admin\/customers$/, "customers.read"],

  [["GET", "PUT"], /^\/api\/admin\/exceptions\/settings$/, { GET: "exceptions.read", PUT: "exceptions.settings" }], // PUT: system_admin only
  [["GET"], /^\/api\/admin\/exceptions(\/[^/]+)?$/, "exceptions.read"],
  [["POST"], /^\/api\/admin\/exceptions(\/scan|\/[^/]+\/(assign|contact|escalate|priority|redeliver|reassign|resolve))?$/, "exceptions.manage"],

  // ratings moderation + complaints (spec 16). Settings (deadlines): system_admin only.
  [["GET", "POST"], /^\/api\/admin\/feedback\/moderation$/, "feedback.moderate"],
  [["GET", "PUT"], /^\/api\/admin\/complaints\/settings$/, { GET: "complaints.read", PUT: "complaints.settings" }],
  [["GET"], /^\/api\/admin\/complaints(\/[^/]+)?$/, "complaints.read"],
  [["POST"], /^\/api\/admin\/complaints\/[^/]+\/(take|escalate|note|message|resolve)$/, "complaints.manage"],

  // Service zones (section 18): everyone with zones.read may view/dry-run; only zones.manage (system_admin) may change them.
  [["GET"], /^\/api\/admin\/service-zones$/, "zones.read"],
  [["POST"], /^\/api\/admin\/service-zones\/test$/, "zones.read"],
  [["POST"], /^\/api\/admin\/service-zones$/, "zones.manage"],
  [["PUT", "DELETE"], /^\/api\/admin\/service-zones\/[^/]+$/, "zones.manage"],

  [["GET"], /^\/api\/admin\/drivers$/, "drivers.read"],
  [["GET"], /^\/api\/admin\/drivers\/[^/]+\/image\/[^/]+$/, "drivers.documents"],
  [["PATCH"], /^\/api\/admin\/drivers\/[^/]+$/, "drivers.review"],
  [["POST"], /^\/api\/admin\/drivers\/[^/]+\/wallet-adjust$/, "wallet.adjust"],
  [["GET"], /^\/api\/admin\/drivers\/[^/]+\/wallet-reconcile$/, "finance.read"],
  [["GET"], /^\/api\/admin\/topups$/, "finance.read"],
  [["PATCH"], /^\/api\/admin\/topups\/[^/]+$/, "topups.review"],
  [["GET"], /^\/api\/admin\/topups\/[^/]+\/receipt$/, "topups.review"],

  [["GET"], /^\/api\/admin\/dispatch\/state$/, "dispatch.manage"],
  [["POST"], /^\/api\/admin\/dispatch\/settings$/, "settings.dispatch"], // dispatch RULES are sensitive: explicit grant only (system_admin by default)
  [["POST"], /^\/api\/admin\/dispatch\/orders\/[^/]+\/(offer|reset)$/, "dispatch.manage"], // day-to-day intervention stays with the supervisors

  [["GET"], /^\/api\/admin\/stores\/[^/]+\/(commission|statement)$/, "finance.read"],
  [["PUT"], /^\/api\/admin\/stores\/[^/]+\/commission$/, "finance.write"],
  [["GET"], /^\/api\/admin\/settlements$/, "finance.read"],
  [["POST"], /^\/api\/admin\/settlements(\/[^/]+\/void)?$/, "finance.write"],

  [["PATCH"], /^\/api\/admin\/stores\/[^/]+\/review$/, "stores.review"], // system_admin only
  [["GET", "PUT"], /^\/api\/admin\/payment-methods(\/[^/]+)?$/, "payments.manage"], // granted to nobody but system_admin unless added to a role
  [["GET"], /^\/api\/admin\/restaurants$/, "stores.read"],
  [["GET"], /^\/api\/admin\/stores\/[^/]+\/overview$/, "stores.read"],
  [["GET"], /^\/api\/admin\/store-types$/, "stores.read"],

  // Reports (section 17). Specific rules first (first match wins); the handler re-checks the report's own permission.
  [["GET"], /^\/api\/admin\/reports$/, SELF], // the handler lists only what the role may open
  [["GET"], /^\/api\/admin\/reports\/(order-financials|commissions|settlements|payments|driver-earnings|reconcile)$/, "finance.read"],
  [["GET"], /^\/api\/admin\/reports\/drivers$/, "drivers.read"],
  [["GET"], /^\/api\/admin\/reports\/exceptions$/, "exceptions.read"],
  [["GET"], /^\/api\/admin\/reports\/(sales|comparison)$/, "reports.read"],
  [["GET"], /^\/api\/admin\/stats$/, "reports.read"],
  [["GET"], /^\/api\/admin\/reports\/orders\.csv$/, "reports.read"],
];

function permissionFor(method, path) {
  const m = String(method || "GET").toUpperCase();
  const p = String(path || "").split("?")[0].replace(/\/+$/, "") || "/";
  for (const [methods, re, perm] of RULES) {
    if (methods.includes(m) && re.test(p)) return perm && typeof perm === "object" ? perm[m] || null : perm;
  }
  return null; // unlisted => system_admin only
}

function normalizeRole(role) {
  const r = String(role || "").trim();
  if (!r || r === "admin") return FULL; // legacy accounts
  return ROLES.includes(r) ? r : null; // unknown role => no access
}

function can(role, perm) {
  const r = normalizeRole(role);
  if (!r) return false;
  if (r === FULL) return true;
  return (PERMISSIONS[r] || []).includes(perm);
}

function permissionsOf(role) {
  const r = normalizeRole(role);
  if (r === FULL) return ["*"];
  return r ? [...(PERMISSIONS[r] || [])] : [];
}

/** @returns {{ok:true}|{ok:false,status:number,error:string}} */
function authorize(role, method, path) {
  const r = normalizeRole(role);
  if (!r) return { ok: false, status: 403, error: "Forbidden" };
  if (r === FULL) return { ok: true };
  const perm = permissionFor(method, path);
  if (perm === SELF) return { ok: true };
  if (perm && can(r, perm)) return { ok: true };
  return { ok: false, status: 403, error: "Forbidden" };
}

/** Permissions that exist but are granted to no role: only system_admin (or a future explicit grant) has them. */
const EXPLICIT_ONLY = Object.freeze(["payments.manage", "exceptions.settings", "complaints.settings", "zones.manage", "settings.read", "settings.write", "settings.dispatch", "audit.read", "backup.read", "backup.create"]);

module.exports = { ROLES, FULL, EXPLICIT_ONLY, PERMISSIONS, SELF, permissionFor, normalizeRole, can, permissionsOf, authorize };

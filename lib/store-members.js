"use strict";
/**
 * Store owner self-service for employees (pure rules, no I/O).
 *
 * - Only an owner (members.write) manages staff, and only inside their own store.
 * - An owner can create managers and cashiers; never another owner (owners are
 *   created by the platform admin), and cannot edit/disable/demote an owner or
 *   themselves, so a store can never lock itself out or escalate.
 * - Passwords: min 8 characters.
 */
const ASSIGNABLE = Object.freeze(["manager", "cashier"]);
const MAX_MEMBERS = 20;
const MIN_PASSWORD = 8;

const digits = (v) => String(v || "").replace(/\D/g, "");
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || ""));

function validateCreate(input, existingForStore, normalizeEmail) {
  const email = normalizeEmail ? normalizeEmail(input && input.email) : String((input && input.email) || "").trim().toLowerCase();
  const phone = digits(input && input.phone).slice(0, 25);
  const password = String((input && input.password) || "");
  const role = String((input && input.role) || "cashier").toLowerCase();
  if (!email && !phone) return { ok: false, status: 400, code: "CONTACT_REQUIRED", error: "Missing email or phone" };
  if (email && !emailOk(email)) return { ok: false, status: 400, code: "BAD_EMAIL", error: "Invalid email" };
  if (phone && phone.length < 6) return { ok: false, status: 400, code: "BAD_PHONE", error: "Invalid phone" };
  if (password.length < MIN_PASSWORD || password.length > 128) return { ok: false, status: 400, code: "WEAK_PASSWORD", error: `Password must be at least ${MIN_PASSWORD} characters` };
  if (!ASSIGNABLE.includes(role)) return { ok: false, status: 400, code: "INVALID_ROLE", error: "Role must be manager or cashier" };
  const list = existingForStore || [];
  if (list.length >= MAX_MEMBERS) return { ok: false, status: 409, code: "LIMIT", error: "Too many members" };
  const dup = list.some((u) => (email && String(u.email || "").toLowerCase() === email) || (phone && digits(u.phone) === phone));
  if (dup) return { ok: false, status: 409, code: "EXISTS", error: "User already exists" };
  return { ok: true, value: { email: email || null, phone: phone || null, password, role } };
}

/** actor: { userId } of the signed-in owner; target: the stored user record. */
function validateUpdate(actor, target, body) {
  if (!target) return { ok: false, status: 404, code: "NOT_FOUND", error: "Not found" };
  if (String(target.role) === "owner") return { ok: false, status: 403, code: "OWNER_PROTECTED", error: "Owners cannot be changed here" };
  if (actor && actor.userId && String(actor.userId) === String(target.id)) return { ok: false, status: 403, code: "SELF", error: "You cannot change your own account here" };
  const patch = {};
  const b = body || {};
  if (b.isActive !== undefined) patch.isActive = b.isActive !== false;
  if (b.role !== undefined) {
    const role = String(b.role).toLowerCase();
    if (!ASSIGNABLE.includes(role)) return { ok: false, status: 400, code: "INVALID_ROLE", error: "Role must be manager or cashier" };
    patch.role = role;
  }
  if (b.password !== undefined) {
    const p = String(b.password || "");
    if (p.length < MIN_PASSWORD || p.length > 128) return { ok: false, status: 400, code: "WEAK_PASSWORD", error: `Password must be at least ${MIN_PASSWORD} characters` };
    patch.password = p;
  }
  if (!Object.keys(patch).length) return { ok: false, status: 400, code: "NOTHING", error: "Nothing to update" };
  return { ok: true, patch };
}

module.exports = { ASSIGNABLE, MAX_MEMBERS, MIN_PASSWORD, validateCreate, validateUpdate };

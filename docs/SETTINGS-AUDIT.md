# Section 19 — System settings and audit logs

## What exists
| Piece | File | Notes |
|---|---|---|
| Tamper-evident audit store | `lib/audit-log.js` | JSONL segments in `data/audit/`, SHA-256 (or HMAC with `AUDIT_HMAC_KEY`) hash chain, append-only, secrets redacted before writing |
| Settings registry | `lib/system-settings.js` | 7 groups, strict server-side bounds, fail-closed audit |
| Routes | `lib/settings-routes.js` | `GET/PUT /api/admin/settings[/:group]`, `GET /api/admin/audit-logs[/verify|/export.csv]`, public `GET /api/public/i18n` |
| Admin page | `public/admin/admin-system.js/.css` | sidebar item "System settings & audit" (route `#/system`) |

## Groups and where each value really lives
`delivery_pricing`, `driver_earnings`, `dispatch` (mode, auto, offer timeout 10–120 s, H3 search rings 1–5) -> `config.json`;
`exceptions` (preparation delay, unassigned timer, redelivery attempts, urgent timer) -> `data/exceptions.json`;
`complaints` (deadlines) -> `data/complaints.json`; `limits` (admin/API request limits, login attempts) -> `config.json`, read live by the rate limiters;
`i18n` (supported languages, default language, announcement) -> `config.json`.
Per-business commissions keep their existing audited endpoint (`PUT /api/admin/stores/:id/commission`).

## Guarantees (all covered by tests)
* Unknown keys and out-of-range values are **rejected**, never clamped; rejected and denied attempts are audited.
* Every change is audited **before** it is applied (intent) and again with `previous`, `next`, `changed`, `result`. If the audit store cannot be written the change is refused (HTTP 503).
* Audit log: no update/delete route or function. Read / verify / export need `audit.read` (system_admin only unless granted explicitly) and are themselves audited.
* Secrets (`password`, `token`, `otp`, `code`, `authorization`...) never reach disk; account numbers are masked to the last 4 characters.
* Rotation by size never deletes records (the old "keep last 5000" truncation was removed).

## Permissions
`settings.read`, `settings.write`, `settings.dispatch`, `audit.read` are explicit-only (system_admin). Behaviour change: **changing dispatch rules** (`POST /api/admin/dispatch/settings`) now needs `settings.dispatch`; order/driver supervisors keep offer/reset interventions (`dispatch.manage`) and see the dispatch group read-only.

## Migration (automatic, first start)
1. `data/audit_logs.json` (legacy) is copied byte-for-byte to `data/audit/legacy-audit_logs.<ts>.json.bak` and the copy's SHA-256 is verified.
2. Entries are imported oldest-first into the chain, flagged `legacy:true` (their authenticity before this point cannot be proven).
3. `data/audit/MIGRATED.json` prevents a second import. The legacy file is never modified or deleted.

**Rollback:** stop the server, restore the previous code; `data/audit_logs.json` is untouched and still valid. Keep `data/audit/` for forensics.

## Operating notes
* Verify integrity: admin page -> Audit log -> "Verify integrity", or `GET /api/admin/audit-logs/verify`.
* Set `AUDIT_HMAC_KEY` (long random value, kept out of git) before the first start to get a keyed chain. Changing it later makes older records fail verification.
* A hash chain **detects** alteration/deletion; it cannot stop someone with disk write access. Restrict OS permissions on `data/audit/` (files are created `0600`) and copy `data/audit/HEAD.json` (last seq + hash) off-host periodically.
* Reading the whole log per request is fine at JSON-storage scale; move to the database if volume grows.

## Not covered here
Notification rules (section 13), service zones (18), per-store business hours (existing store dashboard). The `i18n` group is stored, validated, audited and published at `/api/public/i18n`, but the customer/driver apps do not read it yet.

## Tests
`node --test tests/*.test.js` (439 passing at the time of writing; new: `audit-log`, `system-settings`).
Browser: `node tests/admin-mock-server.js &` then `python3 tests/browser-admin-system.py` (real routes + real role table + real audit store).

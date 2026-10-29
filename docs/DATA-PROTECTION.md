# Section 21 — Data protection, backups and migrations

## Where the data really is
| What | Where | Notes |
|---|---|---|
| Authoritative application data | `data/*.json` | orders, customers, drivers (wallet ledgers), top-ups, settlements, stores, complaints ... written atomically (temp + rename) under a file lock by `server.js` |
| Audit log | `data/audit/` | hash-chained, append-only (section 19) |
| Private documents | `data/private_uploads/` | driver IDs, payment receipts, prescriptions — never served statically |
| Configuration | `config.json` | |
| Public uploads | `uploads/` (production) or `public/uploads/` | product photos, banners, chat attachments |
| PostgreSQL | `DATABASE_URL` | **a mirror** filled by `scripts/migrate-json-to-db.js`. The application does not read it. The JSON files are the source of truth, so they are what a backup must always contain |

## What was added
| Piece | File |
|---|---|
| Backup, verify, restore, integrity, event log | `lib/data-protection.js` |
| Versioned data migrations (+ ledger, rollback) | `lib/data-migrations.js`, `migrations/`, `data/_migrations.json` |
| Guarded PostgreSQL schema step | `lib/db-bootstrap.js` (used by `scripts/prestart.js`) |
| CLI | `scripts/backup.js`, `scripts/migrate-data.js` (`npm run backup -- ...`, `npm run migrate:data`) |
| Admin API (create / verify / list / events / integrity) | `lib/backup-routes.js`, permissions `backup.read`, `backup.create` (system_admin only) |
| Preservation of unreadable data files before they are overwritten | `quarantineIfCorrupt` called from `writeJson` in `server.js` |
| Tests | `tests/data-protection.test.js`, `data-migrations.test.js`, `backup-routes.test.js`, `data-cli.test.js`, `db-bootstrap.test.js` |

## Configuration (environment)
| Variable | Meaning |
|---|---|
| `BACKUP_ENCRYPTION_KEY` | **Required in production.** At least 32 characters (use a random 40+ character string). AES-256-GCM, key derived with scrypt per backup. Store it in your secret manager **and** somewhere offline: **a lost key means the backups cannot be opened** |
| `BACKUP_DIR` | Default `./backups` (owner-only, git-ignored). Prefer a separate disk/volume, and copy finished archives off the host |
| `BACKUP_ALLOW_UNENCRYPTED=1` | Lets production create unencrypted backups. Discouraged; the backup is marked `encrypted:false` |
| `DATA_MIGRATIONS=0` | Skips data migrations at prestart |
| `PRISMA_DB_PUSH=0` | Skips the PostgreSQL schema step at prestart (existing flag) |

No backup schedule is installed or required. Backups are taken **before sensitive changes** (below) and on demand.

## Creating and checking a backup
```
npm run backup -- inventory --uploads            # what would be backed up (size, records, protected/sensitive)
npm run backup -- create --reason "before release 2.4"
npm run backup -- list
npm run backup -- verify <backup-id>             # full re-read
```
A backup is reported successful **only after** it was re-read end to end: file checksum, decryption/authentication, every file hashed against the manifest, JSON files parsed. If that fails the archive is deleted and `backup.failed` is recorded. Warnings (for example a data file that was already unreadable JSON) are reported but the file is still archived as evidence.
Included: `data/` (with audit chain and private documents), `config.json`, `uploads/` (omit with `--no-uploads`), and a `pg_dump` of the database when `DATABASE_URL` is set and `pg_dump` exists (`--no-db` to skip, `--db` to require it). If the database is not included the output says why.
Access: archive, metadata and event log are `0600` in a `0700` directory. There is **no HTTP route to download or restore** a backup.

## Before any sensitive change (checklist)
1. **Identify the affected data**: `npm run backup -- inventory` and, for a migration, its `files` list and `npm run migrate:data -- status`.
2. **Backup**: automatic for data migrations and for the PostgreSQL schema step in production (below). For anything else (manual edits, restores, bulk scripts) run `backup create` first.
3. **Verify** that it printed `OK ... verified` (or run `backup verify <id>`).
4. Apply the change. 5. Verify the affected workflows (checklist at the end). 6. Keep the backup id with the release notes.

## Versioned data migrations
`migrations/NNNN_name.js` — see `migrations/README.md`. `node scripts/prestart.js` (npm run `start:prod`) applies pending ones before the server starts:
* plan: applied vs files on disk; an edited/missing applied migration or an out-of-order one **stops** everything;
* every declared data file must parse, otherwise nothing is touched;
* a **verified backup is taken first**; if it cannot be made (for example no `BACKUP_ENCRYPTION_KEY` in production) the migration does **not** run and production start-up stops;
* `up()` runs on an in-memory copy; files are committed atomically; then the migration's `verify()`, a JSON parse of every written file, and a check that orders, top-ups, settlements, wallet-ledger entries and audit records did **not decrease**;
* the ledger entry is written last. Any failure restores the affected files from the backup (the current versions are kept as `*.rolledback-<time>`) and records `migration.rolled_back`;
* `npm run migrate:data -- --dry-run` shows what would change without writing anything. A run with nothing pending does nothing and takes no backup.
`0001_baseline` adopts the current data under versioning; it changes no data and needs no backup.

## PostgreSQL schema changes
`prisma db push` used to run on every production start with no backup. Now (`lib/db-bootstrap.js`):
* `prisma/migrations/*/migration.sql` present → `prisma migrate deploy` (versioned). Absent (today) → `prisma db push`, never with `--accept-data-loss`;
* in production, if the database has tables (or that cannot be determined), a **verified backup including `pg_dump`** must exist first; no `pg_dump` or a failed backup → the schema step is **not run** and start-up stops with the reason. `PRISMA_DB_PUSH=0` skips the step;
* `pg_dump` receives the connection settings through `PG*` environment variables (no password on a command line) and without `DATABASE_URL`/`BACKUP_ENCRYPTION_KEY` in its environment.
To move to versioned Prisma migrations (**not executed here — requires the Prisma CLI and a database**):
```
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > /tmp/init.sql
mkdir -p prisma/migrations/0_init && mv /tmp/init.sql prisma/migrations/0_init/migration.sql
npx prisma migrate resolve --applied 0_init     # on databases that already have the tables
```

## Rollback and recovery
**A. A data migration failed during start-up.** Nothing to do: the affected files were restored automatically (see `migration.rolled_back` in `npm run backup -- events`). Fix the migration and start again. The migrated copy of a file is next to it as `<file>.rolledback-<time>`.

**B. A migration succeeded but turned out wrong.** The ledger (`data/_migrations.json`) holds `backupId`. Stop the application, then restore only the affected files:
```
npm run backup -- restore <backup-id> --live --confirm <backup-id> --server-stopped --only data/orders.json
```
Then fix/replace the migration (an applied migration cannot be edited: the runner stops with `MIGRATION_MODIFIED`; remove its ledger entry only together with the restore, and keep a copy).

**C. Data damaged or lost.** Stop the application. Restore everything:
```
npm run backup -- restore <backup-id> --live --confirm <backup-id> --server-stopped
```
It verifies the backup, takes a fresh verified **safety backup** of the current state, then swaps `data/`, `config.json` and `uploads/`. The previous directories are **moved** to `<name>.pre-restore-<time>` (not deleted). It reports whether the restored audit chain verifies. **Undo a restore**: stop the app and rename the `.pre-restore-*` directories back.
Everything after the backup time is not in the backup; compare with the `.pre-restore-*` copies before deleting them.

**D. Inspect or recover a single file without touching live data.**
```
npm run backup -- restore <backup-id> --to /tmp/inspect
```
Extracts into a **new** directory (refuses live paths and non-empty directories).

**E. Database.** Restoring PostgreSQL is deliberately manual: extract (C or D) → `database/postgres.dump` (or `restore-<id>-<time>.database.dump` in `BACKUP_DIR`), then
`pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" <dump>` against a database you have confirmed is the right one. Because the database is a mirror, `npm run migrate:json2db` rebuilds it from the JSON data.

**F. Key lost.** Encrypted backups cannot be recovered. Rotate the key for new backups by changing `BACKUP_ENCRYPTION_KEY`; keep the old key for as long as old backups are needed.

After any restore or migration run the checks below.

## Protection of transaction records and audit logs
* No application route deletes orders, top-ups, settlements or wallet-ledger entries (deleting a store that has orders is refused with 409; deleting a customer anonymises orders and keeps ledger entries in a tombstone); the audit log has no update/delete function.
* Audit log: hash chain (optionally keyed by `AUDIT_HMAC_KEY`), segments never deleted; `GET /api/admin/audit-logs/verify`.
* `GET /api/admin/data-integrity` (and `npm run backup -- integrity`) compares the live counters (orders, top-ups, settlements, wallet-ledger entries, audit sequence) with the last verified backup and re-verifies the audit chain; a decrease or an unreadable file is flagged. A migration that would lower a counter is rolled back automatically.
* Backups never replace live records silently: restore moves, it does not delete; prune removes **only backup archives** (never fewer than 3, never the newest verified one).
* `data/` and its private sub-directories are made owner-only (`0700`) at start-up; `config.json` `0600`. Public `uploads/` is left alone because a web server may need to read it.
* A data file that exists but cannot be parsed is copied to `<file>.corrupt-<time>` before the application overwrites it (previously the next save replaced it with defaults).
**Limit:** a hash chain and counters *detect* deletion or alteration; they cannot stop someone who already has write access to the server's disk. Keep an off-host copy of the finished backups and of `data/audit/HEAD.json`.

## Events
Every backup, verification, failure, restore, prune, migration and database schema step is appended to `BACKUP_DIR/EVENTS.jsonl` (actor, time, result, backup id; hash-chained; secrets redacted; `backup events` / `GET /api/admin/backups/events` verify the chain). Actions taken through the admin API are also written to the main audit log. **Actions taken from the CLI or prestart are in `EVENTS.jsonl` only**, because a second process must not write to the running server's audit chain.

## Verify the affected workflows after a migration or restore
Automatic: migration `verify()`, JSON parse of every written file, protected counters, audit chain (restore). Manual (the application must be running):
1. `GET /api/admin/audit-logs/verify` → `integrity.ok: true`; `GET /api/admin/data-integrity` → `report.ok: true`.
2. Admin login; open Orders, Reports → Reconcile; wallet reconcile for one driver.
3. Customer: log in, open order history and wallet. Store: log in, open orders and products. Driver: log in, see offers.
4. Place a test order end to end (cash) and confirm it appears for the store and the supervisor.

## Not covered / honest limits
* A live backup of the running server is consistent **per file** (each file is read from one atomic snapshot), not across files; take backups before changes, or with the application stopped, when cross-file consistency matters.
* The restore of a PostgreSQL dump and any scheduled or off-host copying are manual by design.
* The admin dashboard has no backup page; use the API or the CLI.
* Nothing here was run against a real PostgreSQL server or the real `server.js` (see the test report).

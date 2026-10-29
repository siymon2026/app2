#!/usr/bin/env bash
# Deprecated wrapper, kept so existing habits do not break (spec section 21).
# It used to run an unverified `pg_dump | gzip` and delete backups older than RETENTION_DAYS. It now creates the same
# verified, encrypted backup as `node scripts/backup.js create` (data + config + uploads + database when pg_dump exists).
# No schedule is installed or recommended by default, and nothing is deleted automatically: use `backup.js prune --yes`.
set -euo pipefail
cd "$(dirname "$0")/.."
exec node scripts/backup.js create --reason "${BACKUP_REASON:-manual run of pg-backup.sh}" "$@"

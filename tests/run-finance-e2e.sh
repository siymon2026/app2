#!/usr/bin/env bash
# Run the financial end-to-end checks against an ISOLATED instance.
#
# The server is started with DATA_DIR pointing at a throw-away directory, so the
# real data/ (balances, ledger, admin accounts, audit log) is never touched.
#
#   ./tests/run-finance-e2e.sh            # temp dir, deleted on exit
#   KEEP=1 ./tests/run-finance-e2e.sh     # keep the temp dir for inspection
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-8199}"
TMP="${DATA_DIR:-$(mktemp -d "${TMPDIR:-/tmp}/siymon-e2e-XXXXXX")}"
LOG="$(mktemp "${TMPDIR:-/tmp}/siymon-e2e-log-XXXXXX")"
mkdir -p "$TMP"

cleanup() {
  if [[ -n "${SRV_PID:-}" ]] && kill -0 "$SRV_PID" 2>/dev/null; then
    kill "$SRV_PID" 2>/dev/null || true
    wait "$SRV_PID" 2>/dev/null || true
  fi
  if [[ "${KEEP:-0}" == "1" ]]; then
    echo "data dir kept: $TMP"
    echo "server log:   $LOG"
  else
    rm -rf "$TMP" "$LOG"
  fi
}
trap cleanup EXIT

cd "$ROOT"
echo "== isolated instance on :$PORT (DATA_DIR=$TMP) =="
PORT="$PORT" DATA_DIR="$TMP" JWT_SECRET="e2e-secret-$(date +%s)" ADMIN_PASSWORD="admin123" \
  node server.js >"$LOG" 2>&1 &
SRV_PID=$!

# wait for the port (max ~20s); never guess "it is probably up"
for _ in $(seq 1 40); do
  if curl -fsS "http://127.0.0.1:$PORT/api/restaurants" >/dev/null 2>&1; then break; fi
  if ! kill -0 "$SRV_PID" 2>/dev/null; then
    echo "server exited during startup:"; tail -20 "$LOG"; exit 1
  fi
  sleep 0.5
done

PORT="$PORT" python3 tests/finance-e2e.py --base "http://127.0.0.1:$PORT"

#!/usr/bin/env bash
# Smoke-test a running Synara dev instance (architecture + live RPC probes).
#
# Usage:
#   ./scripts/test-capabilities.sh
#   SYNARA_PORT=58090 ./scripts/test-capabilities.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SERVER_PORT="${SYNARA_PORT:-3773}"
BASE_SERVER_PORT=3773
BASE_WEB_PORT=5733
WEB_PORT="${SYNARA_WEB_PORT:-$((BASE_WEB_PORT + SERVER_PORT - BASE_SERVER_PORT))}"
HEALTH_URL="http://127.0.0.1:${SERVER_PORT}/health"

wait_for_health() {
  local deadline=$((SECONDS + 120))
  while (( SECONDS < deadline )); do
    if curl -sf "$HEALTH_URL" | rg -q '"startupReady"[[:space:]]*:[[:space:]]*true'; then
      echo "OK: server healthy on port ${SERVER_PORT}"
      return 0
    fi
    sleep 1
  done
  echo "FAIL: timed out waiting for ${HEALTH_URL}" >&2
  exit 1
}

echo "== static checks =="
bun scripts/verify-opencode-native.ts
bun scripts/check-opencode-remnants.ts

echo ""
echo "== live server (${SERVER_PORT}) =="
if ! curl -sf "$HEALTH_URL" >/dev/null 2>&1; then
  echo "No server on port ${SERVER_PORT}. Start one first:" >&2
  echo "  ./scripts/dev-local.sh --restart" >&2
  exit 1
fi
wait_for_health

echo ""
echo "== orchestration snapshot =="
bun scripts/probe-orchestration-snapshot.ts "$SERVER_PORT"

echo ""
echo "== compact / queue probe =="
bun scripts/probe-compact-queue-scenario.ts --port "$SERVER_PORT"

echo ""
echo "PASS: capability smoke tests completed"
echo "Open UI: http://localhost:${WEB_PORT}"
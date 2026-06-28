#!/usr/bin/env bash
# Start a single local Synara dev instance (no extra env vars required).
#
# Usage:
#   ./scripts/dev-local.sh              # foreground, default ~/.synara :3773
#   ./scripts/dev-local.sh --restart    # free ports first, then start
#   SYNARA_PORT=58090 ./scripts/dev-local.sh --restart
#
# Optional env:
#   SYNARA_HOME   data directory (default: ~/.synara)
#   SYNARA_PORT   server port (default: 3773; web = 5733 + port - 3773)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

HOME_DIR="${SYNARA_HOME:-$HOME/.synara}"
SERVER_PORT="${SYNARA_PORT:-3773}"
BASE_SERVER_PORT=3773
BASE_WEB_PORT=5733
WEB_PORT="${SYNARA_WEB_PORT:-$((BASE_WEB_PORT + SERVER_PORT - BASE_SERVER_PORT))}"

RESTART=false
EXTRA_ARGS=()

for arg in "$@"; do
  case "$arg" in
    --restart)
      RESTART=true
      ;;
    *)
      EXTRA_ARGS+=("$arg")
      ;;
  esac
done

kill_port() {
  local port="$1"
  local pids
  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    echo "Stopping process on port ${port} (${pids})"
    kill $pids 2>/dev/null || true
    sleep 1
  fi
}

if [[ "$RESTART" == true ]]; then
  kill_port "$SERVER_PORT"
  kill_port "$WEB_PORT"
fi

if lsof -nP -iTCP:"$SERVER_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port ${SERVER_PORT} is already in use. Run with --restart or set SYNARA_PORT." >&2
  exit 1
fi

# Inherited auth tokens from other shells cause empty thread lists in the browser.
unset T3CODE_AUTH_TOKEN

echo "Synara dev"
echo "  home:   ${HOME_DIR}"
echo "  server: http://127.0.0.1:${SERVER_PORT}"
echo "  web:    http://localhost:${WEB_PORT}"
echo ""

if ((${#EXTRA_ARGS[@]} > 0)); then
  exec bun run dev -- \
    --home-dir "$HOME_DIR" \
    --port "$SERVER_PORT" \
    --no-browser \
    "${EXTRA_ARGS[@]}"
fi

exec bun run dev -- \
  --home-dir "$HOME_DIR" \
  --port "$SERVER_PORT" \
  --no-browser
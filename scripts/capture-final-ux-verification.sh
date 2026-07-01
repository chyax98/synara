#!/usr/bin/env bash
set -euo pipefail

SCRATCH="${1:-/var/folders/ss/cgdpql9124x9v6s72r9n1plc0000gn/T/grok-goal-89635e6b8c9a/implementer}"
SYNARA="$(cd "$(dirname "$0")/.." && pwd)"

{
  echo "# final-ux-verification"
  echo "timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  cd "$SYNARA"
  bun fmt
  bun lint
  bun typecheck
  bun run test
} > "$SCRATCH/final-ux-verification.log" 2>&1

echo "Wrote $SCRATCH/final-ux-verification.log"
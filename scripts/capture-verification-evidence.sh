#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRATCH="${SCRATCH:-/var/folders/ss/cgdpql9124x9v6s72r9n1plc0000gn/T/grok-goal-32cea58de0da/implementer}"
mkdir -p "$SCRATCH"

cd "$ROOT"

echo "== mechanical remnants gate ==" | tee "$SCRATCH/remnants-check.txt"
bun scripts/check-opencode-remnants.ts 2>&1 | tee -a "$SCRATCH/remnants-check.txt"

echo "== ui-zh gate ==" | tee "$SCRATCH/ui-zh-check.txt"
bun scripts/check-ui-zh.ts 2>&1 | tee -a "$SCRATCH/ui-zh-check.txt"

echo "== zh strings sample ==" | tee "$SCRATCH/zh-strings.txt"
{
  echo "# Representative Chinese UI strings"
  rg -n '设置|侧边栏|工作树|终端字号|测试通知|恢复默认|托管工作树' \
    apps/web/src/components/Sidebar.tsx \
    apps/web/src/routes/_chat.settings.tsx \
    apps/web/src/components/chat/MessagesTimeline.tsx \
    2>/dev/null | head -40
  echo ""
  echo "# zh-CN locale usage"
  rg -n "zh-CN" apps/web/src --glob '*.ts' --glob '*.tsx' 2>/dev/null | head -20
} | tee -a "$SCRATCH/zh-strings.txt"

echo "== architecture verify ==" | tee "$SCRATCH/dev-dry-combined.log"
bun scripts/verify-opencode-native.ts 2>&1 | tee -a "$SCRATCH/dev-dry-combined.log"

echo "== live server smoke (port 58110) ==" | tee "$SCRATCH/dev-dry-1.log"
SMOKE_PORT=58110 bun scripts/opencode-launch-smoke.ts 2>&1 | tee -a "$SCRATCH/dev-dry-1.log" "$SCRATCH/dev-dry-combined.log"

echo "== live server smoke (port 58111) ==" | tee "$SCRATCH/dev-dry-2.log"
SMOKE_PORT=58111 bun scripts/opencode-launch-smoke.ts 2>&1 | tee -a "$SCRATCH/dev-dry-2.log" "$SCRATCH/dev-dry-combined.log"

echo "== snapshot probe excerpt ==" | tee "$SCRATCH/snapshot-probe.log"
rg -n "SNAPSHOT_|DISCOVERY_|INIT:|VERIFY:|Synara running" \
  "$SCRATCH/dev-dry-1.log" "$SCRATCH/dev-dry-2.log" 2>/dev/null | tee -a "$SCRATCH/snapshot-probe.log"

echo "== final checks ==" | tee "$SCRATCH/final-checks.log"
(bun fmt && bun lint && bun typecheck && bun run test) 2>&1 | tee -a "$SCRATCH/final-checks.log"

echo "Evidence captured under $SCRATCH"
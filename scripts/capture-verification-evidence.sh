#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRATCH="${SCRATCH:-/var/folders/ss/cgdpql9124x9v6s72r9n1plc0000gn/T/grok-goal-32cea58de0da/implementer}"
mkdir -p "$SCRATCH"

cd "$ROOT"

echo "== remnants grep ==" | tee "$SCRATCH/remnants-check.txt"
{
  echo "# ProviderKind literals in production sources (apps/server/src apps/web/src apps/desktop/src packages/contracts packages/shared)"
  echo "# Excludes tests, comments about themes/editors, CSS cursor-* classes, terminal cursor sequences"
  rg -n '"codex"|"claudeAgent"|"claude"|"cursor"|"gemini"|"grok"|"kilo"|"pi"|"cline"' \
    apps/server/src apps/web/src apps/desktop/src packages/contracts/src packages/shared/src \
    --glob '!**/*.test.*' \
    --glob '!**/*.browser.*' \
    2>/dev/null || true
  echo ""
  echo "# ProviderAdapterRegistry references"
  rg -n 'ProviderAdapterRegistry' apps/server/src apps/web/src 2>/dev/null || echo "(none)"
  echo ""
  echo "# Removed subsystem paths"
  for path in apps/server/src/orchestration/handoff.ts apps/server/src/providerUsage packages/effect-acp apps/web/src/whatsNew; do
    if [[ -e "$ROOT/$path" ]]; then
      echo "STILL_EXISTS: $path"
    else
      echo "REMOVED: $path"
    fi
  done
} | tee -a "$SCRATCH/remnants-check.txt"

echo "== zh strings sample ==" | tee "$SCRATCH/zh-strings.txt"
{
  echo "# Representative Chinese UI strings"
  rg -n '设置|侧边栏|发送|已固定|无法|正在准备|导入的 OpenCode|新终端|固定对话|取消固定' \
    apps/web/src/components/Sidebar.tsx \
    apps/web/src/components/chat/environment/EnvironmentPinnedSection.tsx \
    apps/web/src/routes/_chat.settings.tsx \
    apps/web/src/components/ChatView.tsx \
    2>/dev/null | head -40
  echo ""
  echo "# zh-CN locale usage"
  rg -n "zh-CN" apps/web/src --glob '*.ts' --glob '*.tsx' 2>/dev/null | head -20
} | tee -a "$SCRATCH/zh-strings.txt"

echo "== architecture verify ==" | tee "$SCRATCH/dev-dry-combined.log"
bun scripts/verify-opencode-native.ts 2>&1 | tee -a "$SCRATCH/dev-dry-combined.log"

echo "== dev dry-run (offset 3158) ==" | tee "$SCRATCH/dev-dry-1.log"
env -u T3CODE_AUTH_TOKEN T3CODE_PORT_OFFSET=3158 bun run dev -- --home-dir "$ROOT/.synara-plan-opencode" --port 58090 --dry-run 2>&1 | tee -a "$SCRATCH/dev-dry-1.log" "$SCRATCH/dev-dry-combined.log"

echo "== dev dry-run (offset 3159) ==" | tee "$SCRATCH/dev-dry-2.log"
env -u T3CODE_AUTH_TOKEN T3CODE_PORT_OFFSET=3159 bun run dev -- --home-dir "$ROOT/.synara-plan-opencode-2" --port 58091 --dry-run 2>&1 | tee -a "$SCRATCH/dev-dry-2.log" "$SCRATCH/dev-dry-combined.log"

echo "== live snapshot probe ==" | tee -a "$SCRATCH/dev-dry-combined.log"
if curl -sf "http://127.0.0.1:58090/health" >/dev/null 2>&1; then
  bun scripts/probe-orchestration-snapshot.ts 58090 2>&1 | tee "$SCRATCH/snapshot-probe.log" | tee -a "$SCRATCH/dev-dry-combined.log"
else
  echo "SKIP: no server on 58090; start dev server then re-run probe" | tee "$SCRATCH/snapshot-probe.log" | tee -a "$SCRATCH/dev-dry-combined.log"
fi

echo "== final checks ==" | tee "$SCRATCH/final-checks.log"
(bun fmt && bun lint && bun typecheck && bun run test) 2>&1 | tee -a "$SCRATCH/final-checks.log"

echo "Evidence captured under $SCRATCH"
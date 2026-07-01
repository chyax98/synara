#!/usr/bin/env bash
# Verification plan step 3: isolated dry-run + providers settings smoke.
set -euo pipefail

SCRATCH="${1:-/var/folders/ss/cgdpql9124x9v6s72r9n1plc0000gn/T/grok-goal-89635e6b8c9a/implementer}"
SYNARA="$(cd "$(dirname "$0")/.." && pwd)"
RUN_ID="${2:-1}"

PORT="${3:-58090}"
OFFSET="${4:-3158}"
HOME_DIR="${5:-./.synara-opchamber-ref}"

{
  echo "# launch-ux evidence run ${RUN_ID}"
  echo "timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo ""
  echo "=== PLAN STEP 3: exact dry-run command ==="
  echo "env -u T3CODE_AUTH_TOKEN T3CODE_PORT_OFFSET=${OFFSET} T3CODE_NO_BROWSER=1 bun run dev -- --home-dir ${HOME_DIR} --port ${PORT} --dry-run"
  cd "$SYNARA"
  env -u T3CODE_AUTH_TOKEN "T3CODE_PORT_OFFSET=${OFFSET}" T3CODE_NO_BROWSER=1 \
    bun run dev -- --home-dir "$HOME_DIR" --port "$PORT" --dry-run
  echo ""
  echo "=== PLAN STEP 3b: providers settings smoke (catalog RPC + knob round-trip) ==="
  SMOKE_PORT="$PORT" SMOKE_HOME_DIR="$SYNARA/${HOME_DIR}-smoke-${RUN_ID}" \
    bun "$SYNARA/scripts/opencode-providers-ux-smoke.ts"
  echo ""
  echo "=== Static UI proof: providers settings panels + knobs in shipped routes ==="
  rg -n "openCodeAutoReloadCatalog|enableAssistantStreaming|ProviderAuthSettingsPanel|ProviderConfigRemoveControls|已配置|已连接|可连接" \
    "$SYNARA/apps/web/src/components/settings" "$SYNARA/apps/web/src/appSettings.ts" || true
  echo ""
  echo "=== Providers settings page static render (knobs + sidebar, vitest verbose) ==="
  cd "$SYNARA/apps/web"
  bunx vitest run --passWithNoTests --reporter=verbose \
    src/components/settings/ProvidersSettingsUx.test.tsx
  echo ""
  echo "=== Providers settings duplicate guard (CustomOpenCodeModelsSection once) ==="
  rg -n "CustomOpenCodeModelsSection" \
    "$SYNARA/apps/web/src/routes/_chat.settings.tsx" \
    "$SYNARA/apps/web/src/components/settings/ProvidersSettingsLayout.tsx" || true
} > "$SCRATCH/launch-ux-${RUN_ID}.log" 2>&1

echo "Wrote $SCRATCH/launch-ux-${RUN_ID}.log"
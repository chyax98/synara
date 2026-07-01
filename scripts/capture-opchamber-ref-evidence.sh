#!/usr/bin/env bash
# Capture OpenChamber ↔ Synara side-by-side reference mappings for verification step 1.
set -euo pipefail

SCRATCH="${1:-/var/folders/ss/cgdpql9124x9v6s72r9n1plc0000gn/T/grok-goal-89635e6b8c9a/implementer}"
OPENCHAMBER="${OPENCHAMBER_ROOT:-/Users/xd/openchamber}"
OPENCODE="${OPENCODE_ROOT:-/Users/xd/opencode}"
SYNARA="$(cd "$(dirname "$0")/.." && pwd)"

excerpt() {
  local label="$1"
  local file="$2"
  local from="${3:-1}"
  local to="${4:-80}"
  echo ""
  echo "### ${label}"
  echo "FILE: ${file}"
  if [[ -f "$file" ]]; then
    sed -n "${from},${to}p" "$file"
  else
    echo "(missing: $file)"
  fi
}

{
  echo "# OpenChamber / OpenCode ↔ Synara side-by-side mapping"
  echo "generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo ""
  echo "## Summary table"
  echo "| OpenChamber / OpenCode | Synara |"
  echo "|---|---|"
  echo "| \`client.updateConfig()\` | \`orchestrateUpsertCustomProvider\` → \`configUpdate\` RPC |"
  echo "| \`dialog-custom-provider\` auth.set + updateConfig | \`CustomOpenCodeProviderPanel\` + \`upsertCustomProvider\` |"
  echo "| \`GET /api/provider/:id/source\` | \`opencode.providerConfigSources\` |"
  echo "| \`DELETE /auth?scope=...\` + removeProviderConfig | \`opencode.providerDisconnect\` |"
  echo "| \`useUIStore\` hidden/fav/collapsed | \`appSettings\` hiddenModels/favoriteModels/collapsedModelPickerSections |"
  echo "| \`reloadOpenCodeConfiguration\` | \`reloadOpenCodeCatalogAfterMutation\` + manual reload button |"
  echo ""
  echo "## Paired excerpts (OpenChamber)"
  excerpt "OpenChamber ProvidersPage.tsx" \
    "$OPENCHAMBER/packages/ui/src/components/sections/providers/ProvidersPage.tsx" 46 120
  excerpt "OpenChamber ProvidersSidebar.tsx (source fetch)" \
    "$OPENCHAMBER/packages/ui/src/components/sections/providers/ProvidersSidebar.tsx" 1 100
  excerpt "OpenChamber client.ts updateConfig" \
    "$OPENCHAMBER/packages/ui/src/lib/opencode/client.ts" 1280 1320
  excerpt "OpenChamber providers.js getProviderSources" \
    "$OPENCHAMBER/packages/web/server/lib/opencode/providers.js" 1 80
  excerpt "OpenChamber routes.js provider source + DELETE" \
    "$OPENCHAMBER/packages/web/server/lib/opencode/routes.js" 335 420
  excerpt "OpenChamber useUIStore hidden/fav" \
    "$OPENCHAMBER/packages/ui/src/stores/useUIStore.ts" 580 600
  excerpt "OpenChamber useConfigStore (provider sentinel)" \
    "$OPENCHAMBER/packages/ui/src/stores/useConfigStore.ts" 31 40
  echo ""
  echo "## Paired excerpts (Official OpenCode)"
  excerpt "OpenCode dialog-custom-provider.tsx" \
    "$OPENCODE/packages/app/src/components/dialog-custom-provider.tsx" 115 145
  excerpt "OpenCode settings-providers.tsx" \
    "$OPENCODE/packages/app/src/components/settings-providers.tsx" 1 80
  echo ""
  echo "## Paired excerpts (Synara)"
  excerpt "Synara ProvidersSettingsSidebar.tsx" \
    "$SYNARA/apps/web/src/components/settings/ProvidersSettingsSidebar.tsx" 1 140
  excerpt "Synara ProvidersSettingsLayout.tsx (knobs)" \
    "$SYNARA/apps/web/src/components/settings/ProvidersSettingsLayout.tsx" 120 165
  excerpt "Synara CustomOpenCodeProviderPanel.tsx" \
    "$SYNARA/apps/web/src/components/settings/CustomOpenCodeProviderPanel.tsx" 1 80
  excerpt "Synara ProviderConfigRemoveControls.tsx" \
    "$SYNARA/apps/web/src/components/settings/ProviderConfigRemoveControls.tsx" 1 80
  excerpt "Synara openCodeCatalogOrchestration upsertCustomProvider" \
    "$SYNARA/apps/server/src/provider/openCodeCatalogOrchestration.ts" 112 135
  excerpt "Synara openCodeConfigLayers getOpenCodeProviderConfigSources" \
    "$SYNARA/apps/server/src/provider/openCodeConfigLayers.ts" 80 150
  excerpt "Synara appSettings geek knobs" \
    "$SYNARA/apps/web/src/appSettings.ts" 162 196
  excerpt "Synara useOpenCodeModelCatalog merge" \
    "$SYNARA/apps/web/src/hooks/useOpenCodeModelCatalog.ts" 37 120
  echo ""
  echo "## Symbol grep evidence"
  rg -n "orchestrate(UpsertCustomProvider|ProviderDisconnect|AddProviderModel)" \
    "$SYNARA/apps/server/src/provider/openCodeCatalogOrchestration.ts" || true
  rg -n "opencode\.(catalogOverview|configProviders|providerDisconnect|upsertCustomProvider)" \
    "$SYNARA/apps/server/src/wsRpc.ts" | head -10 || true
} > "$SCRATCH/openchamber-ref.txt"

echo "Wrote $SCRATCH/openchamber-ref.txt"
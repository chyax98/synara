#!/usr/bin/env bash
set -euo pipefail

SCRATCH="${1:-/var/folders/ss/cgdpql9124x9v6s72r9n1plc0000gn/T/grok-goal-89635e6b8c9a/implementer}"
SYNARA="$(cd "$(dirname "$0")/.." && pwd)"

{
  echo "# post-ref-greps"
  echo "timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo ""
  echo "## config.update / upsertCustomProvider"
  rg -n "configUpdate|upsertCustomProvider|orchestrateUpsertCustomProvider" \
    "$SYNARA/apps/server/src" "$SYNARA/apps/web/src" --glob '*.{ts,tsx}' | head -40
  echo ""
  echo "## provider disconnect + sources"
  rg -n "providerDisconnect|providerConfigSources|ProviderConfigRemoveControls" \
    "$SYNARA/apps" --glob '*.{ts,tsx}' | head -40
  echo ""
  echo "## appSettings knobs"
  rg -n "openCodeAutoReloadCatalog|enableAssistantStreaming|favoriteModels|collapsedModelPickerSections|hiddenModels" \
    "$SYNARA/apps/web/src/appSettings.ts" "$SYNARA/apps/web/src/components/settings" | head -40
  echo ""
  echo "## merge config providers into catalog"
  rg -n "mergeCatalogAvailabilityWithConfigProviders|configuredOnlyProviders|splitConfiguredSidebarGroups" \
    "$SYNARA/apps/web/src" | head -30
} > "$SCRATCH/post-ref-greps.txt"

echo "Wrote $SCRATCH/post-ref-greps.txt"
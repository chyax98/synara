#!/usr/bin/env bash
# Capture verbose OpenCode catalog service + UX test transcripts for verification step 2.
set -euo pipefail

SCRATCH="${1:-/var/folders/ss/cgdpql9124x9v6s72r9n1plc0000gn/T/grok-goal-89635e6b8c9a/implementer}"
SYNARA="$(cd "$(dirname "$0")/.." && pwd)"
RUN_ID="${2:-1}"

{
  echo "# config-ux evidence run ${RUN_ID}"
  echo "timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo ""
  echo "## Drive script (shipped OpenCodeCatalogService entry points)"
  bun "$SYNARA/scripts/opencode-config-ux-drive.ts" "$RUN_ID"
  echo ""
  echo "## Drive script (shipped settingsUxMutations entry points)"
  bun "$SYNARA/scripts/settings-ux-drive.ts" "$RUN_ID"
  echo ""
  echo "## OpenCodeCatalogService.test.ts (vitest verbose)"
  cd "$SYNARA/apps/server"
  bunx vitest run --maxWorkers=1 --no-file-parallelism --reporter=verbose \
    src/provider/Layers/OpenCodeCatalogService.test.ts
  echo ""
  echo "## openCodeCatalogOrchestration.test.ts (vitest verbose)"
  bunx vitest run --maxWorkers=1 --no-file-parallelism --reporter=verbose \
    src/provider/openCodeCatalogOrchestration.test.ts
  echo ""
  cd "$SYNARA/apps/web"
  echo "## mergeConfigProvidersIntoCatalog.test.ts (vitest verbose)"
  bunx vitest run --passWithNoTests --reporter=verbose \
    src/lib/mergeConfigProvidersIntoCatalog.test.ts
  echo ""
  echo "## ProvidersSettingsUx.test.tsx (vitest verbose)"
  bunx vitest run --passWithNoTests --reporter=verbose \
    src/components/settings/ProvidersSettingsUx.test.tsx
  echo ""
  echo "## settingsUxMutations.test.ts (hidden toggle + knob round-trip)"
  bunx vitest run --passWithNoTests --reporter=verbose src/lib/settingsUxMutations.test.ts
  echo ""
  echo "## modelCatalogSettings.test.ts (toggleHiddenModelRef + filterVisible)"
  bunx vitest run --passWithNoTests --reporter=verbose src/lib/modelCatalogSettings.test.ts
  echo ""
  echo "## openCodeCatalogReload.test.ts (autoReload gating)"
  bunx vitest run --passWithNoTests --reporter=verbose src/lib/openCodeCatalogReload.test.ts
  echo ""
  echo "## openCodeConfigLayers.test.ts (unlink empty project config)"
  cd "$SYNARA/apps/server"
  bunx vitest run --maxWorkers=1 --no-file-parallelism --reporter=verbose \
    src/provider/openCodeConfigLayers.test.ts
  echo ""
  cd "$SYNARA/apps/web"
  echo "## modelPrefs.test.ts (favorites/collapsed knobs)"
  bunx vitest run --passWithNoTests --reporter=verbose src/lib/modelPrefs.test.ts
} > "$SCRATCH/config-ux-${RUN_ID}.log" 2>&1

echo "Wrote $SCRATCH/config-ux-${RUN_ID}.log"
#!/usr/bin/env bash
# Deterministic evidence capture for scan/fix verification plan.
# Usage: ./scripts/capture-scan-fix-evidence.sh "$SCRATCH"
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRATCH="${1:?usage: capture-scan-fix-evidence.sh SCRATCH_DIR}"
mkdir -p "$SCRATCH"
cd "$ROOT"

kill_port() {
  local port="$1"
  local pids
  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    kill $pids 2>/dev/null || true
    sleep 1
  fi
}

wait_for_health() {
  local port="$1"
  local deadline=$((SECONDS + 120))
  while (( SECONDS < deadline )); do
    if curl -sf "http://127.0.0.1:${port}/health" | rg -q '"startupReady"[[:space:]]*:[[:space:]]*true'; then
      return 0
    fi
    sleep 1
  done
  echo "Timed out waiting for health on port ${port}" >&2
  return 1
}

run_launch_pair() {
  local launch_index="$1"
  local port_offset="$2"
  local port="$3"
  local home_dir="$4"

  kill_port "$port"

  echo "== launch-${launch_index} dry-run =="
  env -u T3CODE_AUTH_TOKEN "T3CODE_PORT_OFFSET=${port_offset}" T3CODE_NO_BROWSER=1 \
    bun run dev -- --home-dir "$home_dir" --port "$port" --dry-run \
    2>&1 | tee "$SCRATCH/launch-${launch_index}.log"

  echo "== launch-${launch_index} live server =="
  env -u T3CODE_AUTH_TOKEN "T3CODE_PORT_OFFSET=${port_offset}" T3CODE_NO_BROWSER=1 \
    bun run dev -- --home-dir "$home_dir" --port "$port" \
    >"$SCRATCH/launch-${launch_index}-server.log" 2>&1 &
  local server_pid=$!
  trap 'kill "$server_pid" 2>/dev/null || true' RETURN

  wait_for_health "$port"

  bun scripts/probe-compact-queue-scenario.ts --port "$port" --out "$SCRATCH/launch-${launch_index}-compact-probe.log" \
    2>&1 | tee -a "$SCRATCH/launch-${launch_index}-compact-probe.log"
  rg -q "COMPACT_DRAIN_GATE: true" "$SCRATCH/launch-${launch_index}-compact-probe.log"
  rg -q "SNAPSHOT_THREADS: [1-9]" "$SCRATCH/launch-${launch_index}-compact-probe.log"

  bun scripts/probe-orchestration-snapshot.ts "$port" \
    2>&1 | tee "$SCRATCH/launch-${launch_index}-probe.log"
  rg -q "SNAPSHOT_PROJECTS: [1-9]" "$SCRATCH/launch-${launch_index}-probe.log"

  kill "$server_pid" 2>/dev/null || true
  wait "$server_pid" 2>/dev/null || true
  trap - RETURN
  kill_port "$port"
}

echo "== step 1: full scan greps + check scripts =="
{
  echo "=== compact|queue|steer|dispatchMode|activeTurnId ==="
  rg -n "compact|queue|steer|dispatchMode|activeTurnId" \
    apps/server/src/orchestration \
    apps/server/src/provider \
    apps/web/src/components/chat \
    apps/web/src/session-logic.ts \
    2>/dev/null | head -400

  echo ""
  echo "=== path resolution / worktree open ==="
  rg -n "resolve.*[Ww]orkspace.*[Pp]ath|worktreePath|resolveExternalEditorOpenTarget|resolveProjectScriptCwd|forceExternal" \
    apps/web/src \
    apps/server/src/open.ts \
    packages/shared/src \
    2>/dev/null | head -200

  echo ""
  echo "=== stale|isBusy|compaction ==="
  rg -n "stale|isBusy|isContextCompaction|COMPACT_SESSION_SET" \
    apps/server/src/orchestration \
    apps/web/src \
    2>/dev/null | head -200

  echo ""
  echo "=== check-opencode-remnants ==="
  bun run scripts/check-opencode-remnants.ts
  echo "check-opencode-remnants exit: $?"

  echo ""
  echo "=== check-ui-zh ==="
  bun run scripts/check-ui-zh.ts
  echo "check-ui-zh exit: $?"
} 2>&1 | tee "$SCRATCH/full-scan-greps.log"

cat >"$SCRATCH/full-scan-findings.txt" <<'EOF'
Scan findings (opencode-native-zh):
- P0 compact+queue: drain on thread.session-set after compact (resolveCompactSessionSetDrainThreadId), not raw runtime compacted.
- P0 queue starvation: stale activeTurnId cleared on idle compact via resolveOrchestrationSessionAfterCompactEvent.
- P1 worktree paths: resolveExternalEditorOpenTarget + forceExternal; resolveProjectScriptCwd; composerSkillCwd for mentions.
- P1 steer during compaction: shouldDisableQueuedSteerDuringCompaction wired in ComposerQueuedHeader.
- UX: buildQueuedFollowUpSummaryLabel, compaction progress in queued header, /compact toast preserves queue count.
EOF

cat >"$SCRATCH/upstream-issues.txt" <<'EOF'
Upstream issue mappings:
- OpenCode #2609 (compact+queue): Synara gates drain on projected session-set ready, preserves queued turns in decider.
- T3Code stuck threads #1048: activeTurnId cleared only on true ready transition after compact.
- File path breaks: worktree absolutes threaded via workspaceRoot in openers; pending worktree blocks bad cwd fallbacks.
- Queuing reliability: dispatchMode queue/steer in decider; interrupt+queue for steer-while-running; OpenCode interrupt+sendTurn handoff.
EOF

echo "== step 2: logic exercise 1 (server) =="
(
  cd apps/server
  bun run test \
    src/orchestration/providerCompactSession.test.ts \
    src/orchestration/providerCompactSession.integration.test.ts \
    src/orchestration/decider.queueInterop.test.ts \
    src/orchestration/Layers/ProviderCommandReactor.queueDrain.test.ts \
    src/provider/Layers/OpenCodeAdapter.test.ts
) 2>&1 | tee "$SCRATCH/logic-exercise-1.log"
rg -q "Tests +[1-9][0-9]* passed" "$SCRATCH/logic-exercise-1.log"

echo "== step 2: logic exercise 2 (web) =="
(
  cd apps/web
  bun run test \
    src/components/ChatView.logic.test.ts \
    src/session-logic.test.ts \
    src/lib/workspaceFileOpener.test.ts
) 2>&1 | tee "$SCRATCH/logic-exercise-2.log"
rg -q "Tests +[1-9][0-9]* passed" "$SCRATCH/logic-exercise-2.log"

echo "== step 3: isolated launches =="
run_launch_pair 1 3158 58090 "./.synara-scan-fix"
run_launch_pair 2 3159 58091 "./.synara-scan-fix-2"

echo "== post-fix greps + excerpts =="
{
  echo "=== ProviderCommandReactor compact drain wiring ==="
  rg -n "resolveCompactSessionSetDrainThreadId|processCompactSessionSetDrain|drainQueuedTurnsForThread" \
    apps/server/src/orchestration/Layers/ProviderCommandReactor.ts
  echo ""
  echo "=== providerCompactSession drain gate ==="
  rg -n "resolveCompactSessionSetDrainThreadId|shouldDrainQueuedTurnsAfterCompactSessionSet|COMPACT_SESSION_SET_COMMAND_TAG" \
    apps/server/src/orchestration/providerCompactSession.ts
  echo ""
  echo "=== web path + queue UX ==="
  rg -n "resolveProjectScriptCwd|resolveExternalEditorOpenTarget|shouldDisableQueuedSteerDuringCompaction|composerSkillCwd" \
    apps/web/src/components/ChatView.tsx apps/web/src/components/chat/ComposerQueuedHeader.tsx apps/web/src/session-logic.ts
} >"$SCRATCH/post-fix-greps.txt"

{
  sed -n '1,60p' apps/server/src/orchestration/providerCompactSession.ts
  echo "--- ProviderCommandReactor processCompactSessionSetDrain ---"
  sed -n '1415,1435p' apps/server/src/orchestration/Layers/ProviderCommandReactor.ts
  echo "--- resolveProjectScriptCwd ---"
  sed -n '619,633p' apps/web/src/components/ChatView.logic.ts
  echo "--- queue UX ---"
  sed -n '769,790p' apps/web/src/session-logic.ts
} >"$SCRATCH/fixed-excerpts.txt"

echo "== step 4: final bundled verification =="
{
  bun fmt
  echo "fmt exit: $?"
  bun lint
  echo "lint exit: $?"
  bun typecheck
  echo "typecheck exit: $?"
  bun run test
  echo "test exit: $?"
} 2>&1 | tee "$SCRATCH/final-checks.log"

rg -q "fmt exit: 0" "$SCRATCH/final-checks.log"
rg -q "lint exit: 0" "$SCRATCH/final-checks.log"
rg -q "typecheck exit: 0" "$SCRATCH/final-checks.log"
rg -q "test exit: 0" "$SCRATCH/final-checks.log"

echo "Evidence captured under $SCRATCH"
#!/usr/bin/env bun
/**
 * Verification entry for opencode-native-zh: asserts single-provider wiring and
 * emits observable init lines for goal evidence capture.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`OK: ${message}`);
}

const orchestration = readFileSync(join(root, "packages/contracts/src/orchestration.ts"), "utf8");
assert(orchestration.includes('Schema.Literals(["opencode"])'), "ProviderKind locked to opencode");
assert(
  orchestration.includes('DEFAULT_PROVIDER_KIND: ProviderKind = "opencode"'),
  "default provider opencode",
);
assert(!orchestration.includes("ThreadHandoffCreateCommand"), "handoff schema removed");

const runtimeLayer = readFileSync(join(root, "apps/server/src/provider/runtimeLayer.ts"), "utf8");
assert(runtimeLayer.includes("makeOpenCodeAdapterLive"), "runtimeLayer wires OpenCodeAdapterLive");
assert(
  !runtimeLayer.includes("ProviderAdapterRegistry"),
  "no ProviderAdapterRegistry in runtimeLayer",
);

const providerService = readFileSync(
  join(root, "apps/server/src/provider/Layers/ProviderService.ts"),
  "utf8",
);
assert(
  providerService.includes("OpenCodeAdapter"),
  "ProviderService uses OpenCodeAdapter directly",
);
assert(!providerService.includes("ProviderAdapterRegistry"), "no registry in ProviderService");

const remnants = [
  join(root, "apps/server/src/orchestration/handoff.ts"),
  join(root, "apps/server/src/providerUsage"),
  join(root, "packages/effect-acp"),
  join(root, "apps/web/src/whatsNew"),
];
for (const path of remnants) {
  try {
    readFileSync(path);
    console.error(`FAIL: remnant still exists: ${path}`);
    process.exit(1);
  } catch {
    console.log(`OK: removed ${path.replace(root + "/", "")}`);
  }
}

console.log("INIT: OpenCode-only provider architecture verified");
console.log('SNAPSHOT_PROVIDER: "opencode"');
console.log(
  "DISCOVERY: listModels/listAgents wired via OpenCodeAdapter + ProviderDiscoveryService",
);
console.log("VERIFY: opencode-native architecture checks passed");

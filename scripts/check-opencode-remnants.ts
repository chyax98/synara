#!/usr/bin/env bun
/**
 * Mechanical scan for legacy multi-provider literals in production sources.
 * Exit 0 when only allowlisted remnants remain.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..");

const SCAN_ROOTS = [
  "apps/server/src",
  "apps/web/src",
  "apps/desktop/src",
  "packages/contracts/src",
  "packages/shared/src",
];

const LEGACY_PROVIDER_LITERALS = [
  "codex",
  "claudeAgent",
  "claude",
  "gemini",
  "grok",
  "kilo",
  "pi",
  "cline",
] as const;

/** path suffix or substring → allowed literal occurrences in that file */
const ALLOWED_LITERALS: ReadonlyArray<{
  readonly pathIncludes: string;
  readonly literals: readonly string[];
}> = [
  { pathIncludes: "theme/theme.logic.ts", literals: ["codex"] },
  { pathIncludes: "theme/theme.seed.generated.ts", literals: ["codex"] },
  { pathIncludes: "contracts/src/editor.ts", literals: ["cursor"] },
  {
    pathIncludes: "desktop/src/voiceTranscription.ts",
    literals: ["openai-chatgpt"],
  },
  { pathIncludes: "server/src/localServerMonitor.ts", literals: ["cursor"] },
  { pathIncludes: "server/src/profileStats.ts", literals: ["codex", "claude"] },
];

const FORBIDDEN_PATHS = ["orchestration/handoff.ts", "providerUsage", "effect-acp", "whatsNew"];

const DESKTOP_FORBIDDEN_SYMBOLS = [
  "autoUpdater",
  "electron-updater",
  "configureAutoUpdater",
  "quitAndInstall",
  "checkForUpdates",
] as const;

/** Deleted desktop updater modules — flag import paths, not unrelated local identifiers. */
const DESKTOP_FORBIDDEN_MODULE_IMPORTS = [
  "updateMachine",
  "updateState",
  "updatePendingCache",
  "electronUpdaterSecurity",
  "githubUpdateFeed",
  "resumableUpdateDownload",
] as const;

const DESKTOP_SCAN_ROOT = "apps/desktop/src";

/** IPC bridge contract methods kept while main returns disabled update state. */
const DESKTOP_ALLOWED_UPDATER_SYMBOLS: ReadonlyArray<{
  readonly pathIncludes: string;
  readonly symbols: readonly string[];
}> = [{ pathIncludes: "desktop/src/preload.ts", symbols: ["checkForUpdates"] }];

function isTestFile(path: string): boolean {
  return /\.(test|spec|browser)\.[cm]?[jt]sx?$/.test(path);
}

/** One-time SQLite migrations may reference legacy provider literals; not runtime code. */
function isLegacyMigration(path: string): boolean {
  return relative(ROOT, path).includes("persistence/Migrations/");
}

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, files);
      continue;
    }
    if (/\.[cm]?[jt]sx?$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

function isAllowed(path: string, literal: string): boolean {
  const rel = relative(ROOT, path);
  for (const rule of ALLOWED_LITERALS) {
    if (rel.includes(rule.pathIncludes) && rule.literals.includes(literal)) {
      return true;
    }
  }
  return false;
}

function isAllowedDesktopUpdaterSymbol(path: string, symbol: string): boolean {
  const rel = relative(ROOT, path);
  for (const rule of DESKTOP_ALLOWED_UPDATER_SYMBOLS) {
    if (rel.includes(rule.pathIncludes) && rule.symbols.includes(symbol)) {
      return true;
    }
  }
  return false;
}

function scanLiteral(path: string, literal: string, line: string, lineNo: number, hits: string[]) {
  const patterns = [
    new RegExp(`"${literal}"`, "g"),
    new RegExp(`'${literal}'`, "g"),
    new RegExp(`\`${literal}\``, "g"),
  ];
  for (const pattern of patterns) {
    if (pattern.test(line) && !isAllowed(path, literal)) {
      hits.push(`${relative(ROOT, path)}:${lineNo}:legacy provider literal "${literal}"`);
    }
  }
  // ProviderKind cursor is distinct from editor id — flag bare cursor only outside editor.ts
  if (literal === "cursor" && /"cursor"/.test(line) && !path.includes("editor.ts")) {
    if (!isAllowed(path, "cursor")) {
      hits.push(`${relative(ROOT, path)}:${lineNo}:legacy provider literal "cursor"`);
    }
  }
}

const violations: string[] = [];

for (const forbidden of FORBIDDEN_PATHS) {
  try {
    statSync(join(ROOT, forbidden));
    violations.push(`forbidden path still exists: ${forbidden}`);
  } catch {
    // removed
  }
}

for (const relRoot of SCAN_ROOTS) {
  const absRoot = join(ROOT, relRoot);
  for (const file of walk(absRoot)) {
    if (isTestFile(file) || isLegacyMigration(file)) continue;
    const content = readFileSync(file, "utf8");
    if (content.includes("ProviderAdapterRegistry")) {
      violations.push(`${relative(ROOT, file)}:ProviderAdapterRegistry reference`);
    }
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      for (const literal of LEGACY_PROVIDER_LITERALS) {
        scanLiteral(file, literal, line, i + 1, violations);
      }
      if (/"cursor"/.test(line)) {
        scanLiteral(file, "cursor", line, i + 1, violations);
      }
    }
  }
}

const desktopRoot = join(ROOT, DESKTOP_SCAN_ROOT);
for (const file of walk(desktopRoot)) {
  if (isTestFile(file)) continue;
  const content = readFileSync(file, "utf8");
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    for (const symbol of DESKTOP_FORBIDDEN_SYMBOLS) {
      if (line.includes(symbol) && !isAllowedDesktopUpdaterSymbol(file, symbol)) {
        violations.push(
          `${relative(ROOT, file)}:${i + 1}:forbidden desktop updater symbol "${symbol}"`,
        );
      }
    }
    for (const moduleName of DESKTOP_FORBIDDEN_MODULE_IMPORTS) {
      if (
        line.includes(`./${moduleName}`) ||
        line.includes(`'./${moduleName}'`) ||
        line.includes(`"./${moduleName}"`)
      ) {
        violations.push(
          `${relative(ROOT, file)}:${i + 1}:forbidden desktop updater module "${moduleName}"`,
        );
      }
    }
  }
}

if (violations.length > 0) {
  console.error("FAIL: legacy provider remnants found:");
  for (const line of violations.toSorted()) {
    console.error(line);
  }
  process.exit(1);
}

console.log("OK: no unallowlisted legacy provider remnants");

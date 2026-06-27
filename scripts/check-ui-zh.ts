#!/usr/bin/env bun
/**
 * Scans production UI sources for user-facing English string literals.
 * Strings containing CJK are treated as localized. Exit 0 when clean.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..");
/** Product chrome surfaces that must be fully Chinese per opencode-native-zh. */
const SCAN_ROOTS = [
  "apps/web/src/components/Sidebar.tsx",
  "apps/web/src/routes/_chat.settings.tsx",
  "apps/web/src/components/settings",
  "apps/web/src/components/chat",
  "apps/web/src/components/SettingsSidebarNav.tsx",
  "apps/web/src/components/chat/environment",
];

const ALLOW_PATH_SUBSTRINGS = [
  "theme.seed.generated.ts",
  "theme.logic.ts",
  "index.css",
  "/lib/icons",
  "confirmDialogFallback",
  "contextMenuFallback",
];

const ALLOW_STRING_SUBSTRINGS = [
  "SKILL.md",
  "OpenCode",
  "Synara",
  "Git",
  "http://",
  "https://",
  "ws://",
  "wss://",
  "aria-hidden",
  "data-slot",
  "className",
  "console.",
  ".tsx",
  ".ts",
  "/Users/",
  "127.0.0.1",
  "localhost",
  "VITE_",
  "T3CODE_",
  "WAV",
  "F2",
  "Enter",
  "JSON",
  "RPC",
  "WebSocket",
  "SQLite",
  "npm",
  "bun ",
  "vitest",
  "Codex", // code theme display name in theme pack catalog only
];

/** English tokens that should not appear alone in user-facing copy */
const ENGLISH_DENY = new RegExp(
  "\\b(?:the|and|for|with|could|unable|update|ready|click|workspace|skills?|scanning|delete|loading|found|every|provider|portable|folder|retry|error|failed|success|warning|settings|sidebar|thread|project|conversation|worktree|install|restart|version|unexpected|occurred|check|notifications?|desktop|managed|active|archived|linked|removed|deleted|anyway|disk|verify|reconnect|server|running|supported|discovery|enable|disable|sort|pin|unpin|archive|import|export)\\b",
  "i",
);

const PROP_CAPTURE =
  /(?:title|description|label|tooltip|placeholder|status|aria-label)\s*[:=]\s*(["'`])([^"'`]*)\1/g;

const JSX_TEXT = />\s*([A-Za-z][^<{]{2,}?)\s*</g;

const STRING_LITERAL = /(["'`])((?:(?!\1)[^\\]|\\.)*)\1/g;

function hasCjk(text: string): boolean {
  return /[\u3400-\u9fff]/.test(text);
}

function isTestFile(path: string): boolean {
  return /\.(test|spec|browser)\.[cm]?[jt]sx?$/.test(path);
}

function isAllowedPath(path: string): boolean {
  const rel = relative(ROOT, path);
  return ALLOW_PATH_SUBSTRINGS.some((part) => rel.includes(part));
}

function isAllowedString(text: string): boolean {
  if (hasCjk(text)) return true;
  if (text.trim().length <= 2) return true;
  if (/^[\d\s%.,:;!?()[\]{}+\-*/=<>|&@#$^~`\\]+$/.test(text)) return true;
  if (ALLOW_STRING_SUBSTRINGS.some((part) => text.includes(part))) return true;
  if (/^[a-z]+(-[a-z]+)*$/.test(text.trim())) return true; // kebab identifiers
  if (/^[A-Z][a-zA-Z0-9]*$/.test(text.trim())) return true; // PascalCase components
  // Tailwind / layout class fragments and dev-only placeholders
  if (
    /(?:inline-flex|transition-|hover:|var\(--|absolute |group\/|cursor-grab|tabular-nums|justify-center|shrink-0)/.test(
      text,
    )
  ) {
    return true;
  }
  if (text.startsWith("/path/to/")) return true;
  if (text.includes("must render inside ComposerColumnFrame")) return true;
  return false;
}

function collectScanFiles(): string[] {
  const files: string[] = [];
  for (const rel of SCAN_ROOTS) {
    const full = join(ROOT, rel);
    const stat = statSync(full);
    if (stat.isFile()) {
      files.push(full);
      continue;
    }
    walk(full, files);
  }
  return files;
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

function reportViolation(path: string, lineNo: number, kind: string, text: string, hits: string[]) {
  const snippet = text.length > 80 ? `${text.slice(0, 77)}...` : text;
  hits.push(`${relative(ROOT, path)}:${lineNo}:${kind}:${JSON.stringify(snippet)}`);
}

const violations: string[] = [];

for (const file of collectScanFiles()) {
  if (isTestFile(file) || isAllowedPath(file)) continue;
  const lines = readFileSync(file, "utf8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.trim().startsWith("//")) continue;
    if (line.includes("console.")) continue;

    for (const match of line.matchAll(PROP_CAPTURE)) {
      const text = match[2] ?? "";
      if (!isAllowedString(text) && ENGLISH_DENY.test(text)) {
        reportViolation(file, i + 1, "ui-prop", text, violations);
      }
    }

    for (const match of line.matchAll(JSX_TEXT)) {
      const text = (match[1] ?? "").trim();
      if (!isAllowedString(text) && ENGLISH_DENY.test(text)) {
        reportViolation(file, i + 1, "jsx-text", text, violations);
      }
    }

    // Standalone quoted dialog/toast strings on their own line
    if (
      /(?:toastManager|dialogs\.|confirm\(|alert\()/.test(line) ||
      /^\s*["'`][^"'`]+["'`],?\s*$/.test(line)
    ) {
      for (const match of line.matchAll(STRING_LITERAL)) {
        const text = match[2] ?? "";
        if (!isAllowedString(text) && ENGLISH_DENY.test(text) && text.length > 8) {
          reportViolation(file, i + 1, "string", text, violations);
        }
      }
    }
  }
}

if (violations.length > 0) {
  console.error("FAIL: user-facing English UI strings:");
  for (const line of [...new Set(violations)].toSorted()) {
    console.error(line);
  }
  process.exit(1);
}

console.log("OK: no user-facing English UI violations in scanned sources");

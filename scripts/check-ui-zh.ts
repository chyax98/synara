#!/usr/bin/env bun
/**
 * File-scoped scan for user-facing English in production UI sources.
 * Joins multi-line string literals onto their prop keys; flags [A-Za-z]{3,}
 * unless the whole value is on the brand allowlist. Writes ui-zh-violations.txt.
 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const SCRATCH = process.env.GROK_GOAL_SCRATCH ?? join(ROOT, ".synara-zh-check");
const VIOLATIONS_PATH = join(SCRATCH, "ui-zh-violations.txt");

const SCAN_ROOTS = [
  "apps/web/src/components/ChatView.tsx",
  "apps/web/src/components/Sidebar.tsx",
  "apps/web/src/components/ComposerPromptEditor.tsx",
  "apps/web/src/routes/_chat.settings.tsx",
  "apps/web/src/components/settings",
  "apps/web/src/components/chat",
  "apps/web/src/components/SettingsSidebarNav.tsx",
  "apps/web/src/settingsNavigation.ts",
  "apps/web/src/settingsSearchIndex.ts",
  "apps/desktop/src/main.ts",
];

const ALLOW_PATH_SUBSTRINGS = [
  "theme.seed.generated.ts",
  "theme.logic.ts",
  "index.css",
  "/lib/icons",
  "confirmDialogFallback",
  "contextMenuFallback",
  ".browser.tsx",
  ".test.tsx",
];

/** Tiny brand/technical allowlist — whole value must match exactly. */
const BRAND_ALLOWLIST = new Set([
  "OpenCode",
  "Synara",
  "GitHub",
  "SKILL.md",
  "Fira Code",
  "npm",
  "JSON",
  "RPC",
  "WebSocket",
  "SQLite",
  "WAV",
  "F2",
  "Enter",
  "VITE_",
  "T3CODE_",
  "macOS",
  "OS",
  "UI",
  "CLI",
  "Diff",
  "Terminal",
  "Skill",
  "Environment",
  "Recap",
  "Git",
  "Codex",
  "ChatGPT",
  "Finder",
  "Markdown",
  "Mac",
  "Ctrl",
  "Kanban",
  "npm run dev",
  "provider",
  "Provider",
  "worktree",
  "plan",
  "token",
  "streaming",
  "agent",
  "about",
  "confirm",
]);

/** Status/enum literals — not user-facing copy. */
const STATUS_ENUM_VALUES = new Set([
  "error",
  "disabled",
  "idle",
  "checking",
  "available",
  "downloading",
  "downloaded",
  "inProgress",
  "pending",
  "completed",
  "starting",
  "running",
  "queued",
  "rejected",
]);

const USER_FACING_PROPS = new Set([
  "title",
  "description",
  "label",
  "tooltip",
  "placeholder",
  "status",
  "aria-label",
  "ariaLabel",
  "resetLabel",
  "valueContent",
  "eyebrow",
  "keywords",
  "message",
  "detail",
]);

const ENGLISH_RUN = /[A-Za-z]{3,}/;

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

function stripTemplateExpressions(text: string): string {
  return text.replace(/\$\{[^}]+\}/g, "…");
}

function isBrandAllowedWhole(text: string): boolean {
  const trimmed = text.trim();
  if (BRAND_ALLOWLIST.has(trimmed)) return true;
  if (trimmed.length <= 2) return true;
  if (/^[\d\s%.,:;!?()[\]{}+\-*/=<>|&@#$^~`\\]+$/.test(trimmed)) return true;
  return false;
}

function isLikelyCodeFragment(text: string): boolean {
  return /[{}()=<>|&;]|=>|\.\w|new Set|Promise|ReadonlyArray|boolean/.test(text);
}

function isLikelyCssClass(text: string): boolean {
  return /^(?:text-|inline-|hover:|var\(--|transition-)/.test(text.trim());
}

function containsForbiddenEnglish(text: string, prop: string): boolean {
  const stripped = stripTemplateExpressions(text).trim();
  if (stripped.length === 0) return false;
  if (isBrandAllowedWhole(stripped)) return false;
  if (prop === "status" && STATUS_ENUM_VALUES.has(stripped)) return false;
  if (isLikelyCodeFragment(stripped) || isLikelyCssClass(stripped)) return false;
  if (!ENGLISH_RUN.test(stripped)) return false;
  // Pure English phrases (no CJK) are always violations.
  if (!hasCjk(stripped)) return true;
  // Mixed zh+en: flag Latin words of 4+ letters not on allowlist.
  for (const word of stripped.match(/[A-Za-z]{4,}/g) ?? []) {
    if (!BRAND_ALLOWLIST.has(word) && !BRAND_ALLOWLIST.has(word.toLowerCase())) {
      return true;
    }
  }
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

type ExtractedValue = { prop: string; text: string; line: number };

/** Join continuation string literals after a prop key across newlines. */
function extractUserFacingValues(content: string): ExtractedValue[] {
  const results: ExtractedValue[] = [];
  const lines = content.split("\n");

  const propKeyPattern =
    /^\s*(title|description|label|tooltip|placeholder|status|aria-label|ariaLabel|resetLabel|valueContent|eyebrow|keywords|message|detail)\s*[:=]\s*/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const propMatch = line.match(propKeyPattern);
    if (!propMatch?.[1]) continue;
    const prop = propMatch[1];
    if (!USER_FACING_PROPS.has(prop)) continue;

    const afterKey = line.slice(propMatch[0].length);
    const extracted = extractStringFromPosition(lines, i, afterKey);
    if (extracted) {
      results.push({ prop, text: extracted.text, line: i + 1 });
      i = extracted.endLine;
    }
  }

  // JSX text nodes: >English text< (skip code fragments)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.trim().startsWith("//")) continue;
    for (const match of line.matchAll(/>\s*([A-Za-z][^<{]{2,}?)\s*</g)) {
      const text = (match[1] ?? "").trim();
      if (isLikelyCodeFragment(text)) continue;
      if (!/\s/.test(text) && /^[A-Z][a-zA-Z]+$/.test(text)) continue;
      results.push({ prop: "jsx-text", text, line: i + 1 });
    }
  }

  // Template literals on user-facing props (single-line)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    for (const match of line.matchAll(
      /(?:label|tooltip|title|description|aria-label|ariaLabel)\s*[:=]\s*\{`([^`]+)`\}/g,
    )) {
      results.push({ prop: "template", text: match[1] ?? "", line: i + 1 });
    }
  }

  // dialog.showMessageBox / toast strings in main.ts
  if (content.includes("showMessageBox") || content.includes("dialog.")) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      if (!/(?:title|message|detail)\s*:/.test(line)) continue;
      const propMatch = line.match(/(title|message|detail)\s*:\s*/);
      if (!propMatch?.[1]) continue;
      const afterKey = line.slice(propMatch.index! + propMatch[0].length);
      const extracted = extractStringFromPosition(lines, i, afterKey);
      if (extracted) {
        results.push({ prop: propMatch[1], text: extracted.text, line: i + 1 });
        i = extracted.endLine;
      }
    }
  }

  return results;
}

function extractStringFromPosition(
  lines: string[],
  startLine: number,
  remainder: string,
): { text: string; endLine: number } | null {
  const quoteMatch = remainder.match(/^(['"`])([\s\S]*)/);
  if (!quoteMatch?.[1]) return null;

  const quote = quoteMatch[1];
  let text = quoteMatch[2] ?? "";
  let lineIdx = startLine;

  // Same-line closing quote
  const sameLineClose = findClosingQuote(text, quote);
  if (sameLineClose !== null) {
    return { text: text.slice(0, sameLineClose), endLine: startLine };
  }

  // Multi-line continuation
  const parts: string[] = [text];
  while (lineIdx + 1 < lines.length) {
    lineIdx++;
    const nextLine = lines[lineIdx] ?? "";
    const closeIdx = findClosingQuote(nextLine, quote);
    if (closeIdx !== null) {
      parts.push(nextLine.slice(0, closeIdx));
      return { text: parts.join("\n"), endLine: lineIdx };
    }
    parts.push(nextLine);
  }

  return { text: parts.join("\n"), endLine: lineIdx };
}

function findClosingQuote(text: string, quote: string): number | null {
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\\") {
      i++;
      continue;
    }
    if (text[i] === quote) return i;
  }
  return null;
}

function looksLikeCssOrCode(text: string): boolean {
  return (
    /(?:inline-flex|transition-|hover:|var\(--|absolute |group\/|cursor-grab|tabular-nums|justify-center|shrink-0|className)/.test(
      text,
    ) ||
    text.startsWith("/path/to/") ||
    text.includes("must render inside ComposerColumnFrame")
  );
}

const violations: string[] = [];

for (const file of collectScanFiles()) {
  if (isTestFile(file) || isAllowedPath(file)) continue;
  const content = readFileSync(file, "utf8");
  for (const { prop, text, line } of extractUserFacingValues(content)) {
    if (looksLikeCssOrCode(text)) continue;
    if (containsForbiddenEnglish(text, prop)) {
      const snippet = text.length > 100 ? `${text.slice(0, 97)}...` : text;
      violations.push(
        `${relative(ROOT, file)}:${line}:${prop}:${JSON.stringify(snippet.replace(/\n/g, " "))}`,
      );
    }
  }
}

mkdirSync(dirname(VIOLATIONS_PATH), { recursive: true });
writeFileSync(VIOLATIONS_PATH, violations.join("\n") + (violations.length > 0 ? "\n" : ""));

if (violations.length > 0) {
  console.error(
    `FAIL: ${violations.length} user-facing English UI violation(s) → ${VIOLATIONS_PATH}`,
  );
  for (const line of [...new Set(violations)].toSorted()) {
    console.error(line);
  }
  process.exit(1);
}

console.log("OK: no user-facing English UI violations in scanned sources");

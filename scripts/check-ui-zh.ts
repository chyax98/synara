#!/usr/bin/env bun
/**
 * File-scoped scan for user-facing English in production UI sources.
 * Joins multi-line props; extracts ternaries, aria-label=, inline label: "…".
 * Writes ui-zh-violations.txt. Exit non-zero until empty.
 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const SCRATCH = process.env.GROK_GOAL_SCRATCH ?? join(ROOT, ".synara-zh-check");
const VIOLATIONS_PATH = join(SCRATCH, "ui-zh-violations.txt");

/** Whole-tree scan roots — exhaustive, not hand-picked files. */
const SCAN_ROOTS = ["apps/web/src", "apps/desktop/src/main.ts"];

const ALLOW_PATH_SUBSTRINGS = [
  "theme.seed.generated.ts",
  "theme.logic.ts",
  "index.css",
  "/lib/icons",
];

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
  "Codex",
  "ChatGPT",
  "Finder",
  "Markdown",
  "Ctrl",
  "npm run dev",
  "keybindings.json",
  "Backspace",
  "Shift",
  "Esc",
  "X",
  "Aa",
  "AM",
  "PM",
]);

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

const USER_FACING_PROP_NAMES =
  "title|description|label|tooltip|placeholder|status|aria-label|ariaLabel|resetLabel|valueContent|eyebrow|keywords|message|detail";

const ENGLISH_RUN = /[A-Za-z]{2,}/;

function hasCjk(text: string): boolean {
  return /[\u3400-\u9fff]/.test(text);
}

function isTestFile(path: string): boolean {
  return /\.(test|spec|browser)\.[cm]?[jt]sx?$/.test(path) || path.includes(".browser.");
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
  // Allow punctuation-only; alphabetic 2-char tokens (On/Off) must not pass here.
  if (/^[\d\s%.,:;!?()[\]{}+\-*/=<>|&@#$^~`\\]+$/.test(trimmed)) return true;
  return false;
}

function isLikelyCodeFragment(text: string): boolean {
  return /[{}()=<>|&;]|=>|\.\w|new Set|Promise|ReadonlyArray|boolean|pluralize\(/.test(text);
}

/** Skip enum/CSS/code branches inside JSX ternaries. */
function isCodeTernaryBranch(text: string): boolean {
  const stripped = stripTemplateExpressions(text).trim();
  if (stripped.length === 0) return true;
  if (/^[a-z][a-z0-9_-]*$/.test(stripped)) return true;
  if (/^#[0-9a-f]{3,8}$/i.test(stripped)) return true;
  if (
    /^(?:opacity-|min-w-|max-w-|hidden|flex|block|close|quit|local|default|settled|content|empty|available|unavailable|queue|steer|docked|floating|chat|terminal|pointer-events|ico|png|jpg|svg|off|plan|worktree)$/i.test(
      stripped,
    )
  )
    return true;
  if (
    /^(?:hidden |flex |block |opacity-|min-w-|pointer-events|z-\d|ring-|leading-|truncate|gap-|h-full|right-|top-|rounded-|Ctrl\+)/.test(
      stripped,
    )
  )
    return true;
  if (/pluralize\(/.test(stripped)) return true;
  if (/^Ctrl\+/.test(stripped)) return true;
  if (
    /(?:^|\s)(?:z-\d|opacity-|ring-|leading-|truncate|rounded-|py-\d|gap-|sm:|overflow-|w-full|max-w-|min-h|translate-|right-|top-|text-foreground)/.test(
      stripped,
    )
  )
    return true;
  return false;
}

function isUserFacingTernaryBranch(text: string): boolean {
  if (isCodeTernaryBranch(text)) return false;
  const stripped = stripTemplateExpressions(text).trim();
  if (hasCjk(stripped)) return true;
  return /\s/.test(stripped) || /^[A-Z][a-z]/.test(stripped);
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
  if (!hasCjk(stripped)) return true;
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
      if (!isTestFile(full) && !isAllowedPath(full)) {
        files.push(full);
      }
      continue;
    }
    walk(full, files);
  }
  return files.sort();
}

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, files);
      continue;
    }
    if (!/\.[cm]?[jt]sx?$/.test(entry)) continue;
    if (isTestFile(full) || isAllowedPath(full)) continue;
    files.push(full);
  }
  return files;
}

type ExtractedValue = { prop: string; text: string; line: number };

function lineNumberAt(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

function pushIfViolation(
  results: ExtractedValue[],
  file: string,
  prop: string,
  text: string,
  line: number,
): void {
  results.push({ prop, text, line });
}

function extractQuotedStrings(text: string): string[] {
  const out: string[] = [];
  const re = /(["'`])((?:\\.|(?!\1)[^\\])*?)\1/g;
  for (const m of text.matchAll(re)) {
    if (m[2] !== undefined) out.push(m[2]);
  }
  return out;
}

function extractTemplateLiterals(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/`((?:\\.|[^`\\])*?)`/g)) {
    if (m[1] !== undefined) out.push(m[1]);
  }
  return out;
}

/** Full-file extraction: props, ternaries, aria-label=, inline objects, JSX text. */
function extractUserFacingValues(content: string, filePath: string): ExtractedValue[] {
  const results: ExtractedValue[] = [];
  const lines = content.split("\n");
  const isTsx = filePath.endsWith(".tsx");

  const propKeyPattern = new RegExp(`^\\s*(${USER_FACING_PROP_NAMES})\\s*[:=]\\s*`);

  // 1) Prop keys at line start (with multi-line join)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const propMatch = line.match(propKeyPattern);
    if (!propMatch?.[1]) continue;
    const prop = propMatch[1];
    const afterKey = line.slice(propMatch[0].length);
    const extracted = extractStringFromPosition(lines, i, afterKey);
    if (extracted) {
      pushIfViolation(results, "", prop, extracted.text, i + 1);
      i = extracted.endLine;
    }
  }

  // 2) Inline object props anywhere: label: "App", ariaLabel: "…"
  const inlinePropRe = new RegExp(
    `(?:^|[,{(\\s])(${USER_FACING_PROP_NAMES})\\s*:\\s*(["'\`])`,
    "g",
  );
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.trim().startsWith("//")) continue;
    let m: RegExpExecArray | null;
    inlinePropRe.lastIndex = 0;
    while ((m = inlinePropRe.exec(line)) !== null) {
      const prop = m[1] ?? "inline";
      const afterKey = line.slice(m.index + m[0].length - 1);
      const extracted = extractStringFromPosition(lines, i, afterKey);
      if (extracted) {
        pushIfViolation(results, "", prop, extracted.text, i + 1);
      }
    }
  }

  // 3) JSX user-facing props: label="…", title="…", aria-label="…", etc. (.tsx only)
  const jsxPropAttrRe = new RegExp(`(?:^|[\\s>])(?:${USER_FACING_PROP_NAMES})\\s*=\\s*(["'])`, "g");
  if (!isTsx) {
    // Skip JSX attribute + text-node extraction for plain .ts sources.
  } else
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      if (line.trim().startsWith("//")) continue;
      let m: RegExpExecArray | null;
      jsxPropAttrRe.lastIndex = 0;
      while ((m = jsxPropAttrRe.exec(line)) !== null) {
        const prop = m[0]
          .trim()
          .replace(/\s*=\s*["']$/, "")
          .replace(/^.*\s/, "");
        const quote = m[1] ?? '"';
        const start = (m.index ?? 0) + m[0].length;
        const rest = line.slice(start);
        const close = findClosingQuote(rest, quote);
        if (close !== null) {
          pushIfViolation(results, "", prop, rest.slice(0, close), i + 1);
        }
      }
      for (const m of line.matchAll(
        new RegExp(`(?:${USER_FACING_PROP_NAMES})\\s*=\\s*\\{\\\`([^\\\`]+)\\\`\\}`, "g"),
      )) {
        pushIfViolation(results, "", m[0].split("=")[0]?.trim() ?? "template", m[1] ?? "", i + 1);
      }
    }

  // 4) JSX expressions: ternaries with string/template branches
  const ternaryRe =
    /\?\s*(?:(`[^`]*`)|"([^"]*)"|'([^']*)')\s*:\s*(?:(`[^`]*`)|"([^"]*)"|'([^']*)')/g;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (!line.includes("?")) continue;
    for (const m of line.matchAll(ternaryRe)) {
      const branches = [m[1], m[2], m[3], m[4], m[5], m[6]].filter(
        (b): b is string => typeof b === "string" && b.length > 0,
      );
      for (const branch of branches) {
        const text = branch.startsWith("`") ? branch.slice(1, -1) : branch;
        if (!isUserFacingTernaryBranch(text)) continue;
        pushIfViolation(results, "", "ternary", text, i + 1);
      }
    }
    // Standalone template props: label={`…`} aria-label={cond ? `a` : `b`} already covered
    for (const m of line.matchAll(
      new RegExp(`(?:${USER_FACING_PROP_NAMES})\\s*[:=]\\s*\\{?\\\`([^\\\`]+)\\\`\\}?`, "g"),
    )) {
      pushIfViolation(results, "", "template", m[1] ?? "", i + 1);
    }
  }

  // 5) JSX text nodes (.tsx only — avoids matching TS generics like Array<…> in .ts files)
  if (isTsx) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      if (line.trim().startsWith("//")) continue;
      for (const m of line.matchAll(/>\s*([A-Za-z][^<{]{1,}?)\s*</g)) {
        const text = (m[1] ?? "").trim();
        if (isLikelyCodeFragment(text)) continue;
        if (/^\d+px$/i.test(text)) continue;
        // Single-word labels (Cron, Skills, Save) are user-facing unless brand-allowlisted.
        if (!/\s/.test(text) && isBrandAllowedWhole(text)) continue;
        pushIfViolation(results, "", "jsx-text", text, i + 1);
      }
    }
  }

  // 6) return "…" UI literals in helper functions (.ts + .tsx)
  const returnStringRe = /return\s+(["'`])([\s\S]*?)\1/g;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.trim().startsWith("//")) continue;
    let m: RegExpExecArray | null;
    returnStringRe.lastIndex = 0;
    while ((m = returnStringRe.exec(line)) !== null) {
      const text = m[2] ?? "";
      if (text.length === 0 || isLikelyCodeFragment(text)) continue;
      const stripped = stripTemplateExpressions(text).trim();
      // Skip internal enum/id tokens (worktree, opencode, arrowup, lastTurn, …).
      if (/^[a-z][a-z0-9_.-]*$/i.test(stripped)) continue;
      if (/^\d+(?:ms|px|%)?$/i.test(stripped)) continue;
      if (/^(?:border-|bg-|text-|px-|py-|opacity-)/.test(stripped)) continue;
      if (!containsForbiddenEnglish(stripped, "return")) continue;
      pushIfViolation(results, "", "return", text, i + 1);
    }
  }

  // 7) Multi-line JSX text in common dialog/label wrappers
  const multilineJsxRe =
    /<(?:DialogDescription|DialogTitle|EmptyPanel|SectionHeader|MenuGroupLabel)(?:\s[^>]*)?>\s*([\s\S]*?)\s*<\/(?:DialogDescription|DialogTitle|EmptyPanel|SectionHeader|MenuGroupLabel)>/g;
  for (const m of content.matchAll(multilineJsxRe)) {
    const text = (m[1] ?? "").replace(/\s+/g, " ").trim();
    if (text.length === 0 || isLikelyCodeFragment(text)) continue;
    pushIfViolation(results, "", "jsx-block", text, lineNumberAt(content, m.index ?? 0));
  }

  // 8) dialog strings in main.ts
  if (content.includes("showMessageBox")) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      const propMatch = line.match(/(title|message|detail)\s*:\s*/);
      if (!propMatch?.[1]) continue;
      const afterKey = line.slice(propMatch.index! + propMatch[0].length);
      const extracted = extractStringFromPosition(lines, i, afterKey);
      if (extracted) {
        pushIfViolation(results, "", propMatch[1], extracted.text, i + 1);
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

  const sameLineClose = findClosingQuote(text, quote);
  if (sameLineClose !== null) {
    return { text: text.slice(0, sameLineClose), endLine: startLine };
  }

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
  for (const { prop, text, line } of extractUserFacingValues(content, file)) {
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

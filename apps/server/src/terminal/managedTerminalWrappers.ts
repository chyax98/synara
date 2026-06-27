// FILE: managedTerminalWrappers.ts
// Purpose: Create managed command wrappers so terminal agent identity is canonical
// and survives zsh startup that rewrites PATH.

import fs from "node:fs";
import path from "node:path";

import {
  T3CODE_TERMINAL_HOOK_OSC_PREFIX,
  T3CODE_TERMINAL_CLI_KIND_ENV_KEY,
  type TerminalAgentHookEventType,
} from "@t3tools/shared/terminalThreads";

const OPENCODE_CLI_COMMAND = "opencode";
const OPENCODE_TERMINAL_TITLE = "OpenCode";

export interface ManagedTerminalWrapperState {
  binDir: string | null;
  hookScriptPath: string | null;
  zshDir: string | null;
  targetPathByCliKind: Partial<Record<typeof OPENCODE_CLI_COMMAND, string>>;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\"'\"'`)}'`;
}

function envPathKeyFor(env: NodeJS.ProcessEnv): "PATH" | "Path" | "path" {
  if ("PATH" in env) return "PATH";
  if ("Path" in env) return "Path";
  return "path";
}

function isExecutableFile(filePath: string): boolean {
  try {
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) {
      return false;
    }
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function executableCandidates(commandName: string): string[] {
  if (process.platform !== "win32") {
    return [commandName];
  }

  const pathExt = process.env.PATHEXT?.split(";").filter(Boolean) ?? [".EXE", ".CMD", ".BAT"];
  const lowerCommandName = commandName.toLowerCase();
  const hasExtension = pathExt.some((extension) =>
    lowerCommandName.endsWith(extension.toLowerCase()),
  );
  return hasExtension ? [commandName] : pathExt.map((extension) => `${commandName}${extension}`);
}

function resolveExecutableOnPath(commandName: string, env: NodeJS.ProcessEnv): string | null {
  const envPathKey = envPathKeyFor(env);
  const envPath = env[envPathKey]?.trim();
  if (!envPath) {
    return null;
  }

  for (const entry of envPath.split(path.delimiter)) {
    const directory = entry.trim();
    if (!directory) {
      continue;
    }
    for (const candidateName of executableCandidates(commandName)) {
      const candidatePath = path.join(directory, candidateName);
      if (isExecutableFile(candidatePath)) {
        return candidatePath;
      }
    }
  }

  return null;
}

function buildHookOscSequence(eventType: TerminalAgentHookEventType): string {
  return `\\033]${T3CODE_TERMINAL_HOOK_OSC_PREFIX}${eventType}\\007`;
}

function buildNotifyHookScript(): string {
  return `#!/bin/sh
set -eu
if [ "$#" -gt 0 ]; then
  _t3code_hook_input="$1"
else
  _t3code_hook_input="$(cat)"
fi

_t3code_extract_event() {
  printf '%s' "$_t3code_hook_input" | sed -n "s/.*\\\"$1\\\"[[:space:]]*:[[:space:]]*\\\"\\([^\\\"]*\\)\\\".*/\\1/p" | head -n 1
}

_t3code_event="$(_t3code_extract_event hook_event_name)"
if [ -z "$_t3code_event" ]; then
  _t3code_type="$(_t3code_extract_event type)"
  case "$_t3code_type" in
    task_started|userPromptSubmitted|user_prompt_submit)
      _t3code_event="Start"
      ;;
    task_complete|agent-turn-complete|stop|session_end|sessionEnd)
      _t3code_event="Stop"
      ;;
    exec_approval_request|apply_patch_approval_request|request_user_input)
      _t3code_event="PermissionRequest"
      ;;
  esac
fi

_t3code_emit_osc() {
  _t3code_sequence="$1"
  if [ -w /dev/tty ]; then
    printf '%b' "$_t3code_sequence" > /dev/tty 2>/dev/null || printf '%b' "$_t3code_sequence"
    return
  fi
  printf '%b' "$_t3code_sequence"
}

case "$_t3code_event" in
  UserPromptSubmit|PostToolUse|PostToolUseFailure|Start)
    _t3code_emit_osc '${buildHookOscSequence("Start")}'
    ;;
  Stop)
    _t3code_emit_osc '${buildHookOscSequence("Stop")}'
    ;;
  PermissionRequest|PreToolUse|Notification)
    _t3code_emit_osc '${buildHookOscSequence("PermissionRequest")}'
    ;;
esac
`;
}

function buildOpenCodeWrapperScript(input: {
  notifyHookPath: string;
  targetPath: string;
}): string {
  const { notifyHookPath, targetPath } = input;
  return [
    `printf '\\033]0;%s\\007' ${shellQuote(OPENCODE_TERMINAL_TITLE)}`,
    `export ${T3CODE_TERMINAL_CLI_KIND_ENV_KEY}=${shellQuote(OPENCODE_CLI_COMMAND)}`,
    `exec ${shellQuote(targetPath)} "$@"`,
    "",
  ].join("\n");
}

function writeFileIfChanged(filePath: string, content: string, mode: number): void {
  const currentContent = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
  if (currentContent !== content) {
    fs.writeFileSync(filePath, content, { mode });
  }
  try {
    fs.chmodSync(filePath, mode);
  } catch {
    // Best effort.
  }
}

function buildManagedZshRc(quotedZshDir: string): string {
  return `# Synara zsh rc wrapper
_t3code_home="\${T3CODE_ORIGINAL_ZDOTDIR:-$HOME}"
export ZDOTDIR="$_t3code_home"
[[ -f "$_t3code_home/.zshrc" ]] && source "$_t3code_home/.zshrc"
export ZDOTDIR=${quotedZshDir}
if [ -n "\${T3CODE_MANAGED_BIN_DIR:-}" ] && [ -d "\${T3CODE_MANAGED_BIN_DIR}" ]; then
  case ":$PATH:" in
    *:\${T3CODE_MANAGED_BIN_DIR}:*) ;;
    *) export PATH="\${T3CODE_MANAGED_BIN_DIR}:$PATH" ;;
  esac
  unalias opencode 2>/dev/null || true
  opencode() {
    if [ -x "\${T3CODE_MANAGED_BIN_DIR}/opencode" ] && [ ! -d "\${T3CODE_MANAGED_BIN_DIR}/opencode" ]; then
      "\${T3CODE_MANAGED_BIN_DIR}/opencode" "$@"
    else
      command opencode "$@"
    fi
  }
  typeset -ga precmd_functions 2>/dev/null || true
  _t3code_ensure_managed_bin() {
    case ":$PATH:" in
      *:\${T3CODE_MANAGED_BIN_DIR}:*) ;;
      *) PATH="\${T3CODE_MANAGED_BIN_DIR}:$PATH" ;;
    esac
  }
  {
    precmd_functions=(\${precmd_functions:#_t3code_ensure_managed_bin} _t3code_ensure_managed_bin)
  } 2>/dev/null || true
fi
`;
}

function ensureManagedZshWrappers(zshDir: string): void {
  fs.mkdirSync(zshDir, { recursive: true });
  const quotedZshDir = shellQuote(zshDir);
  writeFileIfChanged(
    path.join(zshDir, ".zshenv"),
    `# Synara zsh env wrapper
_t3code_home="\${T3CODE_ORIGINAL_ZDOTDIR:-$HOME}"
export ZDOTDIR="$_t3code_home"
[[ -f "$_t3code_home/.zshenv" ]] && source "$_t3code_home/.zshenv"
export ZDOTDIR=${quotedZshDir}
`,
    0o644,
  );
  writeFileIfChanged(
    path.join(zshDir, ".zprofile"),
    `# Synara zsh profile wrapper
_t3code_home="\${T3CODE_ORIGINAL_ZDOTDIR:-$HOME}"
export ZDOTDIR="$_t3code_home"
[[ -f "$_t3code_home/.zprofile" ]] && source "$_t3code_home/.zprofile"
export ZDOTDIR=${quotedZshDir}
`,
    0o644,
  );
  writeFileIfChanged(path.join(zshDir, ".zshrc"), buildManagedZshRc(quotedZshDir), 0o644);
}

export function prepareManagedTerminalWrappers(options: {
  baseEnv: NodeJS.ProcessEnv;
  rootDir: string;
  zshRootDir: string;
}): ManagedTerminalWrapperState {
  if (process.platform === "win32") {
    return {
      binDir: null,
      hookScriptPath: null,
      zshDir: null,
      targetPathByCliKind: {},
    };
  }

  const targetPath = resolveExecutableOnPath(OPENCODE_CLI_COMMAND, options.baseEnv);
  if (!targetPath) {
    return {
      binDir: null,
      hookScriptPath: null,
      zshDir: null,
      targetPathByCliKind: {},
    };
  }

  fs.mkdirSync(options.rootDir, { recursive: true });
  const hookScriptPath = path.join(options.rootDir, "notify-hook.sh");
  writeFileIfChanged(hookScriptPath, buildNotifyHookScript(), 0o755);
  writeFileIfChanged(
    path.join(options.rootDir, OPENCODE_CLI_COMMAND),
    buildOpenCodeWrapperScript({
      notifyHookPath: hookScriptPath,
      targetPath,
    }),
    0o755,
  );
  ensureManagedZshWrappers(options.zshRootDir);

  return {
    binDir: options.rootDir,
    hookScriptPath,
    zshDir: options.zshRootDir,
    targetPathByCliKind: {
      [OPENCODE_CLI_COMMAND]: targetPath,
    },
  };
}

function applyManagedTerminalWrapperEnvState(
  env: NodeJS.ProcessEnv,
  wrapperState: {
    binDir: string | null;
    zshDir: string | null;
  },
): NodeJS.ProcessEnv {
  if (!wrapperState.binDir) {
    return env;
  }

  const envPathKey = envPathKeyFor(env);
  const currentPath = env[envPathKey]?.trim() ?? "";
  const currentEntries = currentPath
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (!currentEntries.includes(wrapperState.binDir)) {
    currentEntries.unshift(wrapperState.binDir);
  }

  return {
    ...env,
    T3CODE_MANAGED_BIN_DIR: wrapperState.binDir,
    T3CODE_ORIGINAL_ZDOTDIR: env.ZDOTDIR ?? env.HOME ?? "",
    ...(wrapperState.zshDir ? { ZDOTDIR: wrapperState.zshDir } : {}),
    [envPathKey]: currentEntries.join(path.delimiter),
  };
}

export function applyManagedTerminalAgentWrapperEnv(
  env: NodeJS.ProcessEnv,
  wrapperState: {
    binDir: string | null;
    zshDir: string | null;
  },
): NodeJS.ProcessEnv {
  return applyManagedTerminalWrapperEnvState(env, wrapperState);
}

export function prepareManagedTerminalAgentWrappers(options: {
  baseEnv: NodeJS.ProcessEnv;
  targetDir: string;
  zshDir: string;
}): ManagedTerminalWrapperState {
  return prepareManagedTerminalWrappers({
    baseEnv: options.baseEnv,
    rootDir: options.targetDir,
    zshRootDir: options.zshDir,
  });
}

export function prependManagedTerminalAgentWrapperPath(
  env: NodeJS.ProcessEnv,
  managedWrapperState: {
    binDir: string | null;
    zshDir: string | null;
  },
): NodeJS.ProcessEnv {
  return applyManagedTerminalWrapperEnvState(env, managedWrapperState);
}
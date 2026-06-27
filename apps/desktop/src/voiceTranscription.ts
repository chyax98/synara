// FILE: voiceTranscription.ts
// Purpose: Owns the desktop-specific voice transcription flow for Electron builds.
// Layer: Desktop IPC + ChatGPT upload bridge
// Depends on: OpenCode credential storage, Electron net uploads, and the shared server voice contract.

import * as Crypto from "node:crypto";
import * as FS from "node:fs/promises";
import * as OS from "node:os";
import * as Path from "node:path";

import { ipcMain, net } from "electron";
import type {
  ServerVoiceTranscriptionInput,
  ServerVoiceTranscriptionResult,
} from "@t3tools/contracts";

export const SERVER_TRANSCRIBE_VOICE_CHANNEL = "desktop:server-transcribe-voice";

const CHATGPT_TRANSCRIPTIONS_URL = "https://chatgpt.com/backend-api/transcribe";
const MAX_VOICE_AUDIO_BYTES = 10 * 1024 * 1024;
const MAX_VOICE_DURATION_MS = 120_000;
const CHATGPT_AUTH_PROVIDER_IDS = ["chatgpt", "openai", "openai-chatgpt"] as const;

// --- Input validation ------------------------------------------------------

function normalizeVoiceBase64(value: string): string | null {
  const normalized = value.trim().replace(/\s+/g, "");
  return normalized.length > 0 ? normalized : null;
}

function isLikelyVoiceBase64(value: string): boolean {
  return /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

function isLikelyWavBuffer(buffer: Buffer): boolean {
  return (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WAVE"
  );
}

function decodeDesktopVoiceAudio(input: ServerVoiceTranscriptionInput): Buffer {
  if (input.mimeType !== "audio/wav") {
    throw new Error("语音转写仅支持 WAV 音频。");
  }
  if (input.sampleRateHz !== 24_000) {
    throw new Error("语音转写需要 24 kHz 单声道 WAV 音频。");
  }
  if (input.durationMs <= 0) {
    throw new Error("语音消息时长必须大于 0。");
  }
  if (input.durationMs > MAX_VOICE_DURATION_MS) {
    throw new Error("语音消息最长 120 秒。");
  }

  const normalizedBase64 = normalizeVoiceBase64(input.audioBase64);
  if (!normalizedBase64 || !isLikelyVoiceBase64(normalizedBase64)) {
    throw new Error("无法解码录制的音频。");
  }

  const audioBuffer = Buffer.from(normalizedBase64, "base64");
  if (!audioBuffer.length || audioBuffer.toString("base64") !== normalizedBase64) {
    throw new Error("无法解码录制的音频。");
  }
  if (audioBuffer.length > MAX_VOICE_AUDIO_BYTES) {
    throw new Error("语音消息最大 10 MB。");
  }
  if (!isLikelyWavBuffer(audioBuffer)) {
    throw new Error("录制的音频不是有效的 WAV 文件。");
  }

  return audioBuffer;
}

function readNonEmptyString(value: unknown): string | null {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized.length > 0 ? normalized : null;
}

function resolveOpenCodeDataDirectory(homeDirectory = OS.homedir()): string {
  if (process.platform === "win32") {
    const appDataDirectory =
      readNonEmptyString(process.env.APPDATA) ?? Path.join(homeDirectory, "AppData", "Roaming");
    return Path.join(appDataDirectory, "opencode");
  }

  const xdgDataHome =
    readNonEmptyString(process.env.XDG_DATA_HOME) ?? Path.join(homeDirectory, ".local", "share");
  return Path.join(xdgDataHome, "opencode");
}

function readChatGptTokenFromCredential(credential: unknown): string | null {
  if (!credential || typeof credential !== "object" || Array.isArray(credential)) {
    return null;
  }
  const record = credential as Record<string, unknown>;
  return (
    readNonEmptyString(record.access) ??
    readNonEmptyString(record.id_token) ??
    readNonEmptyString(record.token) ??
    readNonEmptyString(record.key)
  );
}

function matchesChatGptProviderId(providerId: string): boolean {
  const normalized = providerId.trim().toLowerCase();
  return CHATGPT_AUTH_PROVIDER_IDS.some(
    (candidate) => normalized === candidate || normalized.includes("chatgpt"),
  );
}

async function readJsonFile(path: string): Promise<unknown | null> {
  try {
    return JSON.parse(await FS.readFile(path, "utf8")) as unknown;
  } catch {
    return null;
  }
}

// --- Auth discovery --------------------------------------------------------

async function resolveDesktopVoiceAuth(): Promise<{ token: string; transcriptionUrl: string }> {
  const dataDir = resolveOpenCodeDataDirectory();
  const authJson = await readJsonFile(Path.join(dataDir, "auth.json"));
  if (authJson && typeof authJson === "object" && !Array.isArray(authJson)) {
    for (const [providerId, value] of Object.entries(authJson as Record<string, unknown>)) {
      if (!matchesChatGptProviderId(providerId) || !value || typeof value !== "object") {
        continue;
      }
      const token = readChatGptTokenFromCredential(value);
      if (token) {
        return { token, transcriptionUrl: CHATGPT_TRANSCRIPTIONS_URL };
      }
    }
  }

  const accountJson = await readJsonFile(Path.join(dataDir, "account.json"));
  if (accountJson && typeof accountJson === "object" && !Array.isArray(accountJson)) {
    const accounts = (accountJson as Record<string, unknown>).accounts;
    if (accounts && typeof accounts === "object" && !Array.isArray(accounts)) {
      for (const value of Object.values(accounts)) {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          continue;
        }
        const record = value as Record<string, unknown>;
        const serviceId = readNonEmptyString(record.serviceID) ?? "";
        if (!matchesChatGptProviderId(serviceId)) {
          continue;
        }
        const token = readChatGptTokenFromCredential(record.credential);
        if (token) {
          return { token, transcriptionUrl: CHATGPT_TRANSCRIPTIONS_URL };
        }
      }
    }
  }

  throw new Error("语音转写需要 OpenCode ChatGPT 登录。请运行 `opencode providers login` 后重试。");
}

// --- Network upload --------------------------------------------------------

async function requestDesktopVoiceTranscription(input: {
  readonly audioBuffer: Buffer;
  readonly mimeType: string;
  readonly token: string;
  readonly transcriptionUrl: string;
}): Promise<{ statusCode: number; body: string }> {
  const boundary = `SynaraVoice-${Crypto.randomUUID()}`;
  const preamble = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="voice.wav"\r\nContent-Type: ${input.mimeType}\r\n\r\n`,
    "utf8",
  );
  const closing = Buffer.from(`\r\n--${boundary}--\r\n`, "utf8");
  const body = Buffer.concat([preamble, input.audioBuffer, closing]);

  return new Promise((resolve, reject) => {
    const requestUrl = readNonEmptyString(input.transcriptionUrl) ?? CHATGPT_TRANSCRIPTIONS_URL;
    const request = net.request({
      method: "POST",
      url: requestUrl,
    });
    request.setHeader("Authorization", `Bearer ${input.token}`);
    request.setHeader("Content-Type", `multipart/form-data; boundary=${boundary}`);

    request.once("error", (error) => {
      reject(new Error(`语音转写请求失败：${error.message}`));
    });
    request.on("response", (response) => {
      let responseBody = "";
      response.on("data", (chunk) => {
        responseBody += chunk.toString();
      });
      response.once("end", () => {
        resolve({
          statusCode: response.statusCode,
          body: responseBody,
        });
      });
      response.once("error", (error) => {
        reject(new Error(`语音转写响应失败：${error.message}`));
      });
    });

    request.write(body);
    request.end();
  });
}

function readVoiceResponseErrorMessage(statusCode: number, body: string): string {
  try {
    const payload = JSON.parse(body) as { error?: { message?: unknown }; message?: unknown };
    const providerMessage =
      readNonEmptyString(payload.error?.message) ?? readNonEmptyString(payload.message);
    if (providerMessage) {
      return providerMessage;
    }
  } catch {
    // Fall back to a status-based message when the upstream body is not JSON.
  }

  if (statusCode === 401) {
    return "ChatGPT 登录已过期，请重新登录。";
  }
  if (statusCode === 403) {
    return "ChatGPT 拒绝了转写请求。OpenCode 登录有效，但桌面端上传被拒绝。";
  }

  return `转写失败，状态码 ${statusCode}。`;
}

// --- IPC entrypoint --------------------------------------------------------

async function transcribeVoiceViaDesktopBridge(
  input: ServerVoiceTranscriptionInput,
): Promise<ServerVoiceTranscriptionResult> {
  const audioBuffer = decodeDesktopVoiceAudio(input);
  const auth = await resolveDesktopVoiceAuth();
  const response = await requestDesktopVoiceTranscription({
    audioBuffer,
    mimeType: input.mimeType,
    token: auth.token,
    transcriptionUrl: auth.transcriptionUrl,
  });
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(readVoiceResponseErrorMessage(response.statusCode, response.body));
  }

  const payload = JSON.parse(response.body) as { text?: unknown; transcript?: unknown };
  const text = readNonEmptyString(payload.text) ?? readNonEmptyString(payload.transcript);
  if (!text) {
    throw new Error("转写响应未包含文本。");
  }

  return { text };
}

export function registerDesktopVoiceTranscriptionHandler(): void {
  ipcMain.removeHandler(SERVER_TRANSCRIBE_VOICE_CHANNEL);
  ipcMain.handle(
    SERVER_TRANSCRIBE_VOICE_CHANNEL,
    async (_event, input: ServerVoiceTranscriptionInput) => transcribeVoiceViaDesktopBridge(input),
  );
}

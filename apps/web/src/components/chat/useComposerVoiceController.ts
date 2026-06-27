// FILE: useComposerVoiceController.ts
// Purpose: Own the composer voice-note state machine for recording, cancellation, and transcription.
// Layer: Chat composer hook
// Depends on: useVoiceRecorder, ChatView voice helper logic, and the native API voice endpoint.

import { type ProviderKind, type ServerProviderStatus, type ThreadId } from "@t3tools/contracts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Project } from "../../types";
import { formatVoiceRecordingDuration, useVoiceRecorder } from "../../lib/voiceRecorder";
import { readNativeApi } from "../../nativeApi";
import { toastManager } from "../ui/toast";
import {
  deriveComposerVoiceState,
  describeVoiceRecordingStartError,
  isVoiceAuthExpiredMessage,
  sanitizeVoiceErrorMessage,
} from "../ChatView.logic";

interface UseComposerVoiceControllerOptions {
  activeProject: Project | undefined;
  activeThreadId: ThreadId | null;
  threadId: ThreadId;
  selectedProvider: ProviderKind;
  activeProviderStatus: ServerProviderStatus | null;
  pendingUserInputCount: number;
  onTranscriptReady: (transcript: string) => void;
  refreshVoiceStatus: () => void;
}

interface UseComposerVoiceControllerResult {
  isVoiceRecording: boolean;
  isVoiceTranscribing: boolean;
  voiceWaveformLevels: readonly number[];
  voiceRecordingDurationLabel: string;
  showVoiceNotesControl: boolean;
  startComposerVoiceRecording: () => Promise<void>;
  submitComposerVoiceRecording: () => Promise<void>;
  cancelComposerVoiceRecording: () => void;
}

// Keeps the async transcription lifecycle out of ChatView so the component can stay UI-focused.
export function useComposerVoiceController(
  options: UseComposerVoiceControllerOptions,
): UseComposerVoiceControllerResult {
  const {
    activeProject,
    activeThreadId,
    threadId,
    selectedProvider,
    activeProviderStatus,
    pendingUserInputCount,
    onTranscriptReady,
    refreshVoiceStatus,
  } = options;
  const {
    isRecording: isVoiceRecording,
    durationMs: voiceRecordingDurationMs,
    waveformLevels: voiceWaveformLevels,
    startRecording: startVoiceRecording,
    stopRecording: stopVoiceRecording,
    cancelRecording: cancelVoiceRecording,
  } = useVoiceRecorder();
  const [isVoiceTranscribing, setIsVoiceTranscribing] = useState(false);
  const voiceTranscriptionRequestIdRef = useRef(0);
  const voiceThreadIdRef = useRef(threadId);
  const voiceProviderRef = useRef<ProviderKind>(selectedProvider);
  voiceThreadIdRef.current = threadId;
  voiceProviderRef.current = selectedProvider;

  const voiceRecordingDurationLabel = useMemo(
    () => formatVoiceRecordingDuration(voiceRecordingDurationMs),
    [voiceRecordingDurationMs],
  );
  const { canStartVoiceNotes, showVoiceNotesControl } = useMemo(
    () =>
      deriveComposerVoiceState({
        authStatus: activeProviderStatus?.authStatus,
        voiceTranscriptionAvailable: activeProviderStatus?.voiceTranscriptionAvailable,
        isRecording: isVoiceRecording,
        isTranscribing: isVoiceTranscribing,
      }),
    [
      activeProviderStatus?.authStatus,
      activeProviderStatus?.voiceTranscriptionAvailable,
      isVoiceRecording,
      isVoiceTranscribing,
    ],
  );

  useEffect(() => {
    voiceTranscriptionRequestIdRef.current += 1;
    void cancelVoiceRecording();
    setIsVoiceTranscribing(false);
  }, [cancelVoiceRecording, threadId]);

  useEffect(() => {
    if (canStartVoiceNotes || !isVoiceRecording) {
      return;
    }
    voiceTranscriptionRequestIdRef.current += 1;
    void cancelVoiceRecording();
    setIsVoiceTranscribing(false);
  }, [canStartVoiceNotes, cancelVoiceRecording, isVoiceRecording]);

  const startComposerVoiceRecording = useCallback(async () => {
    if (!activeProject) {
      return;
    }
    if (activeProviderStatus?.authStatus === "unauthenticated") {
      toastManager.add({
        type: "error",
        title: "在 Codex 中登录 ChatGPT 后才能使用语音便签。",
      });
      return;
    }
    if (!canStartVoiceNotes) {
      toastManager.add({
        type: "error",
        title: "语音便签需要已在 Codex 中登录 ChatGPT。",
      });
      return;
    }
    if (pendingUserInputCount > 0) {
      toastManager.add({
        type: "error",
        title: "先回答 plan 问题，再录制语音便签。",
      });
      return;
    }

    try {
      await startVoiceRecording();
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "无法开始录制",
        description: describeVoiceRecordingStartError(error),
      });
    }
  }, [
    activeProject,
    activeProviderStatus?.authStatus,
    canStartVoiceNotes,
    pendingUserInputCount,
    startVoiceRecording,
  ]);

  const submitComposerVoiceRecording = useCallback(async () => {
    if (!activeProject || !isVoiceRecording) {
      return;
    }

    const api = readNativeApi();
    if (!api) {
      toastManager.add({
        type: "error",
        title: "语音转写当前不可用。",
      });
      void cancelVoiceRecording();
      return;
    }

    setIsVoiceTranscribing(true);
    const requestId = voiceTranscriptionRequestIdRef.current + 1;
    voiceTranscriptionRequestIdRef.current = requestId;
    const requestThreadId = threadId;
    const requestProvider = selectedProvider;
    const isCurrentVoiceRequest = () =>
      voiceTranscriptionRequestIdRef.current === requestId &&
      voiceThreadIdRef.current === requestThreadId &&
      voiceProviderRef.current === requestProvider;

    try {
      const payload = await stopVoiceRecording();
      if (!isCurrentVoiceRequest()) {
        return;
      }
      if (!payload) {
        toastManager.add({
          type: "warning",
          title: "没有录制到音频。",
        });
        return;
      }
      const result = await api.server.transcribeVoice({
        provider: "opencode",
        cwd: activeProject.cwd,
        ...(activeThreadId ? { threadId: activeThreadId } : {}),
        ...payload,
      });
      if (!isCurrentVoiceRequest()) {
        return;
      }
      onTranscriptReady(result.text);
    } catch (error) {
      if (!isCurrentVoiceRequest()) {
        return;
      }

      const description =
        error instanceof Error ? sanitizeVoiceErrorMessage(error.message) : "语音便签无法转写。";
      const authExpired = isVoiceAuthExpiredMessage(description);
      if (authExpired) {
        refreshVoiceStatus();
      }
      toastManager.add({
        type: "error",
        title: authExpired ? "重新登录 ChatGPT" : "语音转写失败",
        description: authExpired
          ? "语音转写使用你在 Codex 中的 ChatGPT 会话。该会话被拒绝，请重新登录后再试。"
          : description,
        ...(authExpired
          ? {
              actionProps: {
                children: "刷新状态",
                onClick: refreshVoiceStatus,
              },
            }
          : {}),
      });
    } finally {
      if (isCurrentVoiceRequest()) {
        setIsVoiceTranscribing(false);
      }
    }
  }, [
    activeProject,
    activeThreadId,
    cancelVoiceRecording,
    isVoiceRecording,
    onTranscriptReady,
    refreshVoiceStatus,
    selectedProvider,
    stopVoiceRecording,
    threadId,
  ]);

  const cancelComposerVoiceRecording = useCallback(() => {
    voiceTranscriptionRequestIdRef.current += 1;
    setIsVoiceTranscribing(false);
    void cancelVoiceRecording();
  }, [cancelVoiceRecording]);

  return {
    isVoiceRecording,
    isVoiceTranscribing,
    voiceWaveformLevels,
    voiceRecordingDurationLabel,
    showVoiceNotesControl,
    startComposerVoiceRecording,
    submitComposerVoiceRecording,
    cancelComposerVoiceRecording,
  };
}

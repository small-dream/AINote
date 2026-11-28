import { useCallback, useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { voiceApi } from "@/api";
import { isAppError } from "@/api/error";
import type { VoiceStreamEvent } from "@/api/voice.types";
import { useTranslation } from "@/i18n";
import type { TranslationKey } from "@/i18n/messages";
import { reportToastError, useToastStore } from "@/stores/toast.store";

export type VoiceStatus = "idle" | "starting" | "listening" | "stopping";
const STOP_FALLBACK_MS = 3000;
type TranslateFn = (key: TranslationKey, values?: Record<string, string>) => string;

interface SessionCallbacks {
  translate: TranslateFn;
  insert: (text: string) => void;
  setStatus: Dispatch<SetStateAction<VoiceStatus>>;
  setPartial: Dispatch<SetStateAction<string>>;
  stopNow: () => void;
}

interface VoiceSessionRuntime {
  enabled: boolean;
  status: VoiceStatus;
  partial: string;
  statusRef: MutableRefObject<VoiceStatus>;
  sessionIdRef: MutableRefObject<string | null>;
  targetNoteRef: MutableRefObject<string | null>;
  notePathRef: MutableRefObject<string | null>;
  stopFallbackRef: MutableRefObject<number | null>;
  insertRef: MutableRefObject<(text: string) => void>;
  updateStatus: Dispatch<SetStateAction<VoiceStatus>>;
  resetIdle: () => void;
  handleEvent: (event: VoiceStreamEvent) => void;
}

function voiceFailureKey(code: string): TranslationKey {
  if (code === "network" || code === "networkTimeout") return "voice.errorNetwork";
  if (code === "permission") return "voice.errorPermission";
  if (code === "audio") return "voice.errorAudio";
  if (code === "noMatch") return "voice.errorNoMatch";
  if (code === "busy") return "voice.errorBusy";
  if (code === "speechTimeout") return "voice.errorSpeechTimeout";
  if (code === "service") return "voice.errorService";
  return "voice.errorGeneric";
}

function newSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function reportVoiceError(error: unknown, translate: TranslateFn): void {
  if (!isAppError(error)) {
    reportToastError(error);
    return;
  }
  if (error.code === "VOICE_9001") useToastStore.getState().push(translate("voice.permissionDenied"), "info");
  else if (error.code === "VOICE_9002") useToastStore.getState().push(translate("voice.unavailable"), "info");
  else if (error.code === "VOICE_9003") useToastStore.getState().push(translate("voice.errorBusy"), "info");
  else if (error.code === "VOICE_9005") useToastStore.getState().push(translate("voice.errorGeneric"), "error");
  else if (error.code !== "VOICE_9004") reportToastError(error);
}

export function applyVoiceEvent(event: VoiceStreamEvent, cb: SessionCallbacks): void {
  switch (event.kind) {
    case "partial":
      cb.setStatus((prev) => (prev === "starting" ? "listening" : prev));
      cb.setPartial(event.text);
      break;
    case "final":
      cb.insert(event.text);
      break;
    case "permission":
      if (!event.granted) useToastStore.getState().push(cb.translate("voice.permissionDenied"), "info");
      break;
    case "failed": {
      const detailKey = voiceFailureKey(event.code);
      useToastStore.getState().push(cb.translate("voice.failed", { message: cb.translate(detailKey) }), "error");
      cb.stopNow();
      break;
    }
    case "stopped":
      cb.stopNow();
      break;
  }
}

function useVoiceSessionState(insert: (text: string) => void, notePath: string | null, enabled: boolean): VoiceSessionRuntime {
  const { t } = useTranslation();
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [partial, setPartial] = useState("");
  const statusRef = useRef<VoiceStatus>("idle");
  const sessionIdRef = useRef<string | null>(null);
  const targetNoteRef = useRef<string | null>(null);
  const notePathRef = useRef<string | null>(notePath);
  const stopFallbackRef = useRef<number | null>(null);
  const insertRef = useRef(insert);
  useEffect(() => { insertRef.current = insert; }, [insert]);
  useEffect(() => { notePathRef.current = notePath; }, [notePath]);
  const updateStatus = useCallback<Dispatch<SetStateAction<VoiceStatus>>>((next) => {
    setStatus((prev) => {
      const value = typeof next === "function" ? next(prev) : next;
      statusRef.current = value;
      return value;
    });
  }, []);
  const resetIdle = useCallback(() => {
    sessionIdRef.current = null;
    targetNoteRef.current = null;
    setPartial("");
    statusRef.current = "idle";
    setStatus("idle");
  }, []);
  const stopNow = useCallback(() => {
    if (stopFallbackRef.current !== null) window.clearTimeout(stopFallbackRef.current);
    stopFallbackRef.current = null;
    resetIdle();
  }, [resetIdle]);
  const runtime = { enabled, status, partial, statusRef, sessionIdRef, targetNoteRef, notePathRef, stopFallbackRef, insertRef, updateStatus, resetIdle };
  const handleEvent = useCallback((event: VoiceStreamEvent) => {
    if (!enabled || event.sessionId !== sessionIdRef.current || targetNoteRef.current !== notePathRef.current) return;
    applyVoiceEvent(event, {
      translate: t,
      insert: (text) => {
        insertRef.current(text);
        setPartial("");
      },
      setStatus: updateStatus,
      setPartial,
      stopNow,
    });
  }, [enabled, insertRef, notePathRef, sessionIdRef, stopNow, t, targetNoteRef, updateStatus]);
  return { ...runtime, handleEvent };
}

function useVoiceStart(runtime: VoiceSessionRuntime) {
  const { t } = useTranslation();
  const { enabled, notePathRef, statusRef, sessionIdRef, targetNoteRef, updateStatus, resetIdle, handleEvent } = runtime;
  return useCallback(async (onDevice: boolean) => {
    if (!enabled || !notePathRef.current || statusRef.current !== "idle") return;
    const sessionId = newSessionId();
    sessionIdRef.current = sessionId;
    targetNoteRef.current = notePathRef.current;
    statusRef.current = "starting";
    updateStatus("starting");
    try {
      await voiceApi.start(sessionId, onDevice, handleEvent);
      if (sessionIdRef.current === sessionId) updateStatus("listening");
    } catch (error) {
      if (sessionIdRef.current !== sessionId) return;
      resetIdle();
      reportVoiceError(error, t);
    }
  }, [enabled, handleEvent, notePathRef, resetIdle, sessionIdRef, statusRef, t, targetNoteRef, updateStatus]);
}

function useVoiceFinish(runtime: VoiceSessionRuntime) {
  const { t } = useTranslation();
  const { sessionIdRef, statusRef, stopFallbackRef, updateStatus, resetIdle } = runtime;
  return useCallback(async () => {
    const sessionId = sessionIdRef.current;
    if (!sessionId || statusRef.current === "idle") return;
    updateStatus("stopping");
    try {
      await voiceApi.finish(sessionId);
    } catch (error) {
      if (sessionIdRef.current === sessionId) reportVoiceError(error, t);
    }
    if (stopFallbackRef.current !== null) window.clearTimeout(stopFallbackRef.current);
    stopFallbackRef.current = window.setTimeout(() => {
      stopFallbackRef.current = null;
      if (sessionIdRef.current === sessionId && statusRef.current === "stopping") resetIdle();
    }, STOP_FALLBACK_MS);
  }, [resetIdle, sessionIdRef, statusRef, stopFallbackRef, t, updateStatus]);
}

function useVoiceCancel(runtime: VoiceSessionRuntime) {
  const { sessionIdRef, stopFallbackRef, resetIdle } = runtime;
  return useCallback(() => {
    const sessionId = sessionIdRef.current;
    if (stopFallbackRef.current !== null) window.clearTimeout(stopFallbackRef.current);
    stopFallbackRef.current = null;
    resetIdle();
    if (sessionId) void voiceApi.cancel(sessionId).catch(() => undefined);
  }, [resetIdle, sessionIdRef, stopFallbackRef]);
}

export function useVoiceSession(insert: (text: string) => void, notePath: string | null, enabled: boolean) {
  const runtime = useVoiceSessionState(insert, notePath, enabled);
  const start = useVoiceStart(runtime);
  const finish = useVoiceFinish(runtime);
  const cancel = useVoiceCancel(runtime);
  return { status: runtime.status, partial: runtime.partial, start, finish, cancel };
}

import { useCallback, useEffect, useRef, useState } from "react";
import { voiceApi } from "@/api";
import type { VoiceSupport } from "@/api/voice.types";
import { useTranslation } from "@/i18n";
import { reportToastError, useToastStore } from "@/stores/toast.store";

/** 能力探测：结果缓存进 state；入口只在确认 supported=true 后出现。 */
export function useVoiceSupport(enabled: boolean): { support: VoiceSupport | null; ensure: () => Promise<VoiceSupport | null> } {
  const { t } = useTranslation();
  const [support, setSupport] = useState<VoiceSupport | null>(null);
  const inflightRef = useRef<Promise<VoiceSupport | null> | null>(null);
  const reportedRef = useRef(false);
  const ensure = useCallback(async (): Promise<VoiceSupport | null> => {
    if (!enabled) return null;
    if (support) return support;
    if (inflightRef.current) return inflightRef.current;
    const task = voiceApi.support()
      .then((probed) => {
        setSupport(probed);
        return probed;
      })
      .catch((error: unknown) => {
        reportToastError(error);
        return null;
      })
      .finally(() => {
        inflightRef.current = null;
      });
    inflightRef.current = task;
    return task;
  }, [enabled, support]);

  useEffect(() => {
    if (enabled) void ensure();
  }, [enabled, ensure]);

  useEffect(() => {
    if (reportedRef.current || support?.supported !== false) return;
    reportedRef.current = true;
    const key = support.reason === "denied"
      ? "voice.permissionDenied"
      : support.reason === "noService"
        ? "voice.noService"
        : "voice.unavailable";
    useToastStore.getState().push(t(key), "info");
  }, [support, t]);

  return { support, ensure };
}

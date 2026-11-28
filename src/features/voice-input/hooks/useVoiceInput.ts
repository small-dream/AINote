import { useCallback, useEffect, useState } from "react";
import { useVoiceSupport } from "./useVoiceSupport";
import { useVoiceSession } from "./useVoiceSession";

export type { VoiceStatus } from "./useVoiceSession";

interface UseVoiceInputOptions {
  /** 定稿文本插入当前编辑器光标处；编辑器未就绪时由调用方决定兜底（追加到文末等）。 */
  insertText: (text: string) => void;
  /** 切换笔记即取消会话（PRD §2.10）：转写绝不落进另一篇笔记。 */
  notePath: string | null;
  /** 仅移动壳启用；桌面端不探测、不发 IPC。 */
  enabled: boolean;
}

/**
 * 语音输入编排：能力探测一次并缓存；on-device 可用直接启动，
 * 不可用先弹「联网识别」同意框（PRD §2.10 隐私边界：绝不静默上传）。
 */
export function useVoiceInput({ insertText, notePath, enabled }: UseVoiceInputOptions) {
  const { support, ensure } = useVoiceSupport(enabled);
  const { status, partial, start, finish, cancel } = useVoiceSession(insertText, notePath, enabled);
  const [consentOpen, setConsentOpen] = useState(false);

  const toggle = useCallback(async () => {
    if (status !== "idle") {
      await finish();
      return;
    }
    const probed = await ensure();
    if (!probed?.supported) return;
    if (probed.onDevice) {
      await start(true);
    } else {
      setConsentOpen(true);
    }
  }, [ensure, finish, start, status]);

  const confirmNetwork = useCallback(async () => {
    setConsentOpen(false);
    await start(false);
  }, [start]);
  const cancelConsent = useCallback(() => setConsentOpen(false), []);

  // 切换笔记即取消：组件实例复用（不重挂载）时也保证转写不落进新笔记。
  useEffect(() => {
    if (!enabled || notePath === null) return;
    return () => {
      setConsentOpen(false);
      cancel();
    };
  }, [cancel, enabled, notePath]);

  // 系统 ASR 仅承诺前台运行；WebView 隐藏或页面卸载时取消，避免后台继续占用麦克风。
  useEffect(() => {
    if (!enabled) return;
    const cancelOnHide = () => {
      if (document.visibilityState === "hidden") cancel();
    };
    document.addEventListener("visibilitychange", cancelOnHide);
    window.addEventListener("pagehide", cancel);
    return () => {
      document.removeEventListener("visibilitychange", cancelOnHide);
      window.removeEventListener("pagehide", cancel);
    };
  }, [cancel, enabled]);

  return {
    status,
    partial,
    consentOpen,
    supported: enabled && support?.supported === true,
    toggle,
    stop: finish,
    confirmNetwork,
    cancelConsent,
  };
}

import { Channel } from "@tauri-apps/api/core";
import { call } from "./client";
import type { VoiceStreamEvent, VoiceSupport } from "./voice.types";

/** 移动端语音输入（PRD §2.10）：系统 ASR、on-device 优先，桌面端恒为不支持。 */
export const voiceApi = {
  support: () => call<VoiceSupport>("voice_support"),

  /** 启动识别会话；`onDevice = false` 表示用户已显式同意联网识别。 */
  start: (sessionId: string, onDevice: boolean, onEvent: (event: VoiceStreamEvent) => void) => {
    const channel = new Channel<VoiceStreamEvent>();
    channel.onmessage = onEvent;
    return call<null>("voice_start", { sessionId, locale: null, onDevice, onEvent: channel });
  },

  /** 完成当前会话：等待最后一段定稿并保留它。 */
  finish: (sessionId: string) => call<null>("voice_stop", { sessionId }),

  /** 取消当前会话：立即停止，并丢弃未提交的 final，用于切换笔记/离开前台。 */
  cancel: (sessionId: string) => call<null>("voice_cancel", { sessionId }),
};

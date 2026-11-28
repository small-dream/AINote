/** voice_support 返回：`supported = false` 时前端不渲染麦克风入口。 */
export interface VoiceSupport {
  supported: boolean;
  /** 当前语言可完全本机识别：false 时启动联网识别前需用户显式同意。 */
  onDevice: boolean;
  /** 不支持时的稳定原因码（noService / denied / platformUnsupported 等），由前端本地化。 */
  reason?: string;
}

/** voice_start 经 Tauri Channel 下发的识别事件；sessionId 用于丢弃迟到或旧会话事件。 */
export type VoiceStreamEvent = { sessionId: string } & (
  | { kind: "partial" | "final"; text: string }
  | { kind: "permission"; granted: boolean }
  | { kind: "failed"; code: string; message: string }
  | { kind: "stopped" }
);

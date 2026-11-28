//! 语音输入（移动端）领域类型：仅承载 Command ↔ Service ↔ 前端的传输结构。
//! 平台接缝见 `platform/voice`，会话编排见 `services/voice_service`。

use serde::Serialize;

/// 识别会话流式事件：经 Tauri Channel 推给前端（形态对齐 `AiChatStreamEvent`）。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceStreamEvent {
    pub session_id: String,
    #[serde(flatten)]
    pub event: VoiceStreamEventKind,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum VoiceStreamEventKind {
    /// 部分转写：实时展示用，不落盘、不进防抖保存。
    Partial { text: String },
    /// 定稿转写：前端把文本插入光标处。
    Final { text: String },
    /// 麦克风权限弹窗的结果（Android 运行时权限链路），前端据此提示或引导。
    Permission { granted: bool },
    /// 引擎在会话中失败：前端停止 UI 并按需重试。
    Failed { code: String, message: String },
    /// 会话结束（用户停止 / 引擎收尾），前端恢复 idle 态。
    Stopped,
}

/// 能力探测结果：`supported = false` 时前端不渲染麦克风入口。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceSupportDto {
    pub supported: bool,
    /// 当前语言是否可完全本机识别（true = on-device 模型覆盖，无需联网选择器）。
    pub on_device: bool,
    /// 不支持时的原因码，由前端本地化解释「为什么没有入口」。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

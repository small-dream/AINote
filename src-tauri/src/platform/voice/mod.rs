//! 语音输入的平台接缝（对齐 `quick_unlock` 的组织方式）：
//! - Android：经 JNI 调 `gen/android/.../VoiceInput.kt`（字符串协议 + 轮询取事件）；
//! - iOS：`objc2-speech` + `objc2-avf-audio` 在本 crate 内直接实现（对齐 `quick_unlock::apple` 的纯 Rust 路线）；
//! - 其它平台（桌面 / 测试）：`unsupported`，能力探测返回不支持，前端不渲染入口。
//!
//! 服务层只依赖 [`Transcriber`]，单测注入内存实现；
//! Android 的事件 / 探测协议解析放在本文件，是为了在任意平台都能单测。

use std::sync::{Arc, OnceLock};

use crate::domain::error::AppError;

#[cfg(target_os = "android")]
mod android;
#[cfg(target_os = "android")]
use android::AndroidTranscriber as PlatformVoice;

#[cfg(target_os = "ios")]
mod apple;
#[cfg(target_os = "ios")]
use apple::AppleTranscriber as PlatformVoice;

#[cfg(not(any(target_os = "android", target_os = "ios")))]
mod unsupported;
#[cfg(not(any(target_os = "android", target_os = "ios")))]
use unsupported::UnsupportedTranscriber as PlatformVoice;

/// 能力探测结果：`supported = false` 时前端不渲染麦克风入口，
/// `reason` 是给前端本地化的稳定原因码（同 `QuickUnlockUnsupportedReason` 的思路）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VoiceSupport {
    pub supported: bool,
    /// 当前语言可完全本机识别：true 时直接走 on-device，无需「本机 / 联网」选择器。
    pub on_device: bool,
    pub reason: Option<&'static str>,
}

impl VoiceSupport {
    pub fn available(on_device: bool) -> Self {
        Self {
            supported: true,
            on_device,
            reason: None,
        }
    }

    pub fn unavailable(reason: &'static str) -> Self {
        Self {
            supported: false,
            on_device: false,
            reason: Some(reason),
        }
    }
}

/// 原生识别事件：由平台实现产出，服务层转换成 `VoiceStreamEvent` 推给前端。
/// Android 经字符串协议解析得到，iOS 直接构造。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum NativeEvent {
    /// 部分转写（实时展示，不落盘）。
    Partial(String),
    /// 定稿转写（插入光标处）。定稿不结束会话：原生侧自动继续听下一段。
    Final(String),
    /// 运行时麦克风权限弹窗结果。
    Permission(bool),
    /// 引擎失败（带平台错误码与可读原因），会话由服务层收尾。
    Failure { code: String, message: String },
    /// 原生侧会话已结束（错误 / 权限拒绝 / 系统中断），服务层不再轮询。
    Stopped,
}

/// 系统语音识别接缝。实现必须保证 `start` 失败时**不产生任何会话状态**，
/// `stop` 幂等（未启动时仍返回 Ok）。
pub trait Transcriber: Send + Sync {
    /// 能力探测：不得弹任何权限框、不得请求识别授权（iOS 的语音授权弹窗在 `start` 里发生）。
    fn support(&self) -> VoiceSupport;

    /// 启动识别会话；`locale = None` 表示跟随系统语言。
    /// on-device 不可用（语言未覆盖）时仍允许 `on_device = false` 启动联网识别，
    /// 但探测已如实上报，选择权在前端用户。
    fn start(
        &self,
        session_id: &str,
        locale: Option<&str>,
        on_device: bool,
    ) -> Result<(), AppError>;

    /// 停止会话并释放原生资源（识别引擎、音频引擎、权限等待）。
    fn stop(&self, session_id: &str) -> Result<(), AppError>;

    /// 取走自上次调用以来的全部事件（可为空）。桥接层故障以 `Failure` 事件表达。
    fn poll(&self, session_id: &str) -> Vec<NativeEvent>;
}

/// 当前平台的转写器（进程内单例）。
pub fn transcriber() -> Arc<dyn Transcriber> {
    static TRANSCRIBER: OnceLock<Arc<dyn Transcriber>> = OnceLock::new();
    Arc::clone(TRANSCRIBER.get_or_init(|| Arc::new(PlatformVoice::new())))
}

/// Android 探测协议：`ok:onDevice` / `ok:network` / `unsupported:<原因码>`。
#[cfg_attr(not(target_os = "android"), allow(dead_code))]
pub fn parse_support(raw: &str) -> VoiceSupport {
    match raw.trim() {
        "ok:onDevice" => VoiceSupport::available(true),
        "ok:network" => VoiceSupport::available(false),
        "unsupported:noService" => VoiceSupport::unavailable("noService"),
        "unsupported:locale" => VoiceSupport::unavailable("locale"),
        _ => VoiceSupport::unavailable("probeFailed"),
    }
}

/// Android 启动协议：`ok` / `pending:permission`（权限弹窗中，事件经 poll 上报）/ `fail:<原因>`。
/// 返回 Ok(true) 表示会话已启动；Ok(false) 表示权限弹窗进行中；Err 为启动失败。
#[cfg_attr(not(target_os = "android"), allow(dead_code))]
pub fn parse_start(raw: &str) -> Result<bool, String> {
    match raw.trim() {
        "ok" => Ok(true),
        "pending:permission" => Ok(false),
        other => Err(other.strip_prefix("fail:").unwrap_or(other).to_string()),
    }
}

/// Android 事件协议解析：事件间用 `US`（`\u{1e}`）分隔、事件内字段用 `RS`（`\u{1f}`）分隔，
/// 控制字符不会出现在语音文本里，避免与换行冲突。未知事件忽略（向前兼容）。
#[cfg_attr(not(target_os = "android"), allow(dead_code))]
pub fn parse_events(raw: &str, expected_session_id: &str) -> Vec<NativeEvent> {
    if raw.is_empty() {
        return Vec::new();
    }
    raw.split('\u{1e}')
        .filter_map(|item| {
            let mut fields = item.split('\u{1f}');
            let session_id = fields.next().unwrap_or_default();
            if session_id != expected_session_id {
                return None;
            }
            let kind = fields.next().unwrap_or_default();
            let text = fields.next().unwrap_or_default();
            match kind {
                "partial" => Some(NativeEvent::Partial(text.to_string())),
                "final" => Some(NativeEvent::Final(text.to_string())),
                "permission" => Some(NativeEvent::Permission(text == "granted")),
                "error" => {
                    let message = fields.next().unwrap_or(text);
                    Some(NativeEvent::Failure {
                        code: text.to_string(),
                        message: message.to_string(),
                    })
                }
                "stopped" => Some(NativeEvent::Stopped),
                _ => None,
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_support_protocol() {
        assert_eq!(parse_support("ok:onDevice"), VoiceSupport::available(true));
        assert_eq!(parse_support("ok:network"), VoiceSupport::available(false));
        assert_eq!(
            parse_support("unsupported:noService"),
            VoiceSupport::unavailable("noService")
        );
        // 未预见的输出按探测失败处理，绝不静默当作「支持」。
        assert_eq!(
            parse_support("ok:weird"),
            VoiceSupport::unavailable("probeFailed")
        );
    }

    #[test]
    fn parses_start_protocol() {
        assert_eq!(parse_start("ok"), Ok(true));
        assert_eq!(parse_start("pending:permission"), Ok(false));
        assert!(parse_start("fail:引擎不可用").is_err());
    }

    #[test]
    fn parses_events_with_control_separators() {
        let raw = "s1\u{1f}partial\u{1f}你好\u{1e}s1\u{1f}final\u{1f}你好世界\u{1e}s1\u{1f}permission\u{1f}granted\u{1e}s1\u{1f}error\u{1f}7\u{1f}无匹配\u{1e}s1\u{1f}stopped";
        assert_eq!(
            parse_events(raw, "s1"),
            vec![
                NativeEvent::Partial("你好".into()),
                NativeEvent::Final("你好世界".into()),
                NativeEvent::Permission(true),
                NativeEvent::Failure {
                    code: "7".into(),
                    message: "无匹配".into()
                },
                NativeEvent::Stopped,
            ]
        );
    }

    #[test]
    fn parses_events_with_multiline_text_and_ignores_unknown() {
        // 语音文本可以包含换行：分隔符用控制字符，不受影响。
        let raw = "s1\u{1f}final\u{1f}第一行\n第二行\u{1e}s1\u{1f}future\u{1f}x";
        assert_eq!(
            parse_events(raw, "s1"),
            vec![NativeEvent::Final("第一行\n第二行".into())]
        );
    }

    #[test]
    fn empty_poll_yields_no_events() {
        assert!(parse_events("", "s1").is_empty());
    }

    #[test]
    fn stale_session_events_are_ignored() {
        let raw = "old\u{1f}final\u{1f}旧文本\u{1e}new\u{1f}final\u{1f}新文本";
        assert_eq!(
            parse_events(raw, "new"),
            vec![NativeEvent::Final("新文本".into())]
        );
    }
}

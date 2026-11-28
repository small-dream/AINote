//! 桌面与测试环境的占位实现：能力探测恒为「不支持」，前端不渲染入口。
//! PRD §2.10：语音输入是移动端专属能力，桌面不出任何入口。

use crate::domain::error::AppError;
use crate::platform::voice::{NativeEvent, Transcriber, VoiceSupport};

pub(super) struct UnsupportedTranscriber;

impl UnsupportedTranscriber {
    pub(super) fn new() -> Self {
        Self
    }
}

impl Transcriber for UnsupportedTranscriber {
    fn support(&self) -> VoiceSupport {
        VoiceSupport::unavailable("platformUnsupported")
    }

    fn start(
        &self,
        _session_id: &str,
        _locale: Option<&str>,
        _on_device: bool,
    ) -> Result<(), AppError> {
        Err(AppError::VoiceUnavailable(
            "当前平台不支持语音输入".to_string(),
        ))
    }

    fn stop(&self, _session_id: &str) -> Result<(), AppError> {
        Ok(())
    }

    fn poll(&self, _session_id: &str) -> Vec<NativeEvent> {
        Vec::new()
    }
}

use serde::{Deserialize, Serialize};

/// AI Provider：统一走 OpenAI 兼容 chat/completions 协议。
/// Ollama 通过其 /v1 兼容端点接入（无需 API Key）。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AiProvider {
    OpenAiCompatible,
    Ollama,
}

impl Default for AiProvider {
    fn default() -> Self {
        AiProvider::OpenAiCompatible
    }
}

impl AiProvider {
    /// 该 Provider 是否要求 API Key。
    pub fn requires_key(self) -> bool {
        matches!(self, AiProvider::OpenAiCompatible)
    }
}

/// 单次 AI 请求的运行时配置（由 Provider + 模型解析得到）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiConfig {
    #[serde(default)]
    pub provider: AiProvider,
    pub base_url: String,
    pub model: String,
}

/// 对话消息（与 OpenAI chat/completions 的 messages 结构一致）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiChatMessage {
    pub role: String,
    pub content: String,
}

/// ai_generate / ai_chat 返回。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiReplyDto {
    pub text: String,
}

/// ai_generate_stream 增量块（前端经 Tauri Channel 逐块接收，实现打字机效果）。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiStreamChunk {
    pub delta: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn provider_requires_key() {
        assert!(AiProvider::OpenAiCompatible.requires_key());
        assert!(!AiProvider::Ollama.requires_key());
    }
}

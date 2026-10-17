use serde::{Deserialize, Serialize};

/// AI Provider：统一走 OpenAI 兼容 chat/completions 协议。
/// Ollama 通过其 /v1 兼容端点接入（无需 API Key）。
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AiProvider {
    #[default]
    OpenAiCompatible,
    Ollama,
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

/// 全库问答的单条检索来源。index 从 1 起，与回答中的 [n] 编号一致。
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ContextSnippet {
    pub index: usize,
    pub path: String,
    pub heading: Option<String>,
    pub line: u32,
    pub text: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiChatReplyDto {
    pub text: String,
    pub citations: Vec<ContextSnippet>,
}

/// 问答流事件：来源先于首个 delta 下发，前端可先准备引用区。
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum AiChatStreamEvent {
    Citations { citations: Vec<ContextSnippet> },
    Delta { delta: String },
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

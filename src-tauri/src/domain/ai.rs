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

/// AI 非敏感配置（存 ai.json 明文；API Key 单独加密存储）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub provider: AiProvider,
    #[serde(default = "default_base_url")]
    pub base_url: String,
    #[serde(default = "default_model")]
    pub model: String,
}

impl Default for AiConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            provider: AiProvider::OpenAiCompatible,
            base_url: default_base_url(),
            model: default_model(),
        }
    }
}

/// 传输给前端的配置（含 has_key，Key 明文不返回前端）。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiConfigDto {
    pub enabled: bool,
    pub provider: AiProvider,
    pub base_url: String,
    pub model: String,
    pub has_key: bool,
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

fn default_base_url() -> String {
    "https://api.openai.com/v1".to_string()
}

fn default_model() -> String {
    "gpt-4o-mini".to_string()
}

impl From<&AiConfig> for AiConfigDto {
    fn from(cfg: &AiConfig) -> Self {
        Self {
            enabled: cfg.enabled,
            provider: cfg.provider,
            base_url: cfg.base_url.clone(),
            model: cfg.model.clone(),
            has_key: false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_is_safe() {
        let cfg = AiConfig::default();
        assert!(!cfg.enabled);
        assert_eq!(cfg.provider, AiProvider::OpenAiCompatible);
        assert!(cfg.base_url.contains("api.openai.com"));
    }

    #[test]
    fn provider_requires_key() {
        assert!(AiProvider::OpenAiCompatible.requires_key());
        assert!(!AiProvider::Ollama.requires_key());
    }
}

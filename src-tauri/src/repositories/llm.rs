//! AI LLM Provider 抽象（Repository 层）：统一 OpenAI 兼容 chat/completions 协议。
//! Service 只依赖 `LlmClient` trait，不感知厂商差异；网络调用走 ureq（由 Command 工作线程承载）。

use crate::domain::ai::{AiChatMessage, AiConfig, AiProvider};
use crate::domain::error::AppError;

use std::io::BufRead;

const DEFAULT_TIMEOUT_SECS: u64 = 90;
const STREAM_TIMEOUT_SECS: u64 = 180;
const UA: &str = "AINote";

/// LLM 客户端抽象（便于注入 Mock 测试 Service）。
pub trait LlmClient {
    fn complete(
        &self,
        cfg: &AiConfig,
        key: Option<&str>,
        messages: &[AiChatMessage],
    ) -> Result<String, AppError>;

    /// 流式补全：每收到增量调用 on_delta，返回拼接后的完整文本。
    fn complete_stream(
        &self,
        cfg: &AiConfig,
        key: Option<&str>,
        messages: &[AiChatMessage],
        on_delta: &mut dyn FnMut(&str),
    ) -> Result<String, AppError>;
}

/// OpenAI 兼容 Provider（ureq 实现；Ollama 走其 /v1 端点，无需 Key）。
pub struct OpenAiCompatClient;

impl OpenAiCompatClient {
    /// 拉取 OpenAI 兼容模型列表；该请求只读模型目录，不产生补全费用。
    pub fn list_models(&self, cfg: &AiConfig, key: Option<&str>) -> Result<Vec<String>, AppError> {
        let url = models_url(&cfg.base_url, cfg.provider);
        let config = ureq::Agent::config_builder()
            .timeout_global(Some(std::time::Duration::from_secs(DEFAULT_TIMEOUT_SECS)))
            .build();
        let agent = ureq::Agent::new_with_config(config);
        let mut req = agent.get(&url).header("User-Agent", UA);
        if let Some(k) = key {
            req = req.header("Authorization", &format!("Bearer {k}"));
        }
        let mut resp = req.call().map_err(map_llm_http)?;
        let body: serde_json::Value = resp
            .body_mut()
            .read_json()
            .map_err(|e| AppError::AiNetwork(e.to_string()))?;
        parse_models(body)
    }
}

impl LlmClient for OpenAiCompatClient {
    fn complete(
        &self,
        cfg: &AiConfig,
        key: Option<&str>,
        messages: &[AiChatMessage],
    ) -> Result<String, AppError> {
        let url = chat_url(&cfg.base_url, cfg.provider);
        let config = ureq::Agent::config_builder()
            .timeout_global(Some(std::time::Duration::from_secs(DEFAULT_TIMEOUT_SECS)))
            .build();
        let agent = ureq::Agent::new_with_config(config);
        let mut req = agent
            .post(&url)
            .header("Content-Type", "application/json")
            .header("User-Agent", UA);
        if let Some(k) = key {
            req = req.header("Authorization", &format!("Bearer {k}"));
        }
        let payload = serde_json::json!({
            "model": cfg.model,
            "messages": messages,
            "temperature": 0.7,
        });
        let mut resp = req.send_json(payload).map_err(map_llm_http)?;
        let body: serde_json::Value = resp
            .body_mut()
            .read_json()
            .map_err(|e| AppError::AiNetwork(e.to_string()))?;
        parse_completions(body)
    }

    fn complete_stream(
        &self,
        cfg: &AiConfig,
        key: Option<&str>,
        messages: &[AiChatMessage],
        on_delta: &mut dyn FnMut(&str),
    ) -> Result<String, AppError> {
        let url = chat_url(&cfg.base_url, cfg.provider);
        let config = ureq::Agent::config_builder()
            .timeout_global(Some(std::time::Duration::from_secs(STREAM_TIMEOUT_SECS)))
            .build();
        let agent = ureq::Agent::new_with_config(config);
        let mut req = agent
            .post(&url)
            .header("Content-Type", "application/json")
            .header("User-Agent", UA);
        if let Some(k) = key {
            req = req.header("Authorization", &format!("Bearer {k}"));
        }
        let payload = serde_json::json!({
            "model": cfg.model,
            "messages": messages,
            "temperature": 0.7,
            "stream": true,
        });
        let mut resp = req.send_json(payload).map_err(map_llm_http)?;
        let reader = resp.body_mut().as_reader();
        let mut full = String::new();
        let mut line = String::new();
        let mut buf_reader = std::io::BufReader::new(reader);
        loop {
            line.clear();
            let n = buf_reader
                .read_line(&mut line)
                .map_err(|e| AppError::AiNetwork(e.to_string()))?;
            if n == 0 {
                break;
            }
            if let Some(delta) = parse_sse_line(&line) {
                full.push_str(&delta);
                on_delta(&delta);
            }
        }
        if full.is_empty() {
            return Err(AppError::Ai("AI 未返回有效内容".into()));
        }
        Ok(full)
    }
}

/// 纯函数：按 Provider 组装 chat/completions 端点 URL（规范化尾部斜杠）。
pub fn chat_url(base_url: &str, provider: AiProvider) -> String {
    let base = base_url.trim_end_matches('/').to_string();
    match provider {
        AiProvider::OpenAiCompatible => format!("{base}/chat/completions"),
        AiProvider::Ollama => {
            if base.ends_with("/v1") {
                format!("{base}/chat/completions")
            } else {
                format!("{base}/v1/chat/completions")
            }
        }
    }
}

/// 纯函数：按 Provider 组装 /models 端点 URL。
pub fn models_url(base_url: &str, provider: AiProvider) -> String {
    let base = base_url.trim_end_matches('/').to_string();
    match provider {
        AiProvider::OpenAiCompatible => format!("{base}/models"),
        AiProvider::Ollama => {
            if base.ends_with("/v1") {
                format!("{base}/models")
            } else {
                format!("{base}/v1/models")
            }
        }
    }
}

/// 纯函数：从 OpenAI 兼容响应中提取首个 choices[].message.content。
pub fn parse_completions(body: serde_json::Value) -> Result<String, AppError> {
    body.get("choices")
        .and_then(|c| c.as_array())
        .and_then(|arr| arr.first())
        .and_then(|choice| choice.get("message"))
        .and_then(|m| m.get("content"))
        .and_then(|c| c.as_str())
        .map(str::to_owned)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| AppError::Ai("AI 响应缺少有效内容".into()))
}

/// 纯函数：解析一行 SSE（`data: {...}`），返回 choices[0].delta.content 增量。
/// 遇到 `[DONE]` 或非数据行返回 None。
pub fn parse_sse_line(line: &str) -> Option<String> {
    let data = line.trim().strip_prefix("data:")?.trim();
    if data == "[DONE]" {
        return None;
    }
    let json: serde_json::Value = serde_json::from_str(data).ok()?;
    json.get("choices")?
        .as_array()?
        .first()?
        .get("delta")?
        .get("content")?
        .as_str()
        .map(str::to_owned)
}

/// 纯函数：解析 OpenAI 兼容 /models 响应（Ollama /v1 同结构）。
pub fn parse_models(body: serde_json::Value) -> Result<Vec<String>, AppError> {
    let models = body
        .get("data")
        .and_then(serde_json::Value::as_array)
        .ok_or_else(|| AppError::Ai("AI Provider 模型列表格式无效".into()))?
        .iter()
        .filter_map(|item| item.get("id").and_then(serde_json::Value::as_str))
        .map(str::to_owned)
        .collect::<Vec<_>>();
    if models.is_empty() {
        return Err(AppError::Ai("AI Provider 未返回可用模型".into()));
    }
    Ok(models)
}

fn map_llm_http(err: ureq::Error) -> AppError {
    match err {
        ureq::Error::StatusCode(401) | ureq::Error::StatusCode(403) => {
            AppError::Ai("API Key 无效或权限不足（401/403）".into())
        }
        ureq::Error::StatusCode(429) => AppError::Ai("请求过于频繁，请稍后重试（429）".into()),
        ureq::Error::StatusCode(code) => AppError::Ai(format!("AI Provider 返回 {code}")),
        other => AppError::AiNetwork(other.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chat_url_builds_per_provider() {
        assert_eq!(
            chat_url("https://api.openai.com/v1/", AiProvider::OpenAiCompatible),
            "https://api.openai.com/v1/chat/completions"
        );
        assert_eq!(
            chat_url("http://localhost:11434", AiProvider::Ollama),
            "http://localhost:11434/v1/chat/completions"
        );
        assert_eq!(
            chat_url("http://localhost:11434/v1", AiProvider::Ollama),
            "http://localhost:11434/v1/chat/completions"
        );
    }

    #[test]
    fn models_url_builds_per_provider() {
        assert_eq!(
            models_url("https://api.openai.com/v1/", AiProvider::OpenAiCompatible),
            "https://api.openai.com/v1/models"
        );
        assert_eq!(
            models_url("http://localhost:11434", AiProvider::Ollama),
            "http://localhost:11434/v1/models"
        );
    }

    #[test]
    fn parses_model_ids() {
        let body = serde_json::json!({ "data": [{ "id": "model-a" }, { "id": "model-b" }] });
        assert_eq!(parse_models(body).unwrap(), vec!["model-a", "model-b"]);
    }

    #[test]
    fn rejects_empty_model_list() {
        assert!(parse_models(serde_json::json!({ "data": [] })).is_err());
    }

    #[test]
    fn parses_first_choice_content() {
        let body = serde_json::json!({
            "choices": [ { "message": { "role": "assistant", "content": "你好" } } ]
        });
        assert_eq!(parse_completions(body).unwrap(), "你好");
    }

    #[test]
    fn rejects_empty_or_missing_content() {
        let empty = serde_json::json!({ "choices": [ { "message": { "content": "" } } ] });
        assert!(parse_completions(empty).is_err());
        let missing = serde_json::json!({ "choices": [] });
        assert!(parse_completions(missing).is_err());
    }

    #[test]
    fn parses_sse_delta() {
        let line = "data: {\"choices\":[{\"delta\":{\"content\":\"你好\"}}]}";
        assert_eq!(parse_sse_line(line).as_deref(), Some("你好"));
    }

    #[test]
    fn sse_done_marker_returns_none() {
        assert_eq!(parse_sse_line("data: [DONE]"), None);
    }

    #[test]
    fn sse_non_data_or_malformed_returns_none() {
        assert_eq!(parse_sse_line("event: message"), None);
        assert_eq!(parse_sse_line("data: not-json"), None);
    }
}

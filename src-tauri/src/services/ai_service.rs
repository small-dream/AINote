//! AI 用例层：读取配置与 Key、校验启用态、组装上下文并调用 LLM Provider。
//! 上下文拼接（全库关键词检索）在 Rust 侧完成，原始笔记内容不泄漏到前端日志。

use std::path::Path;

use tauri::AppHandle;

use crate::domain::ai::{AiChatMessage, AiConfig, AiConfigDto};
use crate::domain::error::AppError;
use crate::repositories::llm::{LlmClient, OpenAiCompatClient};

use super::ai_store::AiStore;
use super::search_service;

const MAX_CONTEXT_RESULTS: usize = 5;
const MAX_PARAGRAPH_CHARS: usize = 1200;

pub fn config(app: &AppHandle) -> Result<AiConfigDto, AppError> {
    AiStore::from_app(app)?.dto()
}

/// 保存配置；api_key 为 Some 时同时更新加密 Key，为 None 时保留已有 Key。
pub fn save_config(app: &AppHandle, cfg: AiConfig, api_key: Option<String>) -> Result<(), AppError> {
    let store = AiStore::from_app(app)?;
    if let Some(key) = api_key {
        if !key.trim().is_empty() {
            store.save_key(key.trim())?;
        } else {
            store.delete_key()?;
        }
    }
    store.save_config(&cfg)
}

/// 编辑器写作动作：system + prompt 单轮生成。
pub fn generate(app: &AppHandle, system: String, prompt: String) -> Result<String, AppError> {
    let client = OpenAiCompatClient;
    let messages = vec![
        AiChatMessage { role: "system".into(), content: system },
        AiChatMessage { role: "user".into(), content: prompt },
    ];
    complete(&client, app, &messages)
}

/// 编辑器写作动作（流式）：增量回调给前端渲染，返回完整文本。
pub fn generate_stream(
    app: &AppHandle,
    system: String,
    prompt: String,
    on_delta: impl FnMut(&str) + Send,
) -> Result<String, AppError> {
    let client = OpenAiCompatClient;
    let messages = vec![
        AiChatMessage { role: "system".into(), content: system },
        AiChatMessage { role: "user".into(), content: prompt },
    ];
    complete_stream(&client, app, &messages, on_delta)
}

/// 问答：messages 为完整对话；repo_query 非空时检索全库段落并入上下文。
pub fn chat(app: &AppHandle, mut messages: Vec<AiChatMessage>, repo_query: Option<String>) -> Result<String, AppError> {
    let client = OpenAiCompatClient;
    inject_context(app, &mut messages, repo_query)?;
    complete(&client, app, &messages)
}

/// 问答（流式）：同上，增量回调给前端渲染。
pub fn chat_stream(
    app: &AppHandle,
    mut messages: Vec<AiChatMessage>,
    repo_query: Option<String>,
    on_delta: impl FnMut(&str) + Send,
) -> Result<String, AppError> {
    let client = OpenAiCompatClient;
    inject_context(app, &mut messages, repo_query)?;
    complete_stream(&client, app, &messages, on_delta)
}

fn inject_context(app: &AppHandle, messages: &mut Vec<AiChatMessage>, repo_query: Option<String>) -> Result<(), AppError> {
    let Some(query) = repo_query else { return Ok(()) };
    let query = query.trim();
    if query.is_empty() || messages.len() > 24 {
        return Ok(());
    }
    let root = crate::config::require_repo_path(app)?;
    let context = retrieve_context(&root, query, MAX_CONTEXT_RESULTS)?;
    if !context.is_empty() {
        let sys = format!("以下是笔记库中与“{query}”相关的段落，优先依据它们回答，注意区分事实与推测：\n\n{context}");
        messages.insert(0, AiChatMessage { role: "system".into(), content: sys });
    }
    Ok(())
}

fn complete(client: &impl LlmClient, app: &AppHandle, messages: &[AiChatMessage]) -> Result<String, AppError> {
    let store = AiStore::from_app(app)?;
    let cfg = store.config()?;
    if !cfg.enabled {
        return Err(AppError::Ai("AI 功能未启用，请先在设置中配置".into()));
    }
    let key = store.key()?;
    if cfg.provider.requires_key() && key.is_none() {
        return Err(AppError::Ai("未配置 API Key，请先在设置中填写".into()));
    }
    client.complete(&cfg, key.as_deref(), messages)
}

fn complete_stream(
    client: &impl LlmClient,
    app: &AppHandle,
    messages: &[AiChatMessage],
    on_delta: impl FnMut(&str) + Send,
) -> Result<String, AppError> {
    let store = AiStore::from_app(app)?;
    let cfg = store.config()?;
    if !cfg.enabled {
        return Err(AppError::Ai("AI 功能未启用，请先在设置中配置".into()));
    }
    let key = store.key()?;
    if cfg.provider.requires_key() && key.is_none() {
        return Err(AppError::Ai("未配置 API Key，请先在设置中填写".into()));
    }
    let mut on_delta = on_delta;
    client.complete_stream(&cfg, key.as_deref(), messages, &mut on_delta)
}

/// 全库关键词检索：取 top_k 命中笔记，提取命中行段落拼成上下文块（纯逻辑，可单测）。
pub fn retrieve_context(root: &Path, query: &str, top_k: usize) -> Result<String, AppError> {
    let results = search_service::search_notes(root, query)?;
    let mut blocks = Vec::new();
    for result in results.into_iter().take(top_k) {
        let rel = Path::new(&result.path);
        let content = std::fs::read_to_string(root.join(rel))?;
        let para = paragraph_around(&content, result.line, MAX_PARAGRAPH_CHARS);
        blocks.push(format!("【笔记：{}】\n{}", result.path, para));
    }
    Ok(blocks.join("\n\n"))
}

/// 纯函数：取指定行（1 起）为中心的连续文本块，总长不超过 max_chars。
pub fn paragraph_around(content: &str, line: u32, max_chars: usize) -> String {
    let start = if line > 1 { line - 1 } else { 1 };
    let slice: Vec<&str> = content.lines().skip((start - 1) as usize).take(6).collect();
    let joined = slice.join("\n").trim().to_string();
    if joined.chars().count() <= max_chars {
        joined
    } else {
        let truncated: String = joined.chars().take(max_chars - 1).collect();
        format!("{truncated}…")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn paragraph_extracts_around_line() {
        let content = "line one\nline two\nline three\nline four\nline five\nline six\nline seven";
        let para = paragraph_around(content, 3, 1200);
        assert!(para.contains("line two"));
        assert!(para.contains("line three"));
        assert!(para.contains("line four"));
        assert!(!para.contains("line one"));
    }

    #[test]
    fn paragraph_truncates_when_too_long() {
        let content = "abcdefghijklmnopqrstuvwxyz";
        let para = paragraph_around(content, 1, 10);
        assert!(para.ends_with('…'));
        assert!(para.chars().count() <= 10);
    }

    #[test]
    fn paragraph_clamps_start_line() {
        let content = "first\nsecond";
        let para = paragraph_around(content, 1, 1200);
        assert!(para.starts_with("first"));
    }
}

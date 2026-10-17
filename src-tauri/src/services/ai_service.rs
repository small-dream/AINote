//! AI 用例层：读取配置与 Key、校验启用态、组装上下文并调用 LLM Provider。
//! 上下文拼接（全库关键词检索）在 Rust 侧完成，原始笔记内容不泄漏到前端日志。

use tauri::AppHandle;

use crate::domain::ai::{AiChatMessage, AiChatReplyDto, AiConfig, AiProvider, ContextSnippet};
use crate::domain::ai_settings::{AiApiKeyInput, AiSettings, AiSettingsDto};
use crate::domain::error::AppError;
use crate::repositories::llm::{LlmClient, OpenAiCompatClient};

use super::ai_context::{render_context, retrieve_context, MAX_CONTEXT_RESULTS};
use super::ai_store::AiStore;

pub fn config(app: &AppHandle) -> Result<AiSettingsDto, AppError> {
    AiStore::from_app(app)?.dto()
}

/// 保存设置；api_key 指定时必须同时指定目标 Provider，None 表示保留已有 Key。
pub fn save_config(
    app: &AppHandle,
    settings: AiSettings,
    api_keys: Option<Vec<AiApiKeyInput>>,
) -> Result<(), AppError> {
    let store = AiStore::from_app(app)?;
    if let Some(keys) = api_keys {
        for input in keys {
            if input.key.trim().is_empty() {
                store.delete_provider_key(&input.provider_id)?;
            } else {
                store.save_provider_key(&input.provider_id, input.key.trim())?;
            }
        }
    }
    store.save_settings(&settings)
}

/// 拉取 OpenAI 兼容 /models 列表，供设置页自动补全模型目录。
pub fn fetch_models(
    app: &AppHandle,
    provider_id: &str,
    base_url: &str,
    kind: AiProvider,
) -> Result<Vec<String>, AppError> {
    let store = AiStore::from_app(app)?;
    let key = store.provider_key(provider_id)?;
    let runtime = AiConfig {
        provider: kind,
        base_url: base_url.to_owned(),
        model: String::new(),
    };
    OpenAiCompatClient.list_models(&runtime, key.as_deref())
}

/// 编辑器写作动作：system + prompt 单轮生成。
pub fn generate(
    app: &AppHandle,
    system: String,
    prompt: String,
    model_id: Option<String>,
) -> Result<String, AppError> {
    let client = OpenAiCompatClient;
    let messages = vec![
        AiChatMessage {
            role: "system".into(),
            content: system,
        },
        AiChatMessage {
            role: "user".into(),
            content: prompt,
        },
    ];
    complete(&client, app, &messages, model_id.as_deref())
}

/// 编辑器写作动作（流式）：增量回调给前端渲染，返回完整文本。
pub fn generate_stream(
    app: &AppHandle,
    system: String,
    prompt: String,
    model_id: Option<String>,
    on_delta: impl FnMut(&str) + Send,
) -> Result<String, AppError> {
    let client = OpenAiCompatClient;
    let messages = vec![
        AiChatMessage {
            role: "system".into(),
            content: system,
        },
        AiChatMessage {
            role: "user".into(),
            content: prompt,
        },
    ];
    complete_stream(&client, app, &messages, on_delta, model_id.as_deref())
}

/// 问答：messages 为完整对话；repo_query 非空时检索全库来源并返回引用。
pub fn chat(
    app: &AppHandle,
    mut messages: Vec<AiChatMessage>,
    repo_query: Option<String>,
    model_id: Option<String>,
) -> Result<AiChatReplyDto, AppError> {
    let client = OpenAiCompatClient;
    let citations = inject_context(app, &mut messages, repo_query)?;
    let text = complete(&client, app, &messages, model_id.as_deref())?;
    Ok(AiChatReplyDto { text, citations })
}

/// 问答（流式）：来源事件先于首个增量发送，返回完整回答与本次全部来源。
pub fn chat_stream(
    app: &AppHandle,
    mut messages: Vec<AiChatMessage>,
    repo_query: Option<String>,
    model_id: Option<String>,
    on_citations: impl FnOnce(&[ContextSnippet]),
    on_delta: impl FnMut(&str) + Send,
) -> Result<AiChatReplyDto, AppError> {
    let client = OpenAiCompatClient;
    let citations = inject_context(app, &mut messages, repo_query)?;
    on_citations(&citations);
    let text = complete_stream(&client, app, &messages, on_delta, model_id.as_deref())?;
    Ok(AiChatReplyDto { text, citations })
}

/// 把编号来源注入 system prompt；仅“全库”范围（repo_query=Some）产生引用。
fn inject_context(
    app: &AppHandle,
    messages: &mut Vec<AiChatMessage>,
    repo_query: Option<String>,
) -> Result<Vec<ContextSnippet>, AppError> {
    let Some(query) = repo_query else {
        return Ok(Vec::new());
    };
    let query = query.trim();
    if query.is_empty() || messages.len() > 24 {
        return Ok(Vec::new());
    }
    let root = crate::config::require_repo_path(app)?;
    let citations = retrieve_context(&root, query, MAX_CONTEXT_RESULTS)?;
    if !citations.is_empty() {
        messages.insert(
            0,
            AiChatMessage {
                role: "system".into(),
                content: render_context(query, &citations),
            },
        );
    }
    Ok(citations)
}

fn complete(
    client: &impl LlmClient,
    app: &AppHandle,
    messages: &[AiChatMessage],
    model_id: Option<&str>,
) -> Result<String, AppError> {
    let store = AiStore::from_app(app)?;
    let (runtime, key) = resolve_request(&store, model_id)?;
    let result = client.complete(&runtime, key.as_deref(), messages);
    result.map_err(|err| {
        log::error!(target: "ainote::ai", "AI 请求失败 model={} error={err}", runtime.model);
        err
    })
}

fn complete_stream(
    client: &impl LlmClient,
    app: &AppHandle,
    messages: &[AiChatMessage],
    on_delta: impl FnMut(&str) + Send,
    model_id: Option<&str>,
) -> Result<String, AppError> {
    let store = AiStore::from_app(app)?;
    let (runtime, key) = resolve_request(&store, model_id)?;
    let mut on_delta = on_delta;
    let result = client.complete_stream(&runtime, key.as_deref(), messages, &mut on_delta);
    result.map_err(|err| {
        log::error!(target: "ainote::ai", "AI 流式请求失败 model={} error={err}", runtime.model);
        err
    })
}

fn resolve_request(
    store: &AiStore,
    model_id: Option<&str>,
) -> Result<(AiConfig, Option<String>), AppError> {
    let settings = store.settings()?;
    let (provider, model) = settings.resolve_model(model_id)?;
    let key = store.provider_key(&provider.id)?;
    if provider.provider.requires_key() && key.is_none() {
        return Err(AppError::Ai("所选 Provider 未配置 API Key".into()));
    }
    Ok((AiSettings::runtime_config(&provider, &model), key))
}

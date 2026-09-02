use tauri::AppHandle;

use crate::commands::blocking;
use crate::domain::ai::{AiChatMessage, AiReplyDto};
use crate::domain::error::AppErrorDto;
use crate::services::ai_service;

/// Controller：AI 问答（可选全库关键词检索上下文）。
#[tauri::command]
pub async fn ai_chat(
    app: AppHandle,
    messages: Vec<AiChatMessage>,
    repo_query: Option<String>,
) -> Result<AiReplyDto, AppErrorDto> {
    blocking::run(move || ai_service::chat(&app, messages, repo_query).map(|text| AiReplyDto { text }))
        .await
        .map_err(AppErrorDto::from)
}

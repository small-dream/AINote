use tauri::ipc::Channel;
use tauri::AppHandle;

use crate::commands::blocking;
use crate::domain::ai::{AiChatMessage, AiStreamChunk};
use crate::domain::error::AppErrorDto;
use crate::services::ai_service;

/// Controller：AI 问答（流式，经 Tauri Channel 逐块下发）。
#[tauri::command]
pub async fn ai_chat_stream(
    app: AppHandle,
    messages: Vec<AiChatMessage>,
    repo_query: Option<String>,
    model_id: Option<String>,
    on_event: Channel<AiStreamChunk>,
) -> Result<(), AppErrorDto> {
    blocking::run(move || {
        ai_service::chat_stream(&app, messages, repo_query, model_id, |delta| {
            let _ = on_event.send(AiStreamChunk {
                delta: delta.to_string(),
            });
        })
    })
    .await
    .map(|_| ())
    .map_err(AppErrorDto::from)
}

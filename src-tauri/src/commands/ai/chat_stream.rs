use tauri::ipc::Channel;
use tauri::AppHandle;

use crate::commands::blocking;
use crate::domain::ai::{AiChatMessage, AiChatReplyDto, AiChatStreamEvent};
use crate::domain::error::AppErrorDto;
use crate::services::ai_service;

/// Controller：AI 问答（流式）：先下发 citations，再逐块下发 delta。
#[tauri::command]
pub async fn ai_chat_stream(
    app: AppHandle,
    messages: Vec<AiChatMessage>,
    repo_query: Option<String>,
    model_id: Option<String>,
    on_event: Channel<AiChatStreamEvent>,
) -> Result<AiChatReplyDto, AppErrorDto> {
    blocking::run(move || {
        ai_service::chat_stream(
            &app,
            messages,
            repo_query,
            model_id,
            |citations| {
                let _ = on_event.send(AiChatStreamEvent::Citations {
                    citations: citations.to_vec(),
                });
            },
            |delta| {
                let _ = on_event.send(AiChatStreamEvent::Delta {
                    delta: delta.to_string(),
                });
            },
        )
    })
    .await
    .map_err(AppErrorDto::from)
}

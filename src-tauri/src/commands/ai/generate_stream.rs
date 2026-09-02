use tauri::ipc::Channel;
use tauri::AppHandle;

use crate::commands::blocking;
use crate::domain::ai::AiStreamChunk;
use crate::domain::error::AppErrorDto;
use crate::services::ai_service;

/// Controller：编辑器写作动作（流式，经 Tauri Channel 逐块下发，打字机效果）。
#[tauri::command]
pub async fn ai_generate_stream(
    app: AppHandle,
    system: String,
    prompt: String,
    on_event: Channel<AiStreamChunk>,
) -> Result<(), AppErrorDto> {
    blocking::run(move || {
        ai_service::generate_stream(&app, system, prompt, |delta| {
            let _ = on_event.send(AiStreamChunk { delta: delta.to_string() });
        })
    })
    .await
    .map(|_| ())
    .map_err(AppErrorDto::from)
}

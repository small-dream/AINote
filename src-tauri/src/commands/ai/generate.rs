use tauri::AppHandle;

use crate::commands::blocking;
use crate::domain::ai::AiReplyDto;
use crate::domain::error::AppErrorDto;
use crate::services::ai_service;

/// Controller：编辑器写作动作（system + prompt 单轮生成）。
#[tauri::command]
pub async fn ai_generate(
    app: AppHandle,
    system: String,
    prompt: String,
) -> Result<AiReplyDto, AppErrorDto> {
    blocking::run(move || ai_service::generate(&app, system, prompt).map(|text| AiReplyDto { text }))
        .await
        .map_err(AppErrorDto::from)
}

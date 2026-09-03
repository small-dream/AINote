use tauri::AppHandle;

use crate::commands::blocking;
use crate::domain::ai::AiProvider;
use crate::domain::error::AppErrorDto;
use crate::services::ai_service;

/// Controller：拉取 Provider 当前可用的 OpenAI 兼容模型列表。
#[tauri::command]
pub async fn ai_fetch_models(
    app: AppHandle,
    provider_id: String,
    base_url: String,
    provider: AiProvider,
) -> Result<Vec<String>, AppErrorDto> {
    blocking::run(move || ai_service::fetch_models(&app, &provider_id, &base_url, provider))
        .await
        .map_err(AppErrorDto::from)
}

use tauri::AppHandle;

use crate::commands::blocking;
use crate::domain::ai_settings::{AiApiKeyInput, AiSettings, AiSettingsDto};
use crate::domain::error::AppErrorDto;
use crate::services::ai_service;

/// Controller：读取 AI 配置（含 has_key，不含明文 Key）。
#[tauri::command]
pub async fn ai_get_config(app: AppHandle) -> Result<AiSettingsDto, AppErrorDto> {
    blocking::run(move || ai_service::config(&app))
        .await
        .map_err(AppErrorDto::from)
}

/// Controller：保存 AI 设置；api_key 为 Some 时更新目标 Provider Key，None 保留已有 Key。
#[tauri::command]
pub async fn ai_save_config(
    app: AppHandle,
    settings: AiSettings,
    api_keys: Option<Vec<AiApiKeyInput>>,
) -> Result<(), AppErrorDto> {
    blocking::run(move || ai_service::save_config(&app, settings, api_keys))
        .await
        .map_err(AppErrorDto::from)
}

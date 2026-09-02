use tauri::AppHandle;

use crate::commands::blocking;
use crate::domain::ai::{AiConfig, AiConfigDto};
use crate::domain::error::AppErrorDto;
use crate::services::ai_service;

/// Controller：读取 AI 配置（含 has_key，不含明文 Key）。
#[tauri::command]
pub async fn ai_get_config(app: AppHandle) -> Result<AiConfigDto, AppErrorDto> {
    blocking::run(move || ai_service::config(&app))
        .await
        .map_err(AppErrorDto::from)
}

/// Controller：保存 AI 配置；api_key 为 Some 时加密更新，为 None 时保留已有 Key。
#[tauri::command]
pub async fn ai_save_config(
    app: AppHandle,
    cfg: AiConfig,
    api_key: Option<String>,
) -> Result<(), AppErrorDto> {
    blocking::run(move || ai_service::save_config(&app, cfg, api_key))
        .await
        .map_err(AppErrorDto::from)
}

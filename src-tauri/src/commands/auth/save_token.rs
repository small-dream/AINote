use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::services::auth_service;

/// Controller：保存 GitHub Token 到本地加密文件。
#[tauri::command]
pub async fn save_token(app: AppHandle, token: String) -> Result<(), AppErrorDto> {
    let store = auth_service::store(&app).map_err(AppErrorDto::from)?;
    blocking::run(move || store.save_token(&token))
        .await
        .map_err(AppErrorDto::from)?;
    config::save_token_present(&app, true)?;
    Ok(())
}

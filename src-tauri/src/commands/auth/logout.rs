use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::services::auth_service;

/// Controller：登出 —— 删除钥匙串 token 并清除仓库绑定。
#[tauri::command]
pub async fn logout(app: AppHandle) -> Result<(), AppErrorDto> {
    blocking::run(auth_service::delete_token)
        .await
        .map_err(AppErrorDto::from)?;
    config::clear(&app)?;
    Ok(())
}

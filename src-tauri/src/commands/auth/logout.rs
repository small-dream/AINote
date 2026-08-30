use tauri::AppHandle;

use crate::config;
use crate::domain::error::AppErrorDto;
use crate::services::auth_service;

/// Controller：登出 —— 删除钥匙串 token 并清除仓库绑定。
#[tauri::command]
pub fn logout(app: AppHandle) -> Result<(), AppErrorDto> {
    auth_service::delete_token()?;
    config::clear(&app)?;
    Ok(())
}

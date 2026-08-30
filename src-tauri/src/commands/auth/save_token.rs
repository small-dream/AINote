use crate::domain::error::AppErrorDto;
use crate::services::auth_service;

/// Controller：保存 GitHub Token 到系统钥匙串。
#[tauri::command]
pub fn save_token(token: String) -> Result<(), AppErrorDto> {
    auth_service::save_token(&token).map_err(Into::into)
}

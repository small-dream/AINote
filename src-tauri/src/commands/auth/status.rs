use tauri::AppHandle;

use crate::config;
use crate::domain::dto::AuthStatusDto;
use crate::domain::error::AppErrorDto;
use crate::services::auth_service;

/// Controller：查询认证与绑定状态。
#[tauri::command]
pub fn auth_status(app: AppHandle) -> Result<AuthStatusDto, AppErrorDto> {
    Ok(AuthStatusDto {
        has_token: auth_service::has_token(),
        repo_path: config::load_repo_path(&app)?,
    })
}

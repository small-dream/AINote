use tauri::AppHandle;

use crate::config;
use crate::domain::dto::AuthStatusDto;
use crate::domain::error::AppErrorDto;

/// Controller：查询认证与绑定状态。
#[tauri::command]
pub fn auth_status(app: AppHandle) -> Result<AuthStatusDto, AppErrorDto> {
    let (has_token, repo_path) = config::load_auth_status(&app)?;
    Ok(AuthStatusDto {
        has_token,
        repo_path,
    })
}

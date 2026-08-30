use crate::domain::error::AppErrorDto;
use crate::services::repo_service;

/// Controller：校验给定路径是否为可用 Git 仓库。
#[tauri::command]
pub fn validate_repo(repo_path: String) -> Result<bool, AppErrorDto> {
    repo_service::validate_repo(&repo_path).map_err(Into::into)
}

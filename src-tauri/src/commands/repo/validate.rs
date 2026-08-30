use crate::domain::error::AppErrorDto;
use crate::repositories::git2_backend::Git2Backend;
use crate::services::repo_service;

/// Controller：校验给定路径是否为可用 Git 仓库（前端唯一可传 repoPath 的命令）。
#[tauri::command]
pub fn validate_repo(repo_path: String) -> Result<bool, AppErrorDto> {
    repo_service::validate_repo(&Git2Backend, &repo_path).map_err(Into::into)
}

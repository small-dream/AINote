use crate::commands::blocking;
use crate::domain::error::AppErrorDto;
use crate::repositories::git2_backend::Git2Backend;
use crate::services::repo_service;

/// Controller：校验给定路径是否为可用 Git 仓库（前端唯一可传 repoPath 的命令）。
#[tauri::command]
pub async fn validate_repo(repo_path: String) -> Result<bool, AppErrorDto> {
    let backend = Git2Backend;
    blocking::run(move || repo_service::validate_repo(&backend, &repo_path))
        .await
        .map_err(AppErrorDto::from)
}

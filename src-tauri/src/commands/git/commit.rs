use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::repositories::git2_backend::Git2Backend;
use crate::services::sync_service;

/// Controller：提交全部未提交变更（message 形如 `note: <action> <path>`）。
#[tauri::command]
pub async fn git_commit(app: AppHandle, message: String) -> Result<Option<String>, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    let backend = Git2Backend;
    blocking::run(move || sync_service::commit_pending(&backend, &root, &message))
        .await
        .map_err(AppErrorDto::from)
}

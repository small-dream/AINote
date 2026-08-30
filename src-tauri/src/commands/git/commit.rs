use tauri::AppHandle;

use crate::config;
use crate::domain::error::AppErrorDto;
use crate::repositories::git2_backend::Git2Backend;
use crate::services::sync_service;

/// Controller：提交全部未提交变更（message 形如 `note: <action> <path>`）。
#[tauri::command]
pub fn git_commit(app: AppHandle, message: String) -> Result<Option<String>, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    sync_service::commit_pending(&Git2Backend, &root, &message).map_err(Into::into)
}

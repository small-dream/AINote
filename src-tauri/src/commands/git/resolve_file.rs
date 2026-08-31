use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::domain::sync::SyncStatus;
use crate::repositories::git2_backend::Git2Backend;
use crate::services::sync_service;

/// Controller：以指定内容解决单个冲突文件；全部解决后完成 merge commit（P1-3）。
#[tauri::command]
pub async fn resolve_file_conflict(
    app: AppHandle,
    path: String,
    content: String,
) -> Result<SyncStatus, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    let backend = Git2Backend;
    blocking::run(move || sync_service::resolve_file_conflict(&backend, &root, &path, &content))
        .await
        .map_err(AppErrorDto::from)
}

use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::domain::sync::ChangedFile;
use crate::repositories::git2_backend::Git2Backend;
use crate::services::sync_service;

/// Controller：工作区待提交变更（增/改/删），供手动提交面板展示。
#[tauri::command]
pub async fn git_status_files(app: AppHandle) -> Result<Vec<ChangedFile>, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    let backend = Git2Backend;
    blocking::run(move || sync_service::changed_files(&backend, &root))
        .await
        .map_err(AppErrorDto::from)
}

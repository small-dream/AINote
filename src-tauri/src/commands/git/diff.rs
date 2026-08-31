use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::domain::history::FileDiff;
use crate::repositories::git2_backend::Git2Backend;
use crate::services::history_service;

/// Controller：选中提交相对其父提交的单文件 diff。
#[tauri::command]
pub async fn git_file_diff(
    app: AppHandle,
    file: String,
    commit_id: String,
) -> Result<FileDiff, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    let backend = Git2Backend;
    blocking::run(move || history_service::file_diff(&backend, &root, &file, &commit_id))
        .await
        .map_err(AppErrorDto::from)
}

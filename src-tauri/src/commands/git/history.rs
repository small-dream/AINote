use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::domain::history::CommitInfo;
use crate::repositories::git2_backend::Git2Backend;
use crate::services::history_service;

/// Controller：指定文件的 Git 提交历史（仅含修改过该文件的提交，时间倒序）。
#[tauri::command]
pub async fn git_file_history(
    app: AppHandle,
    file: String,
) -> Result<Vec<CommitInfo>, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    let backend = Git2Backend;
    blocking::run(move || history_service::file_history(&backend, &root, &file))
        .await
        .map_err(AppErrorDto::from)
}

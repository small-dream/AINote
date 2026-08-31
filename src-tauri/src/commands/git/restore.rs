use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::repositories::git2_backend::Git2Backend;
use crate::services::history_service;

/// Controller：把文件恢复到指定提交的版本（写入工作区，由前端按需提交）。
#[tauri::command]
pub async fn git_restore_file(
    app: AppHandle,
    file: String,
    commit_id: String,
) -> Result<(), AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    let backend = Git2Backend;
    blocking::run(move || history_service::restore_file(&backend, &root, &file, &commit_id))
        .await
        .map_err(AppErrorDto::from)
}

use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::domain::working_diff::WorkingDiff;
use crate::repositories::git2_backend::Git2Backend;
use crate::services::working_diff_service;

/// Controller：单个待提交文件相对 HEAD 的 diff，供提交面板预览改动。
#[tauri::command]
pub async fn git_working_diff(app: AppHandle, file: String) -> Result<WorkingDiff, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    let backend = Git2Backend;
    blocking::run(move || working_diff_service::working_diff(&backend, &root, &file))
        .await
        .map_err(AppErrorDto::from)
}

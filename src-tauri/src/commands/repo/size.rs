use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::dto::RepoSizeDto;
use crate::domain::error::AppErrorDto;
use crate::repositories::git2_backend::Git2Backend;
use crate::services::repo_service;

/// Controller：统计当前活动仓库的本地磁盘占用。
#[tauri::command]
pub async fn get_repo_size(app: AppHandle) -> Result<RepoSizeDto, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    let root = root.to_string_lossy().into_owned();
    let backend = Git2Backend;
    let bytes = blocking::run(move || repo_service::repo_size(&backend, &root))
        .await
        .map_err(AppErrorDto::from)?;
    Ok(RepoSizeDto { bytes })
}

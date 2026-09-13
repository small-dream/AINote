use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::domain::sync::SyncStatus;
use crate::repositories::git2_backend::Git2Backend;
use crate::services::{auth_service, sync_service};

/// Controller：推送本地提交到 origin。
#[tauri::command]
pub async fn git_push(app: AppHandle) -> Result<SyncStatus, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    let remote = config::active_remote_url(&app)?;
    let cred = auth_service::credential_for_url(&app, remote.as_deref())?;
    let backend = Git2Backend;
    blocking::run(move || sync_service::push(&backend, &root, &cred))
        .await
        .map_err(AppErrorDto::from)
}

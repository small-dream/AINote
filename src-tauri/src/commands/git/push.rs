use tauri::AppHandle;

use crate::config;
use crate::domain::error::AppErrorDto;
use crate::domain::sync::SyncStatus;
use crate::repositories::git2_backend::Git2Backend;
use crate::services::{auth_service, sync_service};

/// Controller：推送本地提交到 origin。
#[tauri::command]
pub fn git_push(app: AppHandle) -> Result<SyncStatus, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    let token = auth_service::read_token()?;
    sync_service::push(&Git2Backend, &root, &token).map_err(Into::into)
}

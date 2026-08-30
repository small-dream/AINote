use tauri::AppHandle;

use crate::config;
use crate::domain::error::AppErrorDto;
use crate::domain::sync::SyncStatus;
use crate::repositories::git2_backend::Git2Backend;
use crate::services::{auth_service, sync_service};

/// Controller：拉取远端并合并（冲突时返回 SYNC_4001）。
#[tauri::command]
pub fn git_pull(app: AppHandle) -> Result<SyncStatus, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    let token = auth_service::read_token()?;
    sync_service::pull(&Git2Backend, &root, &token).map_err(Into::into)
}

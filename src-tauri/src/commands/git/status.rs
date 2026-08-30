use tauri::AppHandle;

use crate::config;
use crate::domain::error::AppErrorDto;
use crate::domain::sync::SyncStatus;
use crate::repositories::git2_backend::Git2Backend;
use crate::services::sync_service;

/// Controller：查询同步状态（纯本地操作，无需网络）。
#[tauri::command]
pub fn sync_status(app: AppHandle) -> Result<SyncStatus, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    sync_service::status(&Git2Backend, &root).map_err(Into::into)
}

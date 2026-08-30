use tauri::AppHandle;

use crate::config;
use crate::domain::error::AppErrorDto;
use crate::domain::sync::SyncStatus;
use crate::repositories::git2_backend::Git2Backend;
use crate::services::{auth_service, sync_service};

/// Controller：解决合并冲突（useLocal=true 保留本地侧），完成后 push。
#[tauri::command]
pub fn resolve_conflict(app: AppHandle, use_local: bool) -> Result<SyncStatus, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    let token = auth_service::read_token()?;
    sync_service::resolve(&Git2Backend, &root, &token, use_local).map_err(Into::into)
}

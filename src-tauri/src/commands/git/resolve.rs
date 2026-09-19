use tauri::AppHandle;

use crate::commands::blocking;
use crate::commands::git::repo_lock::RepoWriteGuard;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::domain::sync::SyncStatus;
use crate::repositories::git2_backend::Git2Backend;
use crate::services::{auth_service, sync_service};

/// Controller：解决合并冲突（useLocal=true 保留本地侧），完成后 push。
/// 写 index/refs，与其它写命令互斥（SYNC_4005）。
#[tauri::command]
pub async fn resolve_conflict(app: AppHandle, use_local: bool) -> Result<SyncStatus, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    let _guard = RepoWriteGuard::acquire(&app, root.to_string_lossy().into_owned())
        .map_err(AppErrorDto::from)?;
    let remote = config::active_remote_url(&app)?;
    let cred = auth_service::credential_for_url(&app, remote.as_deref())?;
    let backend = Git2Backend;
    blocking::run(move || sync_service::resolve(&backend, &root, &cred, use_local))
        .await
        .map_err(AppErrorDto::from)
}

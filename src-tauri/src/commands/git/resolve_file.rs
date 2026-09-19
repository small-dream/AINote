use tauri::AppHandle;

use crate::commands::blocking;
use crate::commands::git::repo_lock::RepoWriteGuard;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::domain::sync::SyncStatus;
use crate::repositories::git2_backend::Git2Backend;
use crate::services::sync_service;

/// Controller：以指定内容解决单个冲突文件；全部解决后完成 merge commit（P1-3）。
/// 写 index/refs，与其它写命令互斥（SYNC_4005）；会话内多次调用为串行单发，
/// 每次调用在返回时已释放槽位，不会误伤下一次解决。
#[tauri::command]
pub async fn resolve_file_conflict(
    app: AppHandle,
    path: String,
    content: String,
) -> Result<SyncStatus, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    let _guard = RepoWriteGuard::acquire(&app, root.to_string_lossy().into_owned())
        .map_err(AppErrorDto::from)?;
    let backend = Git2Backend;
    blocking::run(move || sync_service::resolve_file_conflict(&backend, &root, &path, &content))
        .await
        .map_err(AppErrorDto::from)
}

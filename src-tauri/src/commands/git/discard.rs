use tauri::AppHandle;

use crate::commands::blocking;
use crate::commands::git::repo_lock::RepoWriteGuard;
use crate::config;
use crate::domain::discard::DiscardReport;
use crate::domain::error::AppErrorDto;
use crate::repositories::git2_backend::Git2Backend;
use crate::services::discard_service;

/// Controller：丢弃选中路径的本地改动（已跟踪文件恢复到 HEAD，新增文件彻底删除）。
/// 纯本地操作；写 index/工作区，与其它写命令互斥（SYNC_4005）。
#[tauri::command]
pub async fn git_discard_changes(
    app: AppHandle,
    paths: Vec<String>,
) -> Result<DiscardReport, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    let _guard = RepoWriteGuard::acquire(&app, root.to_string_lossy().into_owned())
        .map_err(AppErrorDto::from)?;
    let backend = Git2Backend;
    blocking::run(move || discard_service::discard(&backend, &root, &paths))
        .await
        .map_err(AppErrorDto::from)
}

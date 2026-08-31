use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::domain::sync::ConflictFile;
use crate::repositories::git2_backend::Git2Backend;
use crate::services::sync_service;

/// Controller：列出全部冲突文件（本地/远端内容），供三栏合并（P1-3）。
#[tauri::command]
pub async fn list_conflicts(app: AppHandle) -> Result<Vec<ConflictFile>, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    let backend = Git2Backend;
    blocking::run(move || sync_service::list_conflicts(&backend, &root))
        .await
        .map_err(AppErrorDto::from)
}

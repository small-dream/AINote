use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::services::trash_service;

/// Controller：恢复指定回收站条目，返回实际恢复路径（P2）。
#[tauri::command]
pub async fn trash_restore(app: AppHandle, id: String) -> Result<String, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    blocking::run(move || trash_service::restore_trash_item(&root, &id))
        .await
        .map_err(AppErrorDto::from)
}

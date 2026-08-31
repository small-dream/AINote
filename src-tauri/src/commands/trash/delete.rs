use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::services::trash_service;

/// Controller：彻底删除单个回收站条目（P2）。
#[tauri::command]
pub async fn trash_delete(app: AppHandle, id: String) -> Result<(), AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    blocking::run(move || trash_service::delete_trash_item(&root, &id))
        .await
        .map_err(AppErrorDto::from)
}

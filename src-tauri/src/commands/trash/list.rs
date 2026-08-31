use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::domain::trash::TrashItem;
use crate::services::trash_service;

/// Controller：列出回收站全部条目（P2）。
#[tauri::command]
pub async fn trash_list(app: AppHandle) -> Result<Vec<TrashItem>, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    blocking::run(move || trash_service::list_trash(&root))
        .await
        .map_err(AppErrorDto::from)
}

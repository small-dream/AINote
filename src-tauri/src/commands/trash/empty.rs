use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::services::trash_service;

/// Controller：清空回收站（P2）。
#[tauri::command]
pub async fn trash_empty(app: AppHandle) -> Result<(), AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    blocking::run(move || trash_service::empty_trash(&root))
        .await
        .map_err(AppErrorDto::from)
}

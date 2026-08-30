use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::services::note_service;

/// Controller：移动/重命名笔记（from/to 为仓库相对路径）。
#[tauri::command]
pub async fn move_note(app: AppHandle, from: String, to: String) -> Result<(), AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    blocking::run(move || note_service::move_note(&root, &from, &to))
        .await
        .map_err(AppErrorDto::from)
}

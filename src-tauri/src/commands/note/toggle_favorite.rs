use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::services::note_favorite_service;

/// Controller：切换笔记收藏状态，返回收藏后的布尔值。
#[tauri::command]
pub async fn toggle_note_favorite(app: AppHandle, path: String) -> Result<bool, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    blocking::run(move || note_favorite_service::toggle_note_favorite(&root, &path))
        .await
        .map_err(AppErrorDto::from)
}

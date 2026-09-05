use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::domain::note::NoteMeta;
use crate::services::note_favorite_service;

/// Controller：列出收藏笔记（收藏顺序）。
#[tauri::command]
pub async fn list_favorite_notes(app: AppHandle) -> Result<Vec<NoteMeta>, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    blocking::run(move || note_favorite_service::list_favorite_notes(&root))
        .await
        .map_err(AppErrorDto::from)
}

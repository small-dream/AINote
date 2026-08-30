use tauri::AppHandle;

use crate::config;
use crate::domain::error::AppErrorDto;
use crate::services::note_service;

/// Controller：删除笔记。
#[tauri::command]
pub fn delete_note(app: AppHandle, path: String) -> Result<(), AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    note_service::delete_note(&root, &path).map_err(Into::into)
}

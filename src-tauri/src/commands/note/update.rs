use tauri::AppHandle;

use crate::config;
use crate::domain::error::AppErrorDto;
use crate::services::note_service;

/// Controller：更新笔记内容。
#[tauri::command]
pub fn update_note(app: AppHandle, path: String, content: String) -> Result<(), AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    note_service::update_note(&root, &path, &content).map_err(Into::into)
}

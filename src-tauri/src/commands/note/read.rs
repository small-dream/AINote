use tauri::AppHandle;

use crate::config;
use crate::domain::error::AppErrorDto;
use crate::domain::note::NoteContent;
use crate::services::note_service;

/// Controller：读取笔记完整内容。
#[tauri::command]
pub fn read_note(app: AppHandle, path: String) -> Result<NoteContent, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    note_service::read_note(&root, &path).map_err(Into::into)
}

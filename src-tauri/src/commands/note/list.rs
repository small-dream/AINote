use std::path::PathBuf;

use crate::domain::error::AppErrorDto;
use crate::domain::note::NoteMeta;
use crate::services::note_service;

/// Controller：仅做参数转换与错误映射，业务逻辑在 note_service。
#[tauri::command]
pub fn list_notes(repo_path: String) -> Result<Vec<NoteMeta>, AppErrorDto> {
    note_service::list_notes(&PathBuf::from(repo_path)).map_err(Into::into)
}

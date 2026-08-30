use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::domain::note::NoteMeta;
use crate::services::note_service;

/// Controller：仅做参数转换与错误映射，业务逻辑在 note_service。
#[tauri::command]
pub async fn list_notes(app: AppHandle) -> Result<Vec<NoteMeta>, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    blocking::run(move || note_service::list_notes(&root))
        .await
        .map_err(AppErrorDto::from)
}

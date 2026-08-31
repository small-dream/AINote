use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::domain::wiki::NoteWiki;
use crate::services::wiki_service;

/// Controller：扫描仓库全部笔记的标签与双链（P1-5）。
#[tauri::command]
pub async fn wiki_index(app: AppHandle) -> Result<Vec<NoteWiki>, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    blocking::run(move || wiki_service::wiki_index(&root))
        .await
        .map_err(AppErrorDto::from)
}

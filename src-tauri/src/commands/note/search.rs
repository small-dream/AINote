use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::domain::search::SearchResult;
use crate::services::search_service;

/// Controller：全文搜索笔记（标题 + 正文，忽略大小写，标题命中优先）。
#[tauri::command]
pub async fn search_notes(app: AppHandle, query: String) -> Result<Vec<SearchResult>, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    blocking::run(move || search_service::search_notes(&root, &query))
        .await
        .map_err(AppErrorDto::from)
}

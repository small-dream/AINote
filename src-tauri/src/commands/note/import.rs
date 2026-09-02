use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::domain::note::NoteMeta;
use crate::services::note_service;

/// Controller：把外部 Markdown 文件内容导入为笔记（写入当前目录，重名自动加序号）。
#[tauri::command]
pub async fn import_note(
    app: AppHandle,
    dir: String,
    file_name: String,
    content: String,
) -> Result<NoteMeta, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    blocking::run(move || note_service::import_note(&root, &dir, &file_name, &content))
        .await
        .map_err(AppErrorDto::from)
}

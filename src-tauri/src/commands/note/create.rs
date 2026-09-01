use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::domain::note::{NoteKind, NoteMeta};
use crate::services::note_service;

/// Controller：新建笔记（repoPath 由后端 config 读取）。kind 决定默认模板；content 为 None 时写入默认模板。
#[tauri::command]
pub async fn create_note(
    app: AppHandle,
    path: String,
    kind: NoteKind,
    content: Option<String>,
) -> Result<NoteMeta, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    blocking::run(move || note_service::create_note(&root, &path, kind, content.as_deref()))
        .await
        .map_err(AppErrorDto::from)
}

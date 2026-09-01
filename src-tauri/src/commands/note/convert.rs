use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::services::note_service;

/// Controller：转换笔记类型（`.md` ↔ `.ainote`）。前端负责把旧内容转换为新类型文本，
/// 后端把旧文件替换为新扩展名文件（原子性由单命令内的写+删保证）。
#[tauri::command]
pub async fn convert_note(
    app: AppHandle,
    from: String,
    to: String,
    content: String,
) -> Result<(), AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    blocking::run(move || note_service::convert_note_kind(&root, &from, &to, &content))
        .await
        .map_err(AppErrorDto::from)
}

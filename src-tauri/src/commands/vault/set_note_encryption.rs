use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::domain::note::NoteMeta;
use crate::services::note_service;

/// Controller：把一篇已有笔记切换为加密态 / 明文态（E4 逐篇开关）。
#[tauri::command]
pub async fn vault_set_note_encryption(
    app: AppHandle,
    path: String,
    encrypted: bool,
) -> Result<NoteMeta, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    blocking::run(move || note_service::set_note_encryption(&root, &path, encrypted))
        .await
        .map_err(AppErrorDto::from)
}

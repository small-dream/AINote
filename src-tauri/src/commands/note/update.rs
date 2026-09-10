use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::services::note_service;

/// Controller：更新笔记内容。
#[tauri::command]
pub async fn update_note(app: AppHandle, path: String, content: String) -> Result<(), AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    let safe_path = config::logging::redact(&path);
    blocking::run(move || note_service::update_note(&root, &path, &content))
        .await
        .map_err(|err| {
            log::error!(target: "ainote::note", "保存失败 path={safe_path} error={err}");
            AppErrorDto::from(err)
        })
}

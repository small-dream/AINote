use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::services::note_service;

/// Controller：递归删除目录及其内容。
#[tauri::command]
pub async fn delete_folder(app: AppHandle, path: String) -> Result<(), AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    blocking::run(move || note_service::delete_folder(&root, &path))
        .await
        .map_err(AppErrorDto::from)
}

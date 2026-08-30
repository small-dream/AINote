use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::services::note_service;

/// Controller：新建文件夹（repoPath 由后端 config 读取）。
#[tauri::command]
pub async fn create_folder(app: AppHandle, path: String) -> Result<(), AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    blocking::run(move || note_service::create_folder(&root, &path))
        .await
        .map_err(AppErrorDto::from)
}

use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::services::task_service;

/// Controller：重命名 Todo 清单。
#[tauri::command]
pub async fn task_rename_list(
    app: AppHandle,
    list_id: String,
    name: String,
) -> Result<(), AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    blocking::run(move || task_service::rename_list(&root, &list_id, &name))
        .await
        .map_err(AppErrorDto::from)
}

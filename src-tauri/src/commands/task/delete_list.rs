use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::services::task_service;

/// Controller：删除 Todo 清单（级联删除其下任务）。
#[tauri::command]
pub async fn task_delete_list(app: AppHandle, list_id: String) -> Result<(), AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    blocking::run(move || task_service::delete_list(&root, &list_id))
        .await
        .map_err(AppErrorDto::from)
}

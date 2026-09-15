use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::domain::task::TaskList;
use crate::services::task_service;

/// Controller：新建 Todo 清单。
#[tauri::command]
pub async fn task_create_list(app: AppHandle, name: String) -> Result<TaskList, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    blocking::run(move || task_service::create_list(&root, &name))
        .await
        .map_err(AppErrorDto::from)
}

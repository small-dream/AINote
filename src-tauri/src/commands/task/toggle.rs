use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::domain::task::TaskItem;
use crate::services::task_service;

/// Controller：切换 Todo 任务完成状态。
#[tauri::command]
pub async fn task_toggle(app: AppHandle, task_id: String) -> Result<TaskItem, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    blocking::run(move || task_service::toggle_task(&root, &task_id))
        .await
        .map_err(AppErrorDto::from)
}

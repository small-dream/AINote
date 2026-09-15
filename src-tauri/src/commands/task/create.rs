use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::domain::task::{TaskItem, TaskPriority};
use crate::services::task_service;

/// Controller：在指定清单下新建 Todo 任务。
#[tauri::command]
pub async fn task_create(
    app: AppHandle,
    list_id: String,
    title: String,
    due_date: Option<String>,
    priority: TaskPriority,
    remind_at: Option<String>,
) -> Result<TaskItem, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    blocking::run(move || {
        task_service::create_task(&root, &list_id, &title, due_date, priority, remind_at)
    })
    .await
    .map_err(AppErrorDto::from)
}

use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::domain::task::{TaskItem, TaskPriority};
use crate::services::task_service;

/// Controller：全量更新 Todo 任务的可编辑字段。
#[tauri::command]
pub async fn task_update(
    app: AppHandle,
    task_id: String,
    title: String,
    description: Option<String>,
    due_at: Option<String>,
    priority: TaskPriority,
    remind_at: Option<String>,
) -> Result<TaskItem, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    blocking::run(move || {
        task_service::update_task(&root, &task_id, &title, description, due_at, priority, remind_at)
    })
    .await
    .map_err(AppErrorDto::from)
}

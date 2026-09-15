use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::domain::task::TaskBoard;
use crate::services::task_service;

/// Controller：读取 Todo 看板全量数据。
#[tauri::command]
pub async fn task_board(app: AppHandle) -> Result<TaskBoard, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    blocking::run(move || task_service::board(&root))
        .await
        .map_err(AppErrorDto::from)
}

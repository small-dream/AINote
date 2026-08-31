use tauri::AppHandle;

use crate::config;
use crate::domain::error::AppErrorDto;

/// Controller：移除已绑定仓库；返回移除后新的活动仓库路径（无仓库时为 null）。
#[tauri::command]
pub fn remove_repo(app: AppHandle, id: String) -> Result<Option<String>, AppErrorDto> {
    config::repos::remove(&app, &id).map_err(AppErrorDto::from)
}

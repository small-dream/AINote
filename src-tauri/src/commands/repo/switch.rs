use tauri::AppHandle;

use crate::config;
use crate::domain::error::AppErrorDto;

/// Controller：切换活动仓库；返回新活动仓库路径。
#[tauri::command]
pub fn switch_repo(app: AppHandle, id: String) -> Result<String, AppErrorDto> {
    config::repos::switch_to(&app, &id).map_err(AppErrorDto::from)
}

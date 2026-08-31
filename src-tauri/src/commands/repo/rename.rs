use tauri::AppHandle;

use crate::config;
use crate::domain::error::AppErrorDto;

/// Controller：重命名已绑定仓库（展示名）。
#[tauri::command]
pub fn rename_repo(app: AppHandle, id: String, name: String) -> Result<(), AppErrorDto> {
    config::repos::rename(&app, &id, &name).map_err(AppErrorDto::from)
}

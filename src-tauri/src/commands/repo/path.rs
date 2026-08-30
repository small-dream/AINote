use tauri::AppHandle;

use crate::config;
use crate::domain::error::AppErrorDto;

/// Controller：返回当前 config 中的 repoPath（未绑定为 null）。
#[tauri::command]
pub fn get_repo_path(app: AppHandle) -> Result<Option<String>, AppErrorDto> {
    config::load_repo_path(&app).map_err(Into::into)
}

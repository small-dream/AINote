use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::domain::vault::VaultStatus;
use crate::services::vault_service;

/// Controller：锁定并清空进程内的主密钥（前端需先 flush 未落盘草稿）。
#[tauri::command]
pub async fn vault_lock(app: AppHandle) -> Result<VaultStatus, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    blocking::run(move || vault_service::lock(&root))
        .await
        .map_err(AppErrorDto::from)
}

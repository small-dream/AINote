use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::domain::vault::VaultStatus;
use crate::services::vault_service;

/// Controller：解锁当前仓库的加密笔记。
#[tauri::command]
pub async fn vault_unlock(app: AppHandle, passphrase: String) -> Result<VaultStatus, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    blocking::run(move || vault_service::unlock(&root, &passphrase))
        .await
        .map_err(AppErrorDto::from)
}

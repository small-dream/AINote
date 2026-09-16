use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::domain::vault::VaultStatus;
use crate::services::vault_service;

/// Controller：建库（口令只在此处透传，不写日志、不进 DTO）。
#[tauri::command]
pub async fn vault_create(app: AppHandle, passphrase: String) -> Result<VaultStatus, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    blocking::run(move || vault_service::create(&root, &passphrase))
        .await
        .map_err(AppErrorDto::from)
}

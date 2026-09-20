use tauri::AppHandle;

use crate::commands::blocking;
use crate::commands::vault::support;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::domain::vault::VaultStatusResponse;
use crate::services::vault_service;

/// Controller：用仓库口令解锁加密笔记。
#[tauri::command]
pub async fn vault_unlock(
    app: AppHandle,
    passphrase: String,
) -> Result<VaultStatusResponse, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    let context = support::context(&app, &root)?;
    let status = blocking::run(move || vault_service::unlock(&root, &passphrase))
        .await
        .map_err(AppErrorDto::from)?;
    Ok(support::respond(&context, status))
}

use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::domain::vault::VaultStatus;
use crate::services::vault_service;

/// Controller：改口令（旧口令校验通过后重新封装主密钥，笔记文件不变）。
#[tauri::command]
pub async fn vault_change_passphrase(
    app: AppHandle,
    old_passphrase: String,
    new_passphrase: String,
) -> Result<VaultStatus, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    blocking::run(move || vault_service::change_passphrase(&root, &old_passphrase, &new_passphrase))
        .await
        .map_err(AppErrorDto::from)
}

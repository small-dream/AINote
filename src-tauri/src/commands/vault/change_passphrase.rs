use tauri::AppHandle;

use crate::commands::blocking;
use crate::commands::vault::support;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::domain::vault::VaultStatusResponse;
use crate::platform::quick_unlock;
use crate::services::{quick_unlock_service, vault_service};

/// Controller：改口令（旧口令校验通过后重新封装主密钥，笔记文件不变）。
/// 指纹随封装变化：已开启快速解锁时按新指纹重新封装，失败则关闭并降级为纯口令。
#[tauri::command]
pub async fn vault_change_passphrase(
    app: AppHandle,
    old_passphrase: String,
    new_passphrase: String,
) -> Result<VaultStatusResponse, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    let context = support::context(&app, &root)?;
    let status = blocking::run(move || {
        vault_service::change_passphrase(&root, &old_passphrase, &new_passphrase)
    })
    .await
    .map_err(AppErrorDto::from)?;
    quick_unlock_service::after_vault_rewritten(&context, quick_unlock::store());
    Ok(support::respond(&context, status))
}

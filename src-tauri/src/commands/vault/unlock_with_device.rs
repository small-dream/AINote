use tauri::AppHandle;

use crate::commands::blocking;
use crate::commands::vault::support;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::domain::vault::VaultStatusResponse;
use crate::platform::quick_unlock;
use crate::services::{quick_unlock_service, vault_service};

/// Controller：用设备级认证（Touch ID / Face ID / 指纹 / 设备密码）解锁，不经过口令。
/// 系统认证可能持续数秒，必须在后台线程等待。
#[tauri::command]
pub async fn vault_unlock_with_device(
    app: AppHandle,
) -> Result<VaultStatusResponse, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    let context = support::context(&app, &root)?;
    let (status, quick) = blocking::run(move || {
        let quick = quick_unlock_service::unlock(&context, quick_unlock::store())?;
        Ok((vault_service::status(&root)?, quick))
    })
    .await
    .map_err(AppErrorDto::from)?;
    Ok(VaultStatusResponse::new(status, quick))
}

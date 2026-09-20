use tauri::AppHandle;

use crate::commands::blocking;
use crate::commands::vault::support;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::domain::vault::VaultStatusResponse;
use crate::platform::quick_unlock;
use crate::services::{quick_unlock_service, vault_service};

/// Controller：在本机开启设备级快速解锁。
/// 要求仓库已解锁（主密钥在内存里），并会触发一次系统认证；认证在后台线程等待，不阻塞前端。
#[tauri::command]
pub async fn vault_quick_unlock_enable(
    app: AppHandle,
) -> Result<VaultStatusResponse, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    let context = support::context(&app, &root)?;
    let (status, quick) = blocking::run(move || {
        let quick = quick_unlock_service::enable(&context, quick_unlock::store())?;
        Ok((vault_service::status(&root)?, quick))
    })
    .await
    .map_err(AppErrorDto::from)?;
    Ok(VaultStatusResponse::new(status, quick))
}

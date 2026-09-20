use tauri::AppHandle;

use crate::commands::blocking;
use crate::commands::vault::support;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::domain::vault::VaultStatusResponse;
use crate::platform::quick_unlock;
use crate::services::{quick_unlock_service, vault_service};

/// Controller：关闭设备级快速解锁（删除本机条目与标记，立即回到「每次输入口令」）。
#[tauri::command]
pub async fn vault_quick_unlock_disable(
    app: AppHandle,
) -> Result<VaultStatusResponse, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    let context = support::context(&app, &root)?;
    let (status, quick) = blocking::run(move || {
        let quick = quick_unlock_service::disable(&context, quick_unlock::store())?;
        Ok((vault_service::status(&root)?, quick))
    })
    .await
    .map_err(AppErrorDto::from)?;
    Ok(VaultStatusResponse::new(status, quick))
}

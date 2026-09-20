use tauri::AppHandle;

use crate::commands::blocking;
use crate::commands::vault::support;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::domain::vault::VaultStatusResponse;
use crate::platform::quick_unlock;
use crate::services::{quick_unlock_service, vault_service};

/// Controller：建库（口令只在此处透传，不写日志、不进 DTO）。
/// 建库 = 新主密钥，因此本机的快速解锁条目一律作废清理（用户可随后重新开启）。
#[tauri::command]
pub async fn vault_create(
    app: AppHandle,
    passphrase: String,
) -> Result<VaultStatusResponse, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    let context = support::context(&app, &root)?;
    let status = blocking::run(move || vault_service::create(&root, &passphrase))
        .await
        .map_err(AppErrorDto::from)?;
    let _ = quick_unlock_service::disable(&context, quick_unlock::store());
    Ok(support::respond(&context, status))
}

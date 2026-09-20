use tauri::AppHandle;

use crate::commands::blocking;
use crate::commands::vault::support;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::domain::vault::VaultStatusResponse;
use crate::services::vault_service;

/// Controller：读取当前仓库的加密状态（未建库 / 已锁定 / 已解锁 + 加密笔记数量 + 本机快速解锁状态）。
#[tauri::command]
pub async fn vault_status(app: AppHandle) -> Result<VaultStatusResponse, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    let context = support::context(&app, &root)?;
    let status = blocking::run(move || vault_service::status(&root))
        .await
        .map_err(AppErrorDto::from)?;
    Ok(support::respond(&context, status))
}

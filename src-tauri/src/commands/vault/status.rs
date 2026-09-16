use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::domain::vault::VaultStatus;
use crate::services::vault_service;

/// Controller：读取当前仓库的加密状态（未建库 / 已锁定 / 已解锁 + 加密笔记数量）。
#[tauri::command]
pub async fn vault_status(app: AppHandle) -> Result<VaultStatus, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    blocking::run(move || vault_service::status(&root))
        .await
        .map_err(AppErrorDto::from)
}

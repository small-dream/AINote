use tauri::AppHandle;

use crate::commands::blocking;
use crate::commands::vault::support;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::domain::vault::VaultStatusResponse;
use crate::services::vault_service;

/// Controller：锁定并清空进程内的主密钥（前端需先 flush 未落盘草稿）。
/// 设备级快速解锁条目不受影响：它正是下次免口令进入的依据。
#[tauri::command]
pub async fn vault_lock(app: AppHandle) -> Result<VaultStatusResponse, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    let context = support::context(&app, &root)?;
    let status = blocking::run(move || vault_service::lock(&root))
        .await
        .map_err(AppErrorDto::from)?;
    Ok(support::respond(&context, status))
}

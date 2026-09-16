use tauri::AppHandle;

use crate::commands::blocking;
use crate::commands::git::sync::SyncRetryState;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::domain::history_reset::HistoryResetReport;
use crate::repositories::git2_rewrite::Git2Rewrite;
use crate::services::{auth_service, history_reset_service};
use tauri::Manager;

/// Controller：把当前活动仓库重置为「工作区现状 = 唯一一次提交」。
///
/// 破坏性操作：本地旧 `.git` 会被物理删除，远端历史靠强制推送覆盖。
/// 凭证读取失败（未登录）时不在这里报错：本地仓库不需要凭证，
/// 有远端却拿不到凭证的情况由 Service 给出中文提示。
#[tauri::command]
pub async fn reset_repo_history(
    app: AppHandle,
    message: String,
) -> Result<HistoryResetReport, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    let remote = config::active_remote_url(&app)?;
    let cred = auth_service::credential_for_url(&app, remote.as_deref()).ok();
    // 与一键同步共用同一把仓库级互斥锁：同步进行中直接拒绝，避免同一仓库并发写入
    let state = app.state::<SyncRetryState>();
    let repo_key = root.to_string_lossy().to_string();
    let slot = state.acquire(&repo_key).map_err(AppErrorDto::from)?;
    let result = blocking::run(move || {
        history_reset_service::reset(&Git2Rewrite, &root, cred.as_ref(), &message)
    })
    .await;
    state.release(&repo_key, &slot);
    result.map_err(AppErrorDto::from)
}

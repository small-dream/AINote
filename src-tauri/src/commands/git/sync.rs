use tauri::ipc::Channel;
use tauri::{AppHandle, Manager};

use crate::commands::git::repo_lock::{RepoWriteGuard, RepoWriteLock};
use crate::config;
use crate::domain::error::{AppError, AppErrorDto};
use crate::domain::metrics::MetricEvent;
use crate::domain::sync::{SyncProgressDto, SyncStatus};
use crate::repositories::git2_backend::Git2Backend;
use crate::services::retry::{RetryAttempt, RetryContext};
use crate::services::sync_service::SyncFailure;
use crate::services::{auth_service, sync_service};

/// Controller：一键同步（commit 未提交变更 → pull → push）。
/// 拉取阶段遇到网络错误会按退避自动重试，并通过 Channel 上报「重试中（n/m）」。
/// 与其它写命令共用仓库写锁（见 repo_lock.rs）：锁只在 command 入口获取，
/// 内部直接走 services 层（commit_pending/pull_stage/backend.push），不经过其它命令，无自锁。
#[tauri::command]
pub async fn sync_now(
    app: AppHandle,
    on_event: Channel<SyncProgressDto>,
) -> Result<SyncStatus, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    let remote = config::active_remote_url(&app)?;
    let cred = auth_service::credential_for_url(&app, remote.as_deref())?;
    let backend = Git2Backend;
    let guard = RepoWriteGuard::acquire(&app, root.to_string_lossy().into_owned())
        .map_err(AppErrorDto::from)?;
    let cancel = guard.cancel_flag();

    // 这里不用 blocking::run：同步失败要保留 stage / files，不能用 AppError 抹平
    let join = tauri::async_runtime::spawn_blocking(move || {
        let mut report = |attempt: RetryAttempt| {
            let _ = on_event.send(SyncProgressDto {
                phase: "retrying".into(),
                retry: attempt.retry,
                max_retries: attempt.max_retries,
                delay_ms: attempt.delay_ms,
            });
        };
        let mut ctx = RetryContext {
            cancel: &cancel,
            sleep: None,
            report: Some(&mut report),
        };
        sync_service::sync(&backend, &root, &cred, &mut ctx)
    })
    .await;
    drop(guard);
    let result =
        join.map_err(|err| AppErrorDto::from(AppError::Io(format!("后台任务失败: {err}"))))?;
    match result {
        Ok(status) => {
            crate::services::metrics_service::record_best_effort(&app, MetricEvent::SyncSucceeded);
            Ok(status)
        }
        Err(failure) => {
            crate::services::metrics_service::record_best_effort(&app, MetricEvent::SyncFailed);
            Err(sync_failure_dto(failure))
        }
    }
}

/// 同步失败 → 结构化错误：附带阶段 / 失败文件 / 建议码，前端据此定位（E4-T4）。
fn sync_failure_dto(failure: SyncFailure) -> AppErrorDto {
    let hint = failure.hint();
    AppErrorDto::from(failure.error).with_sync_context(failure.stage, failure.files, hint)
}

/// Controller：取消进行中的同步自动重试；无任务时静默成功。
#[tauri::command]
pub fn cancel_sync_retry(app: AppHandle) -> Result<(), AppErrorDto> {
    app.state::<RepoWriteLock>().cancel_all();
    Ok(())
}

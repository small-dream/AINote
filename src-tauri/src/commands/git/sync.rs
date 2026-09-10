use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use tauri::ipc::Channel;
use tauri::{AppHandle, Manager};

use crate::config;
use crate::domain::error::{AppError, AppErrorDto};
use crate::domain::metrics::MetricEvent;
use crate::domain::sync::{SyncProgressDto, SyncStatus};
use crate::repositories::git2_backend::Git2Backend;
use crate::services::retry::{RetryAttempt, RetryContext};
use crate::services::sync_service::SyncFailure;
use crate::services::{auth_service, sync_service};

/// 进行中的同步任务：以仓库路径为键的取消标志表，兼作防重入互斥（P2-2）。
/// 取消只结束退避等待，不中断已经发出的网络请求。
#[derive(Default)]
pub struct SyncRetryState(Mutex<HashMap<String, Arc<AtomicBool>>>);

impl SyncRetryState {
    /// 抢占指定仓库的同步槽位并返回其取消标志；已有进行中同步时报「同步进行中」。
    fn acquire(&self, repo: &str) -> Result<Arc<AtomicBool>, AppError> {
        let mut guard = self
            .0
            .lock()
            .map_err(|_| AppError::Io("同步状态锁不可用".into()))?;
        if guard.contains_key(repo) {
            return Err(AppError::SyncBusy("同步进行中，请稍后再试".into()));
        }
        let flag = Arc::new(AtomicBool::new(false));
        guard.insert(repo.to_string(), flag.clone());
        Ok(flag)
    }

    /// 任务结束释放槽位：只有槽位里仍是自己的 flag 才清理，避免误清后来的同步。
    fn release(&self, repo: &str, flag: &Arc<AtomicBool>) {
        if let Ok(mut guard) = self.0.lock() {
            if guard.get(repo).is_some_and(|current| Arc::ptr_eq(current, flag)) {
                guard.remove(repo);
            }
        }
    }

    /// 取消全部进行中的同步（前端取消按钮不区分仓库）。
    fn cancel_all(&self) {
        if let Ok(guard) = self.0.lock() {
            for flag in guard.values() {
                flag.store(true, Ordering::SeqCst);
            }
        }
    }
}

/// Controller：一键同步（commit 未提交变更 → pull → push）。
/// 拉取阶段遇到网络错误会按退避自动重试，并通过 Channel 上报「重试中（n/m）」。
#[tauri::command]
pub async fn sync_now(
    app: AppHandle,
    on_event: Channel<SyncProgressDto>,
) -> Result<SyncStatus, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    let token = auth_service::read_token(&app)?;
    let backend = Git2Backend;
    let key = root.to_string_lossy().into_owned();
    let cancel = app
        .state::<SyncRetryState>()
        .acquire(&key)
        .map_err(AppErrorDto::from)?;
    let slot = cancel.clone();

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
        sync_service::sync(&backend, &root, &token, &mut ctx)
    })
    .await;
    app.state::<SyncRetryState>().release(&key, &slot);
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
    app.state::<SyncRetryState>().cancel_all();
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn acquire_rejects_reentry_for_same_repo() {
        let state = SyncRetryState::default();
        let first = state.acquire("/repo").unwrap();
        let err = state.acquire("/repo").unwrap_err();
        assert!(matches!(err, AppError::SyncBusy(_)), "同仓库重入被拒");
        assert!(state.acquire("/other").is_ok(), "不同仓库互不阻塞");
        state.release("/repo", &first);
        assert!(state.acquire("/repo").is_ok(), "释放后可再次进入");
    }

    #[test]
    fn busy_error_maps_to_sync_4005() {
        let state = SyncRetryState::default();
        let _running = state.acquire("/repo").unwrap();
        let dto = AppErrorDto::from(state.acquire("/repo").unwrap_err());
        assert_eq!(dto.code, "SYNC_4005");
        assert!(dto.retriable);
    }

    #[test]
    fn release_only_clears_own_flag() {
        let state = SyncRetryState::default();
        let current = state.acquire("/repo").unwrap();
        let stale = Arc::new(AtomicBool::new(false));
        state.release("/repo", &stale);
        assert!(state.acquire("/repo").is_err(), "别人的 flag 不得清理槽位");
        state.release("/repo", &current);
        assert!(state.acquire("/repo").is_ok());
    }

    #[test]
    fn cancel_all_marks_every_running_flag() {
        let state = SyncRetryState::default();
        let a = state.acquire("/a").unwrap();
        let b = state.acquire("/b").unwrap();
        state.cancel_all();
        assert!(a.load(Ordering::SeqCst));
        assert!(b.load(Ordering::SeqCst));
    }
}

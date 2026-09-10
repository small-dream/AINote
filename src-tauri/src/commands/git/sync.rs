use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use tauri::ipc::Channel;
use tauri::{AppHandle, Manager};

use crate::commands::blocking;
use crate::config;
use crate::domain::error::{AppError, AppErrorDto};
use crate::domain::sync::{SyncProgressDto, SyncStatus};
use crate::repositories::git2_backend::Git2Backend;
use crate::services::retry::{RetryAttempt, RetryContext};
use crate::services::{auth_service, sync_service};

/// 进行中的同步自动重试取消标志。
/// 只结束退避等待，不中断已经发出的网络请求；同一时刻只保留最后一个同步任务。
#[derive(Default)]
pub struct SyncRetryState(Mutex<Option<Arc<AtomicBool>>>);

impl SyncRetryState {
    fn set(&self, flag: Option<Arc<AtomicBool>>) -> Result<(), AppError> {
        let mut guard = self
            .0
            .lock()
            .map_err(|_| AppError::Io("同步状态锁不可用".into()))?;
        *guard = flag;
        Ok(())
    }

    fn current(&self) -> Option<Arc<AtomicBool>> {
        self.0.lock().ok().and_then(|guard| guard.clone())
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
    let cancel = Arc::new(AtomicBool::new(false));
    app.state::<SyncRetryState>()
        .set(Some(cancel.clone()))
        .map_err(AppErrorDto::from)?;

    let result = blocking::run(move || {
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

    let _ = app.state::<SyncRetryState>().set(None);
    result.map_err(AppErrorDto::from)
}

/// Controller：取消进行中的同步自动重试；无任务时静默成功。
#[tauri::command]
pub fn cancel_sync_retry(app: AppHandle) -> Result<(), AppErrorDto> {
    if let Some(flag) = app.state::<SyncRetryState>().current() {
        flag.store(true, Ordering::SeqCst);
    }
    Ok(())
}

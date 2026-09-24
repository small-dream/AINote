//! 移动端应用内更新：下载 APK（Channel 进度 + 可取消）、校验后调起系统安装器。

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use tauri::ipc::Channel;
use tauri::{AppHandle, Manager};

use crate::commands::blocking;
use crate::domain::error::{AppError, AppErrorDto};
use crate::domain::update::{ApkDownloadDto, InstallApkDto, UpdateDownloadProgressDto};
use crate::platform;
use crate::services::update_service;

/// 当前进行中的下载取消标志；同时只允许一个下载任务（与 BackupState 同模式）。
/// 必须走 acquire/release：无条件覆盖会让并发下载共享同一 updates 目录时互相
/// 删 .part 文件、并清掉对方的取消标志。
#[derive(Default)]
pub struct UpdateDownloadState(Mutex<Option<Arc<AtomicBool>>>);

impl UpdateDownloadState {
    /// 抢占下载槽位并返回取消标志；已有下载进行中时拒绝重入（UPDATE_7004）。
    ///
    /// 上一任务已被取消时放行：取消是异步的，旧任务可能仍卡在不可中断的连接 / 读取里，
    /// 不该继续占着槽位让用户点了取消就重下不了（临时文件名带任务序号，两者互不干扰）。
    fn acquire(&self) -> Result<Arc<AtomicBool>, AppError> {
        let mut guard = self
            .0
            .lock()
            .map_err(|_| AppError::Io("更新下载状态锁不可用".into()))?;
        if let Some(current) = guard.as_ref() {
            if !current.load(Ordering::SeqCst) {
                return Err(AppError::UpdateBusy("已有下载任务进行中，请稍后再试".into()));
            }
        }
        let flag = Arc::new(AtomicBool::new(false));
        *guard = Some(flag.clone());
        Ok(flag)
    }

    /// 任务结束释放槽位：只有槽位里仍是自己的 flag 才清理，
    /// 避免先完成者把仍在下载任务的取消标志清掉（取消后重下的新任务同样受此保护）。
    fn release(&self, flag: &Arc<AtomicBool>) {
        if let Ok(mut guard) = self.0.lock() {
            if guard.as_ref().is_some_and(|current| Arc::ptr_eq(current, flag)) {
                *guard = None;
            }
        }
    }

    fn current(&self) -> Option<Arc<AtomicBool>> {
        self.0.lock().ok().and_then(|guard| guard.clone())
    }
}

/// Controller：下载并校验新版本 APK；用户中途取消返回 `None`，不视为错误。
#[tauri::command]
pub async fn download_update(
    app: AppHandle,
    url: String,
    sha256_url: String,
    version: String,
    on_event: Channel<UpdateDownloadProgressDto>,
) -> Result<Option<ApkDownloadDto>, AppErrorDto> {
    let dir = app
        .path()
        .app_cache_dir()
        .map_err(|err| AppError::Io(err.to_string()))?
        .join("updates");

    let cancel = app
        .state::<UpdateDownloadState>()
        .acquire()
        .map_err(AppErrorDto::from)?;
    let slot = cancel.clone();

    let result = blocking::run(move || {
        update_service::download_apk(&url, &sha256_url, &version, &dir, &cancel, |progress| {
            let _ = on_event.send(progress);
        })
    })
    .await
    .map_err(AppErrorDto::from);

    app.state::<UpdateDownloadState>().release(&slot);
    result.map(|done| {
        done.map(|path| ApkDownloadDto {
            path: path.to_string_lossy().into_owned(),
        })
    })
}

/// Controller：请求取消进行中的下载；无任务时静默成功。
#[tauri::command]
pub fn cancel_update_download(app: AppHandle) -> Result<(), AppErrorDto> {
    if let Some(flag) = app.state::<UpdateDownloadState>().current() {
        flag.store(true, Ordering::SeqCst);
    }
    Ok(())
}

/// Controller：调起系统安装器；无安装权限时先打开授权设置页并返回 `needs_permission: true`。
#[tauri::command]
pub fn install_update(app: AppHandle, path: String) -> Result<InstallApkDto, AppErrorDto> {
    let dir = app
        .path()
        .app_cache_dir()
        .map_err(|err| AppError::Io(err.to_string()))?
        .join("updates");
    if !update_service::install_path_allowed(&dir, std::path::Path::new(&path)) {
        return Err(AppError::UpdateInstall("安装路径不合法".into()).into());
    }
    if platform::can_request_installs().map_err(AppErrorDto::from)? {
        platform::install_apk(&path).map_err(AppErrorDto::from)?;
        Ok(InstallApkDto {
            needs_permission: false,
        })
    } else {
        platform::open_install_settings().map_err(AppErrorDto::from)?;
        Ok(InstallApkDto {
            needs_permission: true,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn acquire_rejects_reentry_and_release_frees_slot() {
        let state = UpdateDownloadState::default();
        let first = state.acquire().unwrap();
        let err = state.acquire().unwrap_err();
        assert!(matches!(err, AppError::UpdateBusy(_)), "下载中重入被拒");
        let dto = AppErrorDto::from(err);
        assert_eq!(dto.code, "UPDATE_7004");
        state.release(&first);
        assert!(state.acquire().is_ok(), "释放后可再次下载");
    }

    #[test]
    fn release_only_clears_own_flag() {
        let state = UpdateDownloadState::default();
        let current = state.acquire().unwrap();
        let stale = Arc::new(AtomicBool::new(false));
        state.release(&stale);
        assert!(state.acquire().is_err(), "别人的 flag 不得清理槽位");
        assert!(state.current().is_some_and(|f| Arc::ptr_eq(&f, &current)),
            "取消标志仍归属当前任务");
        state.release(&current);
        assert!(state.current().is_none());
    }

    /// 取消是异步的：旧任务可能仍卡在阻塞读写里，此时用户重下必须能拿到槽位。
    #[test]
    fn acquire_allows_reentry_after_cancel() {
        let state = UpdateDownloadState::default();
        let cancelled = state.acquire().unwrap();
        cancelled.store(true, Ordering::SeqCst);

        let restarted = state.acquire().expect("取消后重下应放行");
        assert!(state.current().is_some_and(|f| Arc::ptr_eq(&f, &restarted)));

        // 旧任务收尾不得清掉新任务的槽位，新任务自己收尾才释放
        state.release(&cancelled);
        assert!(state.current().is_some_and(|f| Arc::ptr_eq(&f, &restarted)));
        state.release(&restarted);
        assert!(state.current().is_none());
    }
}

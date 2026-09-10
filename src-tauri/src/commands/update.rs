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
#[derive(Default)]
pub struct UpdateDownloadState(Mutex<Option<Arc<AtomicBool>>>);

impl UpdateDownloadState {
    fn set(&self, flag: Option<Arc<AtomicBool>>) -> Result<(), AppError> {
        let mut guard = self
            .0
            .lock()
            .map_err(|_| AppError::Io("更新下载状态锁不可用".into()))?;
        *guard = flag;
        Ok(())
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

    let cancel = Arc::new(AtomicBool::new(false));
    app.state::<UpdateDownloadState>()
        .set(Some(cancel.clone()))
        .map_err(AppErrorDto::from)?;

    let result = blocking::run(move || {
        update_service::download_apk(&url, &sha256_url, &version, &dir, &cancel, |progress| {
            let _ = on_event.send(progress);
        })
    })
    .await
    .map_err(AppErrorDto::from);

    let _ = app.state::<UpdateDownloadState>().set(None);
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

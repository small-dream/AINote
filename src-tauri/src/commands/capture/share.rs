use std::path::PathBuf;

use tauri::{AppHandle, Manager};

use crate::commands::blocking;
use crate::domain::capture::SharedCaptureDto;
use crate::domain::error::{AppError, AppErrorDto};
use crate::services::capture_service;

fn share_dir(app: &AppHandle) -> Result<PathBuf, AppError> {
    app.path()
        .app_cache_dir()
        .map(|dir| dir.join("ainote-share"))
        .map_err(|err| AppError::Io(err.to_string()))
}

/// Controller：读取 Android 系统分享留下的最旧一条 intake（不消费，应用崩溃后可恢复）。
#[tauri::command]
pub async fn capture_pending_share(
    app: AppHandle,
) -> Result<Option<SharedCaptureDto>, AppErrorDto> {
    let dir = share_dir(&app)?;
    blocking::run(move || capture_service::pending_share(&dir))
        .await
        .map_err(AppErrorDto::from)
}

/// Controller：用户保存或取消后清理 intake 与临时图片。
#[tauri::command]
pub async fn capture_ack_share(app: AppHandle, intake_id: String) -> Result<(), AppErrorDto> {
    let dir = share_dir(&app)?;
    blocking::run(move || capture_service::ack_share(&dir, &intake_id))
        .await
        .map_err(AppErrorDto::from)
}

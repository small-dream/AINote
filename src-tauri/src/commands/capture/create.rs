use std::path::PathBuf;

use tauri::{AppHandle, Manager};

use crate::commands::blocking;
use crate::config;
use crate::domain::capture::CaptureInputDto;
use crate::domain::error::{AppError, AppErrorDto};
use crate::domain::note::NoteMeta;
use crate::services::capture_service;

fn share_dir(app: &AppHandle) -> Result<PathBuf, AppError> {
    app.path()
        .app_cache_dir()
        .map(|dir| dir.join("ainote-share"))
        .map_err(|err| AppError::Io(err.to_string()))
}

/// Controller：把捕获内容写入 inbox/（纯本地操作，离线可用）。
#[tauri::command]
pub async fn capture_create(
    app: AppHandle,
    input: CaptureInputDto,
) -> Result<NoteMeta, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    let dir = share_dir(&app)?;
    let meta = blocking::run(move || capture_service::create(&root, input, &dir))
        .await
        .map_err(AppErrorDto::from)?;
    crate::services::metrics_service::record_best_effort(
        &app,
        crate::domain::metrics::MetricEvent::NoteCreated,
    );
    Ok(meta)
}

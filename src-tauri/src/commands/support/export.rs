use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;

use crate::commands::blocking;
use crate::config;
use crate::domain::diagnostics::DiagnosticsExportDto;
use crate::domain::error::{AppError, AppErrorDto};
use crate::repositories::git2_backend::Git2Backend;
use crate::repositories::repo_size;
use crate::services::{diagnostics_service, sync_service};

/// Controller：弹出保存对话框并把诊断包写入用户选择的位置。
/// 用户取消时返回 `None`，不视为错误。
#[tauri::command]
pub async fn export_diagnostics(
    app: AppHandle,
) -> Result<Option<DiagnosticsExportDto>, AppErrorDto> {
    let repo_path = config::load_repo_path(&app)?;
    let config_summary = config::summary(&app)?;
    let log_dir = app
        .path()
        .app_log_dir()
        .map_err(|err| AppError::Io(err.to_string()))?;

    let Some(dest) = choose_destination(app).await? else {
        return Ok(None);
    };

    let result = blocking::run(move || {
        let backend = Git2Backend;
        let sync = repo_path
            .as_deref()
            .and_then(|path| sync_service::status(&backend, Path::new(path)).ok());
        let repo_size_bytes = repo_path
            .as_deref()
            .and_then(|path| repo_size::repo_size(Path::new(path)).ok());
        let input = diagnostics_service::DiagnosticsInput {
            config: config_summary,
            sync,
            repo_size_bytes,
            log_text: diagnostics_service::read_recent_logs(&log_dir),
        };
        diagnostics_service::export(&dest, input)
    })
    .await
    .map_err(AppErrorDto::from)?;

    Ok(Some(result))
}

async fn choose_destination(app: AppHandle) -> Result<Option<PathBuf>, AppErrorDto> {
    blocking::run(move || {
        let file_name = format!("ainote-diagnostics-{}.zip", env!("CARGO_PKG_VERSION"));
        app.dialog()
            .file()
            .set_file_name(file_name)
            .add_filter("ZIP", &["zip"])
            .blocking_save_file()
            .map(|file| file.into_path())
            .transpose()
            .map_err(|err| AppError::Io(err.to_string()))
    })
    .await
    .map_err(AppErrorDto::from)
}

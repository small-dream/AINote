use std::path::PathBuf;

use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

use crate::commands::blocking;
use crate::config;
use crate::domain::backup::RestoreResultDto;
use crate::domain::error::{AppError, AppErrorDto};
use crate::services::restore_service;

/// Controller：从备份包恢复仓库到 notes 目录，并注册为活动仓库。
/// 用户取消选择文件时返回 `None`，不视为错误。
#[tauri::command]
pub async fn restore_repo_backup(app: AppHandle) -> Result<Option<RestoreResultDto>, AppErrorDto> {
    let notes = config::notes_dir(&app)?;
    let Some(source) = choose_source(app.clone()).await? else {
        return Ok(None);
    };

    let result = blocking::run(move || restore_service::restore(&source, &notes))
        .await
        .map_err(|err| {
            log::error!(target: "ainote::repo", "从备份恢复失败 error={err}");
            AppErrorDto::from(err)
        })?;

    let id = config::repos::register(&app, &result.name, &result.repo_path, None)?;
    config::repos::switch_to(&app, &id)?;
    log::info!(
        target: "ainote::repo",
        "从备份恢复完成 name={} files={}",
        result.name,
        result.file_count
    );
    Ok(Some(result))
}

async fn choose_source(app: AppHandle) -> Result<Option<PathBuf>, AppErrorDto> {
    blocking::run(move || {
        app.dialog()
            .file()
            .add_filter("ZIP", &["zip"])
            .blocking_pick_file()
            .map(|file| file.into_path())
            .transpose()
            .map_err(|err| AppError::Io(err.to_string()))
    })
    .await
    .map_err(AppErrorDto::from)
}

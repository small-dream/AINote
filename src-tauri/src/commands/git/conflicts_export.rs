use std::path::{Path, PathBuf};

use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::{AppError, AppErrorDto};
use crate::domain::sync::ConflictExportDto;
use crate::repositories::diagnostics_files;
use crate::repositories::git2_backend::Git2Backend;
use crate::services::{conflict_export_service, sync_service};

/// Controller：把当前全部冲突文件的本地 / 远端两侧导出为 zip 兜底（E3-T5）。
/// 用户取消保存时返回 `None`，不视为错误。
#[tauri::command]
pub async fn export_conflicts(app: AppHandle) -> Result<Option<ConflictExportDto>, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    let Some(dest) = choose_destination(app, &root).await? else {
        return Ok(None);
    };

    let result = blocking::run(move || {
        let backend = Git2Backend;
        let conflicts = sync_service::list_conflicts(&backend, &root)?;
        if conflicts.is_empty() {
            return Err(AppError::Conflict("当前没有待处理的冲突文件".into()));
        }
        let entries = conflict_export_service::build_entries(&conflicts)?;
        let files = entries.iter().map(|entry| entry.name.clone()).collect();
        let bytes = diagnostics_files::write_zip(&dest, &entries)?;
        Ok(ConflictExportDto {
            path: dest.to_string_lossy().into_owned(),
            bytes,
            files,
        })
    })
    .await
    .map_err(AppErrorDto::from)?;

    Ok(Some(result))
}

async fn choose_destination(app: AppHandle, root: &Path) -> Result<Option<PathBuf>, AppErrorDto> {
    let file_name = format!("ainote-conflicts-{}.zip", repo_name(root));
    blocking::run(move || {
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

fn repo_name(root: &Path) -> String {
    root.file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| "notes".into())
}

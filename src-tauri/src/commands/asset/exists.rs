use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::services::asset_service;

/// Controller：批量检查仓库相对路径是否指向存在的文件（Markdown 图片断链诊断）。
#[tauri::command]
pub async fn asset_exists(app: AppHandle, paths: Vec<String>) -> Result<Vec<bool>, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    blocking::run(move || Ok(asset_service::asset_exists(&root, &paths)))
        .await
        .map_err(AppErrorDto::from)
}

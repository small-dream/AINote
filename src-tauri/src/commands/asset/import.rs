use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::asset::AssetInfo;
use crate::domain::error::AppErrorDto;
use crate::services::asset_service;

/// Controller：从本地路径导入资产到仓库 `assets/`（拖放文件）。
#[tauri::command]
pub async fn import_asset(app: AppHandle, source_path: String) -> Result<AssetInfo, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    blocking::run(move || asset_service::import_asset(&root, &source_path))
        .await
        .map_err(AppErrorDto::from)
}

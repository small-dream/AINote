use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::asset::AssetInfo;
use crate::domain::error::AppErrorDto;
use crate::services::asset_service;

/// Controller：从内存字节导入资产（粘贴图片）。
#[tauri::command]
pub async fn import_asset_bytes(
    app: AppHandle,
    bytes: Vec<u8>,
    file_name: String,
) -> Result<AssetInfo, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    blocking::run(move || asset_service::import_asset_bytes(&root, &bytes, &file_name))
        .await
        .map_err(AppErrorDto::from)
}

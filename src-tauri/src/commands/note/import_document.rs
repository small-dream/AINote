use serde::Deserialize;
use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::domain::note::NoteMeta;
use crate::services::document_import_service::{self, DocumentAsset};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentAssetInput {
    file_name: String,
    bytes: Vec<u8>,
}

/// Controller：导入已由前端转换好的 Word/PDF 正文与内嵌图片。
#[tauri::command]
pub async fn import_document(
    app: AppHandle,
    dir: String,
    file_name: String,
    content: String,
    assets: Vec<DocumentAssetInput>,
) -> Result<NoteMeta, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    let assets: Vec<DocumentAsset> = assets
        .into_iter()
        .map(|asset| DocumentAsset { file_name: asset.file_name, bytes: asset.bytes })
        .collect();
    blocking::run(move || {
        document_import_service::import_document(&root, &dir, &file_name, &content, &assets)
    })
    .await
    .map_err(AppErrorDto::from)
}

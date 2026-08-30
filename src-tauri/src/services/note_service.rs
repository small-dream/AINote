use std::path::Path;

use crate::domain::error::AppError;
use crate::domain::note::NoteMeta;
use crate::repositories::file_storage;

/// 用例：列出仓库内全部笔记的元数据
pub fn list_notes(repo_path: &Path) -> Result<Vec<NoteMeta>, AppError> {
    let files = file_storage::collect_markdown_files(repo_path)?;
    files.iter().map(|f| to_meta(repo_path, f)).collect()
}

fn to_meta(root: &Path, file: &Path) -> Result<NoteMeta, AppError> {
    let rel = file
        .strip_prefix(root)
        .map_err(|e| AppError::Io(e.to_string()))?;
    let title = file
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_default();
    let updated_at = file
        .metadata()?
        .modified()?
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    Ok(NoteMeta {
        path: rel.to_string_lossy().into_owned(),
        title,
        updated_at,
    })
}

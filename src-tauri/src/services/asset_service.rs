use std::path::Path;

use crate::domain::asset::AssetInfo;
use crate::domain::error::AppError;
use crate::repositories::{asset_files, note_files};

const MAX_ASSET_BYTES: u64 = 20 * 1024 * 1024;

/// 用例：从本地路径导入资产到仓库 `assets/`（拖放文件）。
pub fn import_asset(repo_path: &Path, source_path: &str) -> Result<AssetInfo, AppError> {
    let source = Path::new(source_path);
    if !source.is_file() {
        return Err(AppError::InvalidPath(format!("asset not found: {source_path}")));
    }
    let size = source.metadata()?.len();
    if size > MAX_ASSET_BYTES {
        return Err(AppError::InvalidPath(format!("asset too large: {size} bytes")));
    }
    asset_files::import_from_path(repo_path, source)
}

/// 用例：从内存字节导入资产（粘贴图片等）。
pub fn import_asset_bytes(
    repo_path: &Path,
    bytes: &[u8],
    file_name: &str,
) -> Result<AssetInfo, AppError> {
    if bytes.is_empty() || bytes.len() as u64 > MAX_ASSET_BYTES {
        return Err(AppError::InvalidPath(format!(
            "invalid asset bytes: {}",
            bytes.len()
        )));
    }
    if file_name.trim().is_empty() {
        return Err(AppError::InvalidPath("empty file name".into()));
    }
    asset_files::import_bytes(repo_path, bytes, file_name)
}

/// 用例：批量检查仓库相对路径指向的文件是否存在（Markdown 图片断链诊断）。
/// 非法路径（穿越/绝对路径）一律视为不存在，不返回错误。
pub fn asset_exists(repo_path: &Path, paths: &[String]) -> Vec<bool> {
    paths
        .iter()
        .map(|rel| match note_files::validate_rel_path(rel) {
            Ok(rel_path) => repo_path.join(rel_path).is_file(),
            Err(_) => false,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn import_asset_copies_existing_file() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path();
        let src = root.join("photo.jpg");
        fs::write(&src, b"jpeg").unwrap();
        let info = import_asset(root, src.to_str().unwrap()).unwrap();
        assert_eq!(info.path, "assets/photo.jpg");
    }

    #[test]
    fn import_asset_rejects_missing_or_oversized() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path();
        assert!(matches!(
            import_asset(root, "/nonexistent/x.png"),
            Err(AppError::InvalidPath(_))
        ));
        let big = root.join("big.bin");
        fs::write(&big, vec![0u8; (MAX_ASSET_BYTES + 1) as usize]).unwrap();
        assert!(matches!(
            import_asset(root, big.to_str().unwrap()),
            Err(AppError::InvalidPath(_))
        ));
    }

    #[test]
    fn import_bytes_validates_empty_and_name() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path();
        assert!(matches!(
            import_asset_bytes(root, &[], "a.png"),
            Err(AppError::InvalidPath(_))
        ));
        assert!(matches!(
            import_asset_bytes(root, &[1, 2], "   "),
            Err(AppError::InvalidPath(_))
        ));
        let info = import_asset_bytes(root, &[1, 2, 3], "paste.png").unwrap();
        assert_eq!(info.path, "assets/paste.png");
    }

    #[test]
    fn asset_exists_checks_files_and_rejects_traversal() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path();
        fs::create_dir_all(root.join("assets")).unwrap();
        fs::write(root.join("assets/pic.png"), b"png").unwrap();
        assert_eq!(
            asset_exists(root, &["assets/pic.png".into(), "assets/missing.png".into(), "../etc/passwd".into()]),
            vec![true, false, false]
        );
    }
}

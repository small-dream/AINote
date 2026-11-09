use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

use crate::domain::error::AppError;
use crate::domain::note::NoteMeta;
use crate::repositories::{asset_files, note_files};
use crate::services::{asset_service, note_content, note_service};

const MAX_DOCUMENT_ASSETS: usize = 100;
const MAX_TOTAL_ASSET_BYTES: usize = 80 * 1024 * 1024;
const ASSET_MARKER: &str = "ainote-asset://";

#[derive(Debug, Clone)]
pub struct DocumentAsset {
    pub file_name: String,
    pub bytes: Vec<u8>,
}

fn validate_assets(assets: &[DocumentAsset]) -> Result<(), AppError> {
    if assets.len() > MAX_DOCUMENT_ASSETS {
        return Err(AppError::InvalidPath("too many document assets".into()));
    }
    let mut total = 0usize;
    for asset in assets {
        if asset.bytes.is_empty() || asset.bytes.len() as u64 > asset_service::MAX_ASSET_BYTES {
            return Err(AppError::InvalidPath(format!(
                "invalid document asset: {}",
                asset.file_name
            )));
        }
        total = total.saturating_add(asset.bytes.len());
        if total > MAX_TOTAL_ASSET_BYTES {
            return Err(AppError::InvalidPath(
                "document assets are too large".into(),
            ));
        }
    }
    Ok(())
}

fn write_asset_new(root: &Path, file_name: &str, bytes: &[u8]) -> Result<PathBuf, AppError> {
    let dir = note_files::resolve_within_root(root, Path::new("assets"))?;
    fs::create_dir_all(&dir).map_err(|err| AppError::io_context("创建资产目录失败", &dir, err))?;
    let name = asset_files::sanitize_file_name(file_name);
    for _ in 0..MAX_DOCUMENT_ASSETS {
        let target = asset_files::unique_asset_path(root, &name);
        match OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&target)
        {
            Ok(mut file) => {
                if let Err(err) = file.write_all(bytes) {
                    drop(file);
                    let _ = fs::remove_file(&target);
                    return Err(AppError::io_context("写入资产失败", &target, err));
                }
                return Ok(target);
            }
            Err(err) if err.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(err) => return Err(AppError::io_context("创建资产失败", &target, err)),
        }
    }
    Err(AppError::Io("could not allocate an asset path".into()))
}

fn rollback(paths: &[PathBuf]) {
    for path in paths {
        if let Err(err) = fs::remove_file(path) {
            log::warn!(target: "ainote::import", "回滚导入资产失败 path={} error={err}", path.display());
        }
    }
}

fn cleanup_created_note(created: bool, path: &Path) {
    if !created {
        return;
    }
    if let Err(err) = fs::remove_file(path) {
        if err.kind() != std::io::ErrorKind::NotFound {
            log::warn!(target: "ainote::import", "回滚导入笔记失败 path={} error={err}", path.display());
        }
    }
}

/// 只替换完整占位符，避免 `ainote-asset://1` 误伤 `ainote-asset://10`。
fn replace_asset_marker(markdown: &mut String, marker: &str, replacement: &str) {
    let mut output = String::with_capacity(markdown.len());
    let mut rest = markdown.as_str();
    while let Some(position) = rest.find(marker) {
        output.push_str(&rest[..position]);
        let after = &rest[position + marker.len()..];
        if after.as_bytes().first().is_some_and(u8::is_ascii_digit) {
            output.push_str(marker);
        } else {
            output.push_str(replacement);
        }
        rest = after;
    }
    output.push_str(rest);
    *markdown = output;
}

/// 用例：把前端转换好的 Markdown 与内嵌图片原子写入仓库。
/// 图片先落盘，笔记最后写入；任何一步失败都删除本次创建的资产，避免孤立文件。
pub fn import_document(
    repo_path: &Path,
    dir: &str,
    file_name: &str,
    content: &str,
    assets: &[DocumentAsset],
) -> Result<NoteMeta, AppError> {
    if content.trim().is_empty() {
        return Err(AppError::InvalidPath("empty document content".into()));
    }
    validate_assets(assets)?;
    let rel = note_files::unique_note_path(repo_path, dir, file_name)?;
    let note_path = repo_path.join(&rel);
    let mut created_assets = Vec::new();
    let mut created_note = false;
    let mut markdown = content.to_string();

    let result = (|| -> Result<NoteMeta, AppError> {
        for (index, asset) in assets.iter().enumerate() {
            let marker = format!("{ASSET_MARKER}{index}");
            if !markdown.contains(&marker) {
                continue;
            }
            let path = write_asset_new(repo_path, &asset.file_name, &asset.bytes)?;
            let relative = path
                .strip_prefix(repo_path)
                .map(crate::domain::path::to_slash)
                .map_err(|error| AppError::Io(error.to_string()))?;
            created_assets.push(path);
            replace_asset_marker(&mut markdown, &marker, &relative);
        }
        if markdown.contains(ASSET_MARKER) {
            return Err(AppError::InvalidPath(
                "missing document asset content".into(),
            ));
        }
        note_content::write_text_new(repo_path, &rel, &markdown)?;
        created_note = true;
        note_service::to_meta(repo_path, &note_path)
    })();

    if result.is_err() {
        rollback(&created_assets);
        cleanup_created_note(created_note, &note_path);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    fn asset(name: &str, bytes: &[u8]) -> DocumentAsset {
        DocumentAsset {
            file_name: name.into(),
            bytes: bytes.to_vec(),
        }
    }

    #[test]
    fn writes_note_and_replaces_asset_markers() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path();
        let content = "before\n\n![图](ainote-asset://0)\n\nafter";
        let meta = import_document(
            root,
            "docs",
            "报告.docx",
            content,
            &[asset("image-1.png", b"png")],
        )
        .unwrap();
        assert_eq!(meta.path, "docs/报告.md");
        let saved = fs::read_to_string(root.join("docs/报告.md")).unwrap();
        assert_eq!(saved, "before\n\n![图](assets/image-1.png)\n\nafter");
        assert_eq!(fs::read(root.join("assets/image-1.png")).unwrap(), b"png");
    }

    #[test]
    fn skips_unreferenced_assets_and_avoids_name_collisions() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path();
        fs::create_dir_all(root.join("assets")).unwrap();
        fs::write(root.join("assets/image-1.png"), b"old").unwrap();
        let meta = import_document(
            root,
            "",
            "a.pdf",
            "![x](ainote-asset://0)",
            &[asset("image-1.png", b"new"), asset("unused.png", b"u")],
        )
        .unwrap();
        assert_eq!(meta.path, "a.md");
        assert_eq!(fs::read(root.join("assets/image-1-1.png")).unwrap(), b"new");
        assert!(!root.join("assets/unused.png").exists());
    }

    #[test]
    fn rejects_missing_marker_and_invalid_assets() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path();
        assert!(import_document(
            root,
            "",
            "a.docx",
            "![x](ainote-asset://5)",
            &[asset("x.png", b"x")]
        )
        .is_err());
        assert!(import_document(
            root,
            "",
            "a.docx",
            "ainote-asset://0",
            &[asset("x.png", b"")]
        )
        .is_err());
        assert!(import_document(root, "", "a.docx", "   ", &[]).is_err());
        assert!(import_document(root, "../evil", "a.docx", "body", &[]).is_err());
    }

    #[test]
    fn rolls_back_assets_when_note_write_fails() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path();
        fs::write(root.join("blocked"), b"file").unwrap();
        let result = import_document(
            root,
            "blocked",
            "a.docx",
            "![x](ainote-asset://0)",
            &[asset("x.png", b"x")],
        );
        assert!(result.is_err());
        assert!(
            !root.join("assets/x.png").exists(),
            "note failure must remove imported assets"
        );
    }

    #[test]
    fn only_rolls_back_the_note_created_by_this_import() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path().join("existing.md");
        fs::write(&path, "other import").unwrap();

        cleanup_created_note(false, &path);
        assert_eq!(fs::read_to_string(&path).unwrap(), "other import");

        cleanup_created_note(true, &path);
        assert!(!path.exists());
    }

    #[test]
    fn replaces_exact_markers_without_touching_longer_indexes() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path();
        let assets = (0..11)
            .map(|index| asset(&format!("x-{index}.png"), b"x"))
            .collect::<Vec<_>>();
        let content = "![a](ainote-asset://1)\n\n![b](ainote-asset://10)";
        let meta = import_document(root, "", "a.docx", content, &assets).unwrap();
        let saved = fs::read_to_string(root.join(&meta.path)).unwrap();
        assert_eq!(saved, "![a](assets/x-1.png)\n\n![b](assets/x-10.png)");
        assert!(root.join("assets/x-10.png").is_file());
        assert!(!root.join("assets/x-10.png0").exists());
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symlinked_asset_directory_escaping_root() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path();
        let outside = tempfile::tempdir().unwrap();
        std::os::unix::fs::symlink(outside.path(), root.join("assets")).unwrap();
        let result = import_document(
            root,
            "",
            "a.docx",
            "![x](ainote-asset://0)",
            &[asset("x.png", b"x")],
        );
        assert!(result.is_err());
        assert!(
            !outside.path().join("x.png").exists(),
            "不得写到仓库外的 assets 目录"
        );
    }
}

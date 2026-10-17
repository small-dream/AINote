use std::fs;
use std::path::Path;

use crate::domain::capture::{CaptureInputDto, SharedCaptureDto};
use crate::domain::error::AppError;
use crate::domain::note::{NoteKind, NoteMeta};
use crate::services::capture_content::{
    capture_markdown, capture_title, markdown_alt, unique_capture_path,
};
use crate::services::{asset_service, note_service};

pub const DEFAULT_CAPTURE_SHORTCUT: &str = "CommandOrControl+Shift+Space";

/// 写入一篇独立收件箱笔记。图片来自 Android 分享 intake 时，先复制到仓库 assets/。
pub fn create(root: &Path, input: CaptureInputDto, share_dir: &Path) -> Result<NoteMeta, AppError> {
    let shared = match input.share_intake_id.as_deref() {
        Some(id) => Some(load_share(share_dir, id)?),
        None => None,
    };
    let image_markdown = match shared.as_ref() {
        Some(item) => import_shared_image(root, share_dir, item)?,
        None => None,
    };
    let title = capture_title(&input.text, image_markdown.is_some(), input.link.as_deref());
    let content = capture_markdown(&title, &input, image_markdown.as_deref());
    let path = unique_capture_path(root, &title);
    let meta = match note_service::create_note(root, &path, NoteKind::Markdown, Some(&content)) {
        Ok(meta) => meta,
        Err(error) => {
            // 笔记写失败时不留下本次刚导入的孤儿资产。
            if let Some(markdown) = image_markdown.as_deref() {
                remove_imported_asset(root, markdown);
            }
            return Err(error);
        }
    };
    if let Some(item) = shared {
        let _ = ack_share(share_dir, &item.id);
    }
    Ok(meta)
}

/// 原子写入由 Android 分享 intake 提供的临时文件；Rust 侧只接受 cache 目录内 JSON。
pub fn pending_share(share_dir: &Path) -> Result<Option<SharedCaptureDto>, AppError> {
    let entries = match fs::read_dir(share_dir) {
        Ok(entries) => entries,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(err) => return Err(AppError::io_context("读取分享目录失败", share_dir, err)),
    };
    let mut manifests = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|v| v.to_str()) == Some("json") {
            manifests.push(path);
        }
    }
    manifests.sort();
    for path in manifests {
        let Ok(raw) = fs::read_to_string(&path) else {
            continue;
        };
        let Ok(item) = serde_json::from_str::<SharedCaptureDto>(&raw) else {
            continue;
        };
        if safe_id(&item.id) {
            return Ok(Some(item));
        }
    }
    Ok(None)
}

/// 用户确认保存或明确取消后清理 intake 清单及其图片。
pub fn ack_share(share_dir: &Path, id: &str) -> Result<(), AppError> {
    if !safe_id(id) {
        return Err(AppError::Capture("分享标识无效".into()));
    }
    let manifest = share_dir.join(format!("{id}.json"));
    if let Ok(raw) = fs::read_to_string(&manifest) {
        if let Ok(item) = serde_json::from_str::<SharedCaptureDto>(&raw) {
            if let Some(image) = item.image_path.as_deref() {
                remove_if_inside(share_dir, Path::new(image));
            }
        }
    }
    if manifest.is_file() {
        fs::remove_file(&manifest)
            .map_err(|err| AppError::io_context("清理分享清单失败", &manifest, err))?;
    }
    Ok(())
}

fn load_share(share_dir: &Path, id: &str) -> Result<SharedCaptureDto, AppError> {
    if !safe_id(id) {
        return Err(AppError::Capture("分享标识无效".into()));
    }
    let path = share_dir.join(format!("{id}.json"));
    let raw = fs::read_to_string(&path)
        .map_err(|err| AppError::io_context("读取分享内容失败", &path, err))?;
    serde_json::from_str(&raw).map_err(|_| AppError::Capture("分享内容格式无效".into()))
}

fn import_shared_image(
    root: &Path,
    share_dir: &Path,
    item: &SharedCaptureDto,
) -> Result<Option<String>, AppError> {
    let Some(path) = item.image_path.as_deref() else {
        return Ok(None);
    };
    let source = Path::new(path);
    let canonical_root = fs::canonicalize(share_dir)?;
    let canonical = fs::canonicalize(source)
        .map_err(|err| AppError::io_context("读取分享图片失败", source, err))?;
    if !canonical.starts_with(canonical_root) {
        return Err(AppError::Capture("分享图片路径无效".into()));
    }
    let asset = asset_service::import_asset(root, path)?;
    let name = item.image_name.as_deref().unwrap_or("image");
    Ok(Some(format!("![{}]({})", markdown_alt(name), asset.path)))
}

fn remove_imported_asset(root: &Path, markdown: &str) {
    let Some(path) = markdown
        .rsplit_once("](")
        .and_then(|(_, rest)| rest.strip_suffix(')'))
    else {
        return;
    };
    let _ = fs::remove_file(root.join(path));
}

fn remove_if_inside(dir: &Path, file: &Path) {
    if let (Ok(dir), Ok(file)) = (fs::canonicalize(dir), fs::canonicalize(file)) {
        if file.starts_with(dir) {
            let _ = fs::remove_file(file);
        }
    }
}

fn safe_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 80 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn share_manifest_roundtrip_and_ack() {
        let tmp = tempfile::tempdir().unwrap();
        let image = tmp.path().join("photo.png");
        fs::write(&image, b"png").unwrap();
        let item = SharedCaptureDto {
            id: "abc-123".into(),
            text: "分享文字".into(),
            subject: None,
            image_path: Some(image.to_string_lossy().into_owned()),
            image_name: Some("photo.png".into()),
        };
        fs::write(
            tmp.path().join("abc-123.json"),
            serde_json::to_string(&item).unwrap(),
        )
        .unwrap();
        assert_eq!(pending_share(tmp.path()).unwrap().unwrap().id, "abc-123");
        ack_share(tmp.path(), "abc-123").unwrap();
        assert!(!tmp.path().join("abc-123.json").exists());
        assert!(!image.exists());
    }
}

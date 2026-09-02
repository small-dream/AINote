use std::fs;
use std::path::{Component, Path, PathBuf};

use crate::domain::error::AppError;
use crate::repositories::asset_files;

/// 仓库相对路径校验：拒绝空、绝对路径、`..`、以 `.` 开头的路径段（路径穿越防御）。
pub fn validate_rel_path(rel: &str) -> Result<PathBuf, AppError> {
    let invalid = || AppError::InvalidPath(rel.to_string());
    if rel.is_empty() || Path::new(rel).is_absolute() {
        return Err(invalid());
    }
    for component in Path::new(rel).components() {
        match component {
            Component::Normal(seg) if !seg.to_string_lossy().starts_with('.') => {}
            _ => return Err(invalid()),
        }
    }
    Ok(PathBuf::from(rel))
}

pub fn read_note(root: &Path, rel: &str) -> Result<String, AppError> {
    let path = root.join(validate_rel_path(rel)?);
    if !path.is_file() {
        return Err(AppError::NoteNotFound(rel.to_string()));
    }
    Ok(fs::read_to_string(path)?)
}

/// 写入笔记，自动创建父目录。
pub fn write_note(root: &Path, rel: &str, content: &str) -> Result<(), AppError> {
    let path = root.join(validate_rel_path(rel)?);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    Ok(fs::write(path, content)?)
}

/// 导入外部 Markdown 笔记：在当前目录生成不冲突的 `<stem>.md` 目标路径（只计算不写入）。
/// 文件名经规范化（复用资产文件名清理规则，兼容 CJK），扩展名统一归一化为 `.md`。
pub fn unique_note_path(root: &Path, dir: &str, file_name: &str) -> Result<String, AppError> {
    let dir = if dir.trim().is_empty() {
        PathBuf::new()
    } else {
        validate_rel_path(dir)?
    };
    let sanitized = asset_files::sanitize_file_name(file_name);
    let stem = Path::new(&sanitized)
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "imported".to_string());
    let mut candidate = dir.join(format!("{stem}.md"));
    let mut i = 1;
    while root.join(&candidate).exists() {
        candidate = dir.join(format!("{stem}-{i}.md"));
        i += 1;
    }
    Ok(candidate.to_string_lossy().into_owned())
}

pub fn move_note(root: &Path, from: &str, to: &str) -> Result<(), AppError> {
    let src = root.join(validate_rel_path(from)?);
    let dst = root.join(validate_rel_path(to)?);
    if !src.is_file() {
        return Err(AppError::NoteNotFound(from.to_string()));
    }
    if let Some(parent) = dst.parent() {
        fs::create_dir_all(parent)?;
    }
    Ok(fs::rename(src, dst)?)
}

/// 转换笔记类型：把旧路径内容替换为新扩展名文件后删除旧文件（内容已由前端转换好）。
pub fn convert_note(root: &Path, from: &str, to: &str, content: &str) -> Result<(), AppError> {
    let src = root.join(validate_rel_path(from)?);
    let dst = root.join(validate_rel_path(to)?);
    if !src.is_file() {
        return Err(AppError::NoteNotFound(from.to_string()));
    }
    if let Some(parent) = dst.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(&dst, content)?;
    fs::remove_file(&src)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup() -> (tempfile::TempDir, PathBuf) {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path().to_path_buf();
        (tmp, root)
    }

    #[test]
    fn rejects_traversal_and_hidden_segments() {
        for bad in [
            "../a.md",
            "/abs/a.md",
            "a/../b.md",
            ".hidden/a.md",
            "a/.b.md",
            "",
        ] {
            assert!(validate_rel_path(bad).is_err(), "should reject: {bad}");
        }
        assert!(validate_rel_path("daily/2026-08-30.md").is_ok());
    }

    #[test]
    fn write_read_roundtrip_creates_parents() {
        let (_t, root) = setup();
        write_note(&root, "a/b.md", "# hi").unwrap();
        assert_eq!(read_note(&root, "a/b.md").unwrap(), "# hi");
    }

    #[test]
    fn read_missing_returns_not_found() {
        let (_t, root) = setup();
        assert!(matches!(
            read_note(&root, "nope.md"),
            Err(AppError::NoteNotFound(_))
        ));
    }

    #[test]
    fn move_roundtrip_moves_file_between_folders() {
        let (_t, root) = setup();
        write_note(&root, "old.md", "x").unwrap();
        move_note(&root, "old.md", "sub/new.md").unwrap();
        assert_eq!(read_note(&root, "sub/new.md").unwrap(), "x");
        assert!(read_note(&root, "old.md").is_err());
    }

    #[test]
    fn convert_replaces_content_and_removes_source() {
        let (_t, root) = setup();
        write_note(&root, "a.md", "# 旧内容").unwrap();
        convert_note(&root, "a.md", "a.ainote", "{\"type\":\"doc\"}").unwrap();
        assert_eq!(read_note(&root, "a.ainote").unwrap(), "{\"type\":\"doc\"}");
        assert!(read_note(&root, "a.md").is_err());
    }

    #[test]
    fn convert_missing_source_returns_not_found() {
        let (_t, root) = setup();
        assert!(matches!(
            convert_note(&root, "nope.md", "nope.ainote", "{}"),
            Err(AppError::NoteNotFound(_))
        ));
    }

    #[test]
    fn unique_note_path_normalizes_and_avoids_collisions() {
        let (_t, root) = setup();
        write_note(&root, "a.md", "# a").unwrap();
        write_note(&root, "a-1.md", "# a1").unwrap();
        assert_eq!(unique_note_path(&root, "", "a.md").unwrap(), "a-2.md");
        // `.markdown` 统一归一化为 `.md`，并写入子目录
        assert_eq!(
            unique_note_path(&root, "sub", "notes.markdown").unwrap(),
            "sub/notes.md"
        );
        // 非法文件名 / 目录拒绝
        assert!(unique_note_path(&root, "../evil", "x.md").is_err());
        assert!(unique_note_path(&root, ".hidden", "x.md").is_err());
    }
}

use std::fs;
use std::path::{Component, Path, PathBuf};

use crate::domain::error::AppError;

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

pub fn delete_note(root: &Path, rel: &str) -> Result<(), AppError> {
    let path = root.join(validate_rel_path(rel)?);
    if !path.is_file() {
        return Err(AppError::NoteNotFound(rel.to_string()));
    }
    Ok(fs::remove_file(path)?)
}

pub fn delete_folder(root: &Path, rel: &str) -> Result<(), AppError> {
    let path = root.join(validate_rel_path(rel)?);
    if !path.is_dir() {
        return Err(AppError::Io(format!("folder not found: {rel}")));
    }
    Ok(fs::remove_dir_all(path)?)
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
    fn delete_and_move() {
        let (_t, root) = setup();
        write_note(&root, "old.md", "x").unwrap();
        move_note(&root, "old.md", "sub/new.md").unwrap();
        assert_eq!(read_note(&root, "sub/new.md").unwrap(), "x");
        delete_note(&root, "sub/new.md").unwrap();
        assert!(read_note(&root, "sub/new.md").is_err());
    }
}

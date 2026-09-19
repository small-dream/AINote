use std::fs;
use std::path::{Component, Path, PathBuf};

use crate::domain::error::AppError;
use crate::repositories::asset_files;
use crate::repositories::trash_files;

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

/// 符号链接防御（R1）：词法校验之上，对目标路径已存在的最近祖先做 canonicalize，
/// 断言解析结果仍以 canonical 化的仓库 root 为前缀，阻止经符号链接读写仓库外文件。
/// 目标本身可能不存在（新建笔记），此时逐段回退到已存在的祖先再拼接剩余路径段。
/// 校验通过后返回 `root.join(rel)` 原样路径（解析结果只用于前缀断言，保持调用方路径语义不变）。
pub(crate) fn resolve_within_root(root: &Path, rel: &Path) -> Result<PathBuf, AppError> {
    let invalid = || AppError::InvalidPath(rel.to_string_lossy().into_owned());
    let root_canon = fs::canonicalize(root)
        .map_err(|err| AppError::io_context("解析仓库根目录失败", root, err))?;
    let mut ancestor = root.join(rel);
    loop {
        match fs::canonicalize(&ancestor) {
            Ok(canon) => {
                if !canon.starts_with(&root_canon) {
                    return Err(invalid());
                }
                return Ok(root.join(rel));
            }
            // 目标或中间段尚不存在：回退到父目录再试，root 本身必存在故循环必然终止
            Err(_) if ancestor.pop() => {}
            Err(_) => return Err(invalid()),
        }
    }
}

pub fn read_note(root: &Path, rel: &str) -> Result<String, AppError> {
    let path = resolve_within_root(root, &validate_rel_path(rel)?)?;
    if !path.is_file() {
        return Err(AppError::NoteNotFound(rel.to_string()));
    }
    fs::read_to_string(&path).map_err(|err| AppError::io_context("读取失败", &path, err))
}

/// 写入笔记，自动创建父目录。
pub fn write_note(root: &Path, rel: &str, content: &str) -> Result<(), AppError> {
    let path = resolve_within_root(root, &validate_rel_path(rel)?)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| AppError::io_context("创建目录失败", parent, err))?;
    }
    fs::write(&path, content).map_err(|err| AppError::io_context("写入失败", &path, err))
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
    let src = resolve_within_root(root, &validate_rel_path(from)?)?;
    let dst = resolve_within_root(root, &validate_rel_path(to)?)?;
    if !src.is_file() {
        return Err(AppError::NoteNotFound(from.to_string()));
    }
    if let Some(parent) = dst.parent() {
        fs::create_dir_all(parent).map_err(|err| AppError::io_context("创建目录失败", parent, err))?;
    }
    fs::rename(&src, &dst).map_err(|err| AppError::io_context("移动失败", &src, err))
}

/// 转换笔记类型：写入新扩展名文件后，原文件软删除移入回收站（可恢复，P0 数据安全），
/// 不再直接 `remove_file`（内容已由前端转换好）。
pub fn convert_note(root: &Path, from: &str, to: &str, content: &str) -> Result<(), AppError> {
    let src = resolve_within_root(root, &validate_rel_path(from)?)?;
    let dst = resolve_within_root(root, &validate_rel_path(to)?)?;
    if !src.is_file() {
        return Err(AppError::NoteNotFound(from.to_string()));
    }
    if let Some(parent) = dst.parent() {
        fs::create_dir_all(parent).map_err(|err| AppError::io_context("创建目录失败", parent, err))?;
    }
    fs::write(&dst, content).map_err(|err| AppError::io_context("写入失败", &dst, err))?;
    // 回收站失败时回滚新文件，避免新旧两份并存造成内容分叉
    if let Err(err) = trash_files::soft_delete_note(root, from) {
        let _ = fs::remove_file(&dst);
        return Err(err);
    }
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
    fn convert_replaces_content_and_moves_source_to_trash() {
        let (_t, root) = setup();
        write_note(&root, "a.md", "# 旧内容").unwrap();
        convert_note(&root, "a.md", "a.ainote", "{\"type\":\"doc\"}").unwrap();
        assert_eq!(read_note(&root, "a.ainote").unwrap(), "{\"type\":\"doc\"}");
        assert!(read_note(&root, "a.md").is_err());
        // 原文件保留在回收站，可恢复
        let items = trash_files::list(&root).unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].path, "a.md");
        let restored = trash_files::restore(&root, &items[0].id).unwrap();
        assert_eq!(restored, "a.md");
        assert_eq!(read_note(&root, "a.md").unwrap(), "# 旧内容");
    }

    #[test]
    fn convert_reverse_direction_also_keeps_source_in_trash() {
        let (_t, root) = setup();
        write_note(&root, "a.ainote", "{\"type\":\"doc\"}").unwrap();
        convert_note(&root, "a.ainote", "a.md", "# 标题").unwrap();
        assert_eq!(read_note(&root, "a.md").unwrap(), "# 标题");
        let items = trash_files::list(&root).unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].path, "a.ainote");
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

    /// R1：指向仓库外文件的符号链接笔记不得被读出（返回 AppError 而非跟随链接）。
    #[cfg(unix)]
    #[test]
    fn read_rejects_symlink_escaping_root() {
        let (_t, root) = setup();
        let outside = tempfile::NamedTempFile::new().unwrap();
        fs::write(outside.path(), "secret").unwrap();
        std::os::unix::fs::symlink(outside.path(), root.join("leak.md")).unwrap();
        assert!(matches!(
            read_note(&root, "leak.md"),
            Err(AppError::InvalidPath(_))
        ));
    }

    /// R1：经指向仓库外目录的符号链接写入 / 移动，必须拒绝且不产生任何外部文件。
    #[cfg(unix)]
    #[test]
    fn write_and_move_reject_symlinked_dir_escaping_root() {
        let (_t, root) = setup();
        let outside = tempfile::tempdir().unwrap();
        std::os::unix::fs::symlink(outside.path(), root.join("out")).unwrap();

        assert!(matches!(
            write_note(&root, "out/x.md", "payload"),
            Err(AppError::InvalidPath(_))
        ));
        assert!(!outside.path().join("x.md").exists(), "不得写到仓库外");

        write_note(&root, "a.md", "x").unwrap();
        assert!(matches!(
            move_note(&root, "a.md", "out/a.md"),
            Err(AppError::InvalidPath(_))
        ));
        assert!(read_note(&root, "a.md").is_ok(), "源笔记不得被动");
        assert!(!outside.path().join("a.md").exists());
    }

    /// R1：仓库内部的符号链接（解析后仍在 root 内）不受影响。
    #[cfg(unix)]
    #[test]
    fn symlink_staying_inside_root_is_allowed() {
        let (_t, root) = setup();
        write_note(&root, "real/a.md", "# 内部").unwrap();
        std::os::unix::fs::symlink(root.join("real"), root.join("alias")).unwrap();
        assert_eq!(read_note(&root, "alias/a.md").unwrap(), "# 内部");
    }
}

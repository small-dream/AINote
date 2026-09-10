//! 冲突兜底导出用例：把每个冲突文件的本地侧与远端侧整理成 zip 条目。
//!
//! 条目布局 `local/<仓库相对路径>` 与 `remote/<仓库相对路径>`，两侧同名前缀不同，
//! 解压时不会互相覆盖；路径必须留在包内（拒绝绝对路径与 `..`）。

use crate::domain::error::AppError;
use crate::domain::sync::ConflictFile;
use crate::repositories::diagnostics_files::ZipEntry;

/// 构建冲突导出条目；路径非法时返回 `InvalidPath`，不落盘任何内容。
pub(crate) fn build_entries(conflicts: &[ConflictFile]) -> Result<Vec<ZipEntry>, AppError> {
    let mut entries = Vec::with_capacity(conflicts.len() * 2);
    for conflict in conflicts {
        let relative = sanitize(&conflict.path)?;
        for (side, content) in [("local", &conflict.local), ("remote", &conflict.remote)] {
            entries.push(ZipEntry {
                name: format!("{side}/{relative}"),
                content: content.as_bytes().to_vec(),
            });
        }
    }
    Ok(entries)
}

/// 归一化为包内相对路径：统一分隔符、去掉前导 `/`，拒绝空段与 `..`。
fn sanitize(path: &str) -> Result<String, AppError> {
    let normalized = path.replace('\\', "/");
    let trimmed = normalized.trim_start_matches('/');
    let invalid = trimmed.is_empty()
        || trimmed
            .split('/')
            .any(|segment| segment.is_empty() || segment == "." || segment == "..");
    if invalid {
        return Err(AppError::InvalidPath(path.to_string()));
    }
    Ok(trimmed.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn conflict(path: &str) -> ConflictFile {
        ConflictFile {
            path: path.into(),
            local: "本地".into(),
            remote: "远端".into(),
        }
    }

    #[test]
    fn builds_both_sides_per_file() {
        let entries = build_entries(&[conflict("daily/a.md")]).unwrap();
        let names: Vec<&str> = entries.iter().map(|entry| entry.name.as_str()).collect();
        assert_eq!(names, vec!["local/daily/a.md", "remote/daily/a.md"]);
        assert_eq!(entries[0].content, "本地".as_bytes());
        assert_eq!(entries[1].content, "远端".as_bytes());
    }

    #[test]
    fn normalizes_windows_separators() {
        let entries = build_entries(&[conflict("daily\\b.md")]).unwrap();
        assert_eq!(entries[0].name, "local/daily/b.md");
    }

    #[test]
    fn rejects_escaping_paths() {
        for path in ["../secret", "/etc/passwd/../x", "daily//a.md", "..", ""] {
            assert!(
                matches!(build_entries(&[conflict(path)]), Err(AppError::InvalidPath(_))),
                "path {path} should be rejected"
            );
        }
    }

    #[test]
    fn empty_conflict_list_yields_no_entries() {
        assert!(build_entries(&[]).unwrap().is_empty());
    }
}

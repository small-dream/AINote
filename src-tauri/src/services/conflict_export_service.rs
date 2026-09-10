//! 冲突兜底导出用例：把每个冲突文件的本地侧与远端侧整理成 zip 条目并落盘。
//!
//! 条目布局 `local/<仓库相对路径>` 与 `remote/<仓库相对路径>`，两侧同名前缀不同，
//! 解压时不会互相覆盖；路径必须留在包内（拒绝绝对路径与 `..`）。

use std::path::Path;

use crate::domain::error::AppError;
use crate::domain::sync::{ConflictExportDto, ConflictFile};
use crate::repositories::diagnostics_files::{self, ZipEntry};
use crate::repositories::git_backend::GitBackend;

use super::sync_service;

/// 用例：把当前全部冲突文件的本地 / 远端两侧导出为 zip（E3-T5）；无冲突时返回 Conflict 错误。
pub(crate) fn export<B: GitBackend>(
    backend: &B,
    repo_path: &Path,
    dest: &Path,
) -> Result<ConflictExportDto, AppError> {
    let conflicts = sync_service::list_conflicts(backend, repo_path)?;
    if conflicts.is_empty() {
        return Err(AppError::Conflict("当前没有待处理的冲突文件".into()));
    }
    let entries = build_entries(&conflicts)?;
    let files = entries.iter().map(|entry| entry.name.clone()).collect();
    let bytes = diagnostics_files::write_zip(dest, &entries)?;
    Ok(ConflictExportDto {
        path: dest.to_string_lossy().into_owned(),
        bytes,
        files,
    })
}

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

    #[test]
    fn export_writes_zip_and_returns_dto() {
        use crate::repositories::git_backend::MockGitBackend;

        let tmp = tempfile::tempdir().unwrap();
        let dest = tmp.path().join("conflicts.zip");
        let mock = MockGitBackend {
            conflicts: vec![conflict("daily/a.md")],
            ..Default::default()
        };
        let dto = export(&mock, tmp.path(), &dest).unwrap();
        assert_eq!(dto.path, dest.to_string_lossy());
        assert!(dto.bytes > 0);
        assert_eq!(dto.files, vec!["local/daily/a.md", "remote/daily/a.md"]);
        assert!(dest.is_file());
        assert_eq!(mock.recorded(), vec!["conflicts"]);
    }

    #[test]
    fn export_rejects_when_no_conflicts() {
        use crate::repositories::git_backend::MockGitBackend;

        let tmp = tempfile::tempdir().unwrap();
        let dest = tmp.path().join("conflicts.zip");
        let err = export(&MockGitBackend::default(), tmp.path(), &dest).unwrap_err();
        assert!(matches!(err, AppError::Conflict(_)));
        assert!(!dest.exists(), "无冲突时不落盘");
    }
}

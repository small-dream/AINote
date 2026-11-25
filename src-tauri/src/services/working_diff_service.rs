use std::path::{Component, Path};

use crate::domain::error::AppError;
use crate::domain::working_diff::WorkingDiff;
use crate::repositories::git_backend::GitBackend;

/// 路径长度上限（与 IPC 输入防御口径一致）。
const MAX_PATH_LEN: usize = 1_024;

/// 用例：读取单个待提交文件相对 HEAD 的 diff。
///
/// 入参来自提交面板的文件列表，必须做显式校验：拒绝绝对路径、`..`、`./` 等非普通路径段，
/// 也拒绝 `.git` 内部文件。与笔记路径不同，这里**允许隐藏段**——待提交变更天然包含
/// `.ainote/todos.json`、`.trash/` 等仓库内部文件，用户同样有权查看它们的改动。
pub fn working_diff<B: GitBackend>(
    backend: &B,
    repo_path: &Path,
    file: &str,
) -> Result<WorkingDiff, AppError> {
    let file = validate_path(file)?;
    backend.working_diff(&repo_path.to_string_lossy(), &file)
}

fn validate_path(file: &str) -> Result<String, AppError> {
    let invalid = || AppError::InvalidPath(file.to_string());
    if file.is_empty()
        || file.len() > MAX_PATH_LEN
        || file.contains('\0')
        || Path::new(file).is_absolute()
    {
        return Err(invalid());
    }
    let mut segments = 0usize;
    for component in Path::new(file).components() {
        let Component::Normal(segment) = component else {
            return Err(invalid());
        };
        if segment == ".git" {
            return Err(invalid());
        }
        segments += 1;
    }
    if segments == 0 {
        return Err(invalid());
    }
    Ok(file.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    use crate::repositories::git_backend::MockGitBackend;

    fn root() -> PathBuf {
        PathBuf::from("/repo")
    }

    #[test]
    fn delegates_with_validated_path() {
        let mock = MockGitBackend::default();
        let diff = working_diff(&mock, &root(), "notes/a.md").unwrap();
        assert_eq!(diff.path, "notes/a.md");
        assert_eq!(mock.recorded(), vec!["working_diff:notes/a.md"]);
    }

    #[test]
    fn allows_hidden_repo_files() {
        let mock = MockGitBackend::default();
        working_diff(&mock, &root(), ".ainote/todos.json").unwrap();
        working_diff(&mock, &root(), ".trash/old.md").unwrap();
        assert_eq!(
            mock.recorded(),
            vec![
                "working_diff:.ainote/todos.json",
                "working_diff:.trash/old.md"
            ]
        );
    }

    #[test]
    fn rejects_unsafe_paths() {
        let mock = MockGitBackend::default();
        for bad in [
            "",
            "../evil.md",
            "/etc/passwd",
            "a/../../b",
            "./a.md",
            ".git/config",
        ] {
            assert!(
                matches!(
                    working_diff(&mock, &root(), bad),
                    Err(AppError::InvalidPath(_))
                ),
                "应拒绝 {bad:?}"
            );
        }
        assert!(mock.recorded().is_empty());
    }
}

use std::path::Path;

use crate::domain::error::AppError;
use crate::domain::history::{CommitInfo, FileDiff, RepoCommit};
use crate::repositories::git_backend::GitBackend;
use crate::repositories::note_files;
use crate::repositories::vault_files;

const DEFAULT_LIMIT: usize = 100;

/// 用例：指定文件的提交历史（委托 GitBackend，校验相对路径）。
pub fn file_history<B: GitBackend>(
    backend: &B,
    repo_path: &Path,
    file: &str,
) -> Result<Vec<CommitInfo>, AppError> {
    let file = validate_file(file)?;
    reject_encrypted(repo_path, &file)?;
    backend.file_history(&repo_path.to_string_lossy(), &file, DEFAULT_LIMIT)
}

/// 用例：选中提交相对其父提交的单文件 diff。
pub fn file_diff<B: GitBackend>(
    backend: &B,
    repo_path: &Path,
    file: &str,
    commit_id: &str,
) -> Result<FileDiff, AppError> {
    let file = validate_file(file)?;
    validate_commit(commit_id)?;
    reject_encrypted(repo_path, &file)?;
    backend.file_diff(&repo_path.to_string_lossy(), &file, commit_id)
}

/// 用例：全仓提交历史（含每 commit 直接改动的文件），供 Repo Git Graph 面板。
pub fn repo_history<B: GitBackend>(
    backend: &B,
    repo_path: &Path,
    limit: usize,
) -> Result<Vec<RepoCommit>, AppError> {
    backend.repo_history(&repo_path.to_string_lossy(), limit)
}

/// 用例：把文件恢复到指定提交版本（写入工作区，不自动提交）。
pub fn restore_file<B: GitBackend>(
    backend: &B,
    repo_path: &Path,
    file: &str,
    commit_id: &str,
) -> Result<(), AppError> {
    let file = validate_file(file)?;
    validate_commit(commit_id)?;
    reject_encrypted(repo_path, &file)?;
    backend.restore_file(&repo_path.to_string_lossy(), &file, commit_id)
}

/// 加密笔记不提供版本历史（决策 ④）：不做历史 blob 解密，也不给回滚入口。
/// 判定基于当前工作区文件是否为信封——历史版本可能是明文（加密前提交的），因此一律拒绝。
fn reject_encrypted(repo_path: &Path, file: &str) -> Result<(), AppError> {
    if vault_files::is_envelope_file(&repo_path.join(file)) {
        return Err(AppError::VaultHistoryUnavailable(format!(
            "{file} 已加密，不提供版本历史"
        )));
    }
    Ok(())
}

/// 相对路径校验（拒绝穿越与隐藏段），返回规范化的字符串路径。
fn validate_file(file: &str) -> Result<String, AppError> {
    Ok(note_files::validate_rel_path(file)?.to_string_lossy().into_owned())
}

/// 提交 id 校验：非空、长度受限、全十六进制（允许短 id）。
fn validate_commit(commit_id: &str) -> Result<(), AppError> {
    let valid = !commit_id.is_empty()
        && commit_id.len() <= 64
        && commit_id.chars().all(|c| c.is_ascii_hexdigit());
    if valid {
        Ok(())
    } else {
        Err(AppError::InvalidPath(format!("invalid commit: {commit_id}")))
    }
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
    fn history_delegates_with_validated_path() {
        let mock = MockGitBackend::default();
        let history = file_history(&mock, &root(), "daily/a.md").unwrap();
        assert_eq!(history.len(), 1);
        assert_eq!(mock.recorded(), vec!["history:daily/a.md"]);
    }

    #[test]
    fn history_rejects_traversal() {
        let mock = MockGitBackend::default();
        assert!(matches!(
            file_history(&mock, &root(), "../evil.md"),
            Err(AppError::InvalidPath(_))
        ));
        assert!(mock.recorded().is_empty());
    }

    #[test]
    fn diff_and_restore_validate_commit_id() {
        let mock = MockGitBackend::default();
        assert!(matches!(
            file_diff(&mock, &root(), "a.md", "not-a-hex!"),
            Err(AppError::InvalidPath(_))
        ));
        assert!(matches!(
            restore_file(&mock, &root(), "a.md", ""),
            Err(AppError::InvalidPath(_))
        ));
        assert!(mock.recorded().is_empty());
    }

    #[test]
    fn diff_and_restore_delegate_on_valid_input() {
        let mock = MockGitBackend::default();
        file_diff(&mock, &root(), "a.md", "abc1234").unwrap();
        restore_file(&mock, &root(), "a.md", "abc1234").unwrap();
        assert_eq!(
            mock.recorded(),
            vec!["diff:a.md@abc1234", "restore:a.md@abc1234"]
        );
    }

    #[test]
    fn encrypted_notes_have_no_version_history() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path();
        std::fs::write(root.join("secret.md"), "AINOTE-ENC-v1\nQUJD\n").unwrap();
        let mock = MockGitBackend::default();

        assert!(matches!(
            file_history(&mock, root, "secret.md"),
            Err(AppError::VaultHistoryUnavailable(_))
        ));
        assert!(matches!(
            file_diff(&mock, root, "secret.md", "abc1234"),
            Err(AppError::VaultHistoryUnavailable(_))
        ));
        assert!(matches!(
            restore_file(&mock, root, "secret.md", "abc1234"),
            Err(AppError::VaultHistoryUnavailable(_))
        ));
        assert!(mock.recorded().is_empty(), "加密笔记不得触达 Git 历史层");
    }

    #[test]
    fn repo_history_still_lists_encrypted_notes_commits() {
        let mock = MockGitBackend::default();
        repo_history(&mock, &root(), 10).unwrap();
        assert_eq!(
            mock.recorded(),
            vec!["repo_history"],
            "全仓历史是元数据，不受加密影响"
        );
    }
}

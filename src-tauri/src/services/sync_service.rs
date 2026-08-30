use std::path::Path;

use crate::domain::error::AppError;
use crate::domain::sync::SyncStatus;
use crate::repositories::git_backend::GitBackend;

/// 用例：组装仓库同步状态
pub fn status<B: GitBackend>(backend: &B, repo_path: &Path) -> Result<SyncStatus, AppError> {
    let path = repo_path.to_string_lossy();
    let (ahead, behind) = backend.ahead_behind(&path)?;
    Ok(SyncStatus {
        ahead,
        behind,
        has_uncommitted: backend.has_uncommitted(&path)?,
        conflicted: backend.is_merging(&path)?,
    })
}

/// 用例：提交全部未提交变更；无变更返回 None
pub fn commit_pending<B: GitBackend>(
    backend: &B,
    repo_path: &Path,
    message: &str,
) -> Result<Option<String>, AppError> {
    backend.commit_all(&repo_path.to_string_lossy(), message)
}

/// 用例：拉取远端（冲突时返回 Conflict 错误，状态可查）
pub fn pull<B: GitBackend>(backend: &B, repo_path: &Path, token: &str) -> Result<SyncStatus, AppError> {
    backend.pull(&repo_path.to_string_lossy(), token)?;
    status(backend, repo_path)
}

/// 用例：推送本地提交
pub fn push<B: GitBackend>(backend: &B, repo_path: &Path, token: &str) -> Result<SyncStatus, AppError> {
    backend.push(&repo_path.to_string_lossy(), token)?;
    status(backend, repo_path)
}

/// 用例：完整同步 —— 提交未提交变更 → pull → push，返回同步后状态。
/// 合并进行中直接报 Conflict，由 resolve 收尾。
pub fn sync<B: GitBackend>(backend: &B, repo_path: &Path, token: &str) -> Result<SyncStatus, AppError> {
    let path = repo_path.to_string_lossy();
    if backend.is_merging(&path)? {
        return Err(AppError::Conflict("存在未解决的合并冲突".into()));
    }
    commit_pending(backend, repo_path, "note: auto commit")?;
    backend.pull(&path, token)?;
    backend.push(&path, token)?;
    status(backend, repo_path)
}

/// 用例：解决冲突 —— use_local 保留本地侧，完成后 push。
pub fn resolve<B: GitBackend>(
    backend: &B,
    repo_path: &Path,
    token: &str,
    use_local: bool,
) -> Result<SyncStatus, AppError> {
    let path = repo_path.to_string_lossy();
    if use_local {
        backend.resolve_conflict_ours(&path)?;
    } else {
        backend.resolve_conflict_theirs(&path)?;
    }
    backend.push(&path, token)?;
    status(backend, repo_path)
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
    fn status_assembles_from_backend() {
        let mock = MockGitBackend {
            ahead: 2,
            behind: 1,
            uncommitted: true,
            merging: false,
            ..Default::default()
        };
        let s = status(&mock, &root()).unwrap();
        assert_eq!((s.ahead, s.behind), (2, 1));
        assert!(s.has_uncommitted);
        assert!(!s.conflicted);
    }

    #[test]
    fn sync_commits_then_pulls_then_pushes() {
        let mock = MockGitBackend {
            uncommitted: true,
            ..Default::default()
        };
        sync(&mock, &root(), "tok").unwrap();
        assert_eq!(
            mock.recorded(),
            vec!["commit:note: auto commit", "pull", "push"]
        );
    }

    #[test]
    fn sync_fails_fast_when_merging() {
        let mock = MockGitBackend {
            merging: true,
            ..Default::default()
        };
        let err = sync(&mock, &root(), "tok").unwrap_err();
        assert!(matches!(err, AppError::Conflict(_)));
        assert!(mock.recorded().is_empty());
    }

    #[test]
    fn sync_propagates_pull_conflict() {
        let mock = MockGitBackend {
            conflict_on_pull: true,
            ..Default::default()
        };
        assert!(matches!(
            sync(&mock, &root(), "tok"),
            Err(AppError::Conflict(_))
        ));
        assert_eq!(mock.recorded(), vec!["commit:note: auto commit", "pull"]);
    }

    #[test]
    fn resolve_picks_side_and_pushes() {
        let mock = MockGitBackend::default();
        resolve(&mock, &root(), "tok", true).unwrap();
        resolve(&mock, &root(), "tok", false).unwrap();
        assert_eq!(
            mock.recorded(),
            vec!["resolve:ours", "push", "resolve:theirs", "push"]
        );
    }
}

use std::path::Path;

use crate::domain::error::AppError;
use crate::domain::history_reset::{
    blocking_reason, normalize_message, HistoryResetReport, RebuiltCommit, RepoSnapshot,
};
use crate::domain::remote::RemoteCredential;
use crate::repositories::repo_rewrite::RepoRewriteBackend;

/// 用例：把当前仓库重置为「工作区现状 = 唯一一次提交」。
///
/// 顺序保证「全有或全无」：快照校验 → 远端探测 → 重建（旧 `.git` 先移出为备份）→
/// 强制推送 → 成功才删除备份。推送失败即整体回滚，仓库回到操作前状态。
pub fn reset<B: RepoRewriteBackend>(
    backend: &B,
    repo_path: &Path,
    cred: Option<&RemoteCredential>,
    message: &str,
) -> Result<HistoryResetReport, AppError> {
    let message = normalize_message(message).ok_or_else(|| {
        AppError::Repo("提交说明不能为空，且不超过 200 个字符".into())
    })?;
    let snapshot = backend.snapshot(repo_path)?;
    if let Some(reason) = blocking_reason(&snapshot) {
        return Err(AppError::Repo(reason.into()));
    }
    let Some(url) = snapshot.remote_url.as_deref() else {
        // 本地仓库没有远端：只重建，不涉及推送
        let built = backend.rebuild(repo_path, &message, &snapshot)?;
        return Ok(report(&snapshot, &built, false, cleanup(backend, repo_path)));
    };
    let cred = cred.ok_or_else(|| {
        AppError::Repo("未能读取远端凭证，请先在「设置 → 账户」登录后再重置历史".into())
    })?;
    // 破坏性操作前先确认远端可达且凭证有效：网络与凭证问题在这里就返回，不做无谓重建
    backend.verify_remote(url, cred)?;
    let built = backend.rebuild(repo_path, &message, &snapshot)?;
    match backend.force_push(repo_path, cred) {
        Ok(()) => Ok(report(&snapshot, &built, true, cleanup(backend, repo_path))),
        Err(err) => Err(rollback(backend, repo_path, err)),
    }
}

fn report(
    snapshot: &RepoSnapshot,
    built: &RebuiltCommit,
    pushed: bool,
    backup_cleanup_failed: bool,
) -> HistoryResetReport {
    HistoryResetReport {
        commit_id: built.commit_id.clone(),
        branch: snapshot.branch.clone(),
        erased_commits: snapshot.commits,
        file_count: built.files,
        pushed,
        backup_cleanup_failed,
    }
}

/// 成功收尾：删除旧仓库备份。清理失败不影响结果，只回报给前端提示手动删除。
fn cleanup<B: RepoRewriteBackend>(backend: &B, repo_path: &Path) -> bool {
    backend.discard_backup(repo_path).is_err()
}

/// 重建或推送失败：还原旧仓库，错误按原样返回（回滚失败的信息由实现补进错误里）。
fn rollback<B: RepoRewriteBackend>(backend: &B, repo_path: &Path, err: AppError) -> AppError {
    match backend.restore_backup(repo_path) {
        Ok(()) => err,
        Err(rollback_err) => AppError::Repo(format!("{err}；且自动回滚失败（{rollback_err}）")),
    }
}

#[cfg(test)]
mod tests {
    use std::path::Path;
    use std::sync::Mutex;

    use super::*;

    struct MockRewrite {
        snapshot: RepoSnapshot,
        push_fails: bool,
        discard_fails: bool,
        calls: Mutex<Vec<String>>,
    }

    impl MockRewrite {
        fn new(snapshot: RepoSnapshot) -> Self {
            Self {
                snapshot,
                push_fails: false,
                discard_fails: false,
                calls: Mutex::new(Vec::new()),
            }
        }

        fn record(&self, name: &str) {
            self.calls.lock().unwrap().push(name.to_string());
        }

        fn recorded(&self) -> Vec<String> {
            self.calls.lock().unwrap().clone()
        }
    }

    impl RepoRewriteBackend for MockRewrite {
        fn snapshot(&self, _repo_path: &Path) -> Result<RepoSnapshot, AppError> {
            self.record("snapshot");
            Ok(self.snapshot.clone())
        }

        fn rebuild(
            &self,
            _repo_path: &Path,
            _message: &str,
            _snapshot: &RepoSnapshot,
        ) -> Result<RebuiltCommit, AppError> {
            self.record("rebuild");
            Ok(RebuiltCommit {
                commit_id: "abc123".into(),
                files: 7,
            })
        }

        fn verify_remote(&self, _url: &str, _cred: &RemoteCredential) -> Result<(), AppError> {
            self.record("verify");
            Ok(())
        }

        fn force_push(&self, _repo_path: &Path, _cred: &RemoteCredential) -> Result<(), AppError> {
            self.record("push");
            if self.push_fails {
                Err(AppError::SyncRejected("non-fast-forward".into()))
            } else {
                Ok(())
            }
        }

        fn restore_backup(&self, _repo_path: &Path) -> Result<(), AppError> {
            self.record("rollback");
            Ok(())
        }

        fn discard_backup(&self, _repo_path: &Path) -> Result<(), AppError> {
            self.record("discard");
            if self.discard_fails {
                Err(AppError::Io("busy".into()))
            } else {
                Ok(())
            }
        }
    }

    fn snapshot(remote: Option<&str>, behind: u32) -> RepoSnapshot {
        RepoSnapshot {
            branch: "main".into(),
            remote_url: remote.map(str::to_string),
            ahead: 3,
            behind,
            commits: 4,
        }
    }

    fn cred() -> RemoteCredential {
        RemoteCredential::new("x-access-token", "token")
    }

    #[test]
    fn remote_repo_pushes_then_discards_backup() {
        let backend = MockRewrite::new(snapshot(Some("https://x/notes.git"), 0));

        let report = reset(
            &backend,
            Path::new("/repo"),
            Some(&cred()),
            "note: reset history",
        )
        .unwrap();

        assert_eq!(
            backend.recorded(),
            vec!["snapshot", "verify", "rebuild", "push", "discard"]
        );
        assert_eq!(report.commit_id, "abc123");
        assert_eq!(report.erased_commits, 4);
        assert_eq!(report.file_count, 7);
        assert!(report.pushed);
        assert!(!report.backup_cleanup_failed);
    }

    #[test]
    fn push_failure_rolls_back() {
        let mut backend = MockRewrite::new(snapshot(Some("https://x/notes.git"), 0));
        backend.push_fails = true;

        let err = reset(&backend, Path::new("/repo"), Some(&cred()), "note: reset").unwrap_err();

        assert!(matches!(err, AppError::SyncRejected(_)));
        assert_eq!(
            backend.recorded(),
            vec!["snapshot", "verify", "rebuild", "push", "rollback"]
        );
    }

    #[test]
    fn local_repo_skips_remote_steps() {
        let backend = MockRewrite::new(snapshot(None, 0));

        let report = reset(&backend, Path::new("/repo"), None, "note: reset").unwrap();

        assert_eq!(backend.recorded(), vec!["snapshot", "rebuild", "discard"]);
        assert!(!report.pushed);
    }

    #[test]
    fn remote_repo_without_credentials_stops_before_rebuild() {
        let backend = MockRewrite::new(snapshot(Some("https://x/notes.git"), 0));

        let err = reset(&backend, Path::new("/repo"), None, "note: reset").unwrap_err();

        assert!(err.to_string().contains("凭证"));
        assert_eq!(backend.recorded(), vec!["snapshot"]);
    }

    #[test]
    fn behind_remote_blocks_reset() {
        let backend = MockRewrite::new(snapshot(Some("https://x/notes.git"), 2));

        let err = reset(&backend, Path::new("/repo"), Some(&cred()), "note: reset").unwrap_err();

        assert!(err.to_string().contains("先同步"));
        assert_eq!(backend.recorded(), vec!["snapshot"]);
    }

    #[test]
    fn blank_message_blocks_reset() {
        let backend = MockRewrite::new(snapshot(None, 0));

        assert!(reset(&backend, Path::new("/repo"), None, "   ").is_err());
        assert!(backend.recorded().is_empty());
    }

    #[test]
    fn discard_failure_is_reported_without_failing_the_reset() {
        let mut backend = MockRewrite::new(snapshot(None, 0));
        backend.discard_fails = true;

        let report = reset(&backend, Path::new("/repo"), None, "note: reset").unwrap();

        assert!(report.backup_cleanup_failed);
    }
}

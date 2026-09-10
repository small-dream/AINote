use std::path::Path;

use crate::domain::commit::build_commit_message;
use crate::domain::error::AppError;
use crate::domain::sync::{ChangedFile, ConflictFile, SyncStage, SyncStatus};
use crate::repositories::git_backend::GitBackend;

use super::retry::{self, RetryContext, RetryPolicy};

/// 带定位信息的同步失败：Command 层据此补齐 `stage` / `files` / `hint`（E4-T4）。
#[derive(Debug)]
pub struct SyncFailure {
    pub error: AppError,
    /// `None` 表示无法归因到 commit / pull / push 某个阶段
    pub stage: Option<SyncStage>,
    /// 可定位到的失败文件（如拉取冲突的文件）；无法定位时为空
    pub files: Vec<String>,
}

impl SyncFailure {
    fn new(stage: Option<SyncStage>, error: AppError, files: Vec<String>) -> Self {
        Self { error, stage, files }
    }

    /// 可操作建议码：凭证 / 权限 / 冲突各自明确，其余交给用户重试（纯函数）。
    pub fn hint(&self) -> &'static str {
        match &self.error {
            AppError::SyncAuth(_) => "relogin",
            AppError::SyncRejected(_) => "checkPermission",
            AppError::Conflict(_) => "resolveConflicts",
            _ => "retry",
        }
    }
}

/// 拉取冲突时列出待解决文件，供前端定位（失败本身已由 error 表达）。
fn conflict_paths<B: GitBackend>(backend: &B, path: &str) -> Vec<String> {
    backend
        .conflict_files(path)
        .map(|files| files.into_iter().map(|file| file.path).collect())
        .unwrap_or_default()
}

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

/// 用例：工作区待提交变更（增/改/删），供手动提交面板与同步前 message 生成。
pub fn changed_files<B: GitBackend>(
    backend: &B,
    repo_path: &Path,
) -> Result<Vec<ChangedFile>, AppError> {
    backend.changed_files(&repo_path.to_string_lossy())
}

/// 本地时间 `YYYY-MM-DD HH:mm`；取本地时区失败时回退 UTC。
pub fn format_now() -> String {
    let now = time::OffsetDateTime::now_local().unwrap_or_else(|_| time::OffsetDateTime::now_utc());
    now.format(&time::macros::format_description!("[year]-[month]-[day] [hour]:[minute]"))
        .unwrap_or_default()
}

/// 用例：拉取远端（冲突时返回 Conflict 错误，状态可查）
pub fn pull<B: GitBackend>(
    backend: &B,
    repo_path: &Path,
    token: &str,
) -> Result<SyncStatus, AppError> {
    let mut ctx = RetryContext::background();
    pull_stage(backend, repo_path, token, &mut ctx)?;
    status(backend, repo_path)
}

/// 用例：同步的拉取阶段 —— 仅网络错误按退避自动重试（pull 幂等）。
/// `push` 非幂等，任何情况下都不进入此函数。
pub fn pull_stage<B: GitBackend>(
    backend: &B,
    repo_path: &Path,
    token: &str,
    ctx: &mut RetryContext<'_>,
) -> Result<(), AppError> {
    let path = repo_path.to_string_lossy();
    retry::with_retry(RetryPolicy::network(), ctx, || backend.pull(&path, token))
}

/// 用例：推送本地提交
pub fn push<B: GitBackend>(
    backend: &B,
    repo_path: &Path,
    token: &str,
) -> Result<SyncStatus, AppError> {
    backend.push(&repo_path.to_string_lossy(), token)?;
    status(backend, repo_path)
}

/// 用例：完整同步 —— 提交未提交变更 → pull → push，返回同步后状态。
/// 合并进行中直接报 Conflict，由 resolve 收尾。
pub fn sync<B: GitBackend>(
    backend: &B,
    repo_path: &Path,
    token: &str,
    ctx: &mut RetryContext<'_>,
) -> Result<SyncStatus, SyncFailure> {
    let path = repo_path.to_string_lossy();
    let merging = backend
        .is_merging(&path)
        .map_err(|error| SyncFailure::new(None, error, Vec::new()))?;
    if merging {
        let files = conflict_paths(backend, &path);
        return Err(SyncFailure::new(
            Some(SyncStage::Pull),
            AppError::Conflict("存在未解决的合并冲突".into()),
            files,
        ));
    }
    log::info!(target: "ainote::sync", "同步开始 repo={}", crate::config::logging::redact(&path));
    let files = backend
        .changed_files(&path)
        .map_err(|error| stage_failure("changed_files", SyncStage::Commit, error, Vec::new()))?;
    let message = build_commit_message(&files, &format_now());
    commit_pending(backend, repo_path, &message)
        .map_err(|error| stage_failure("commit", SyncStage::Commit, error, Vec::new()))?;
    pull_stage(backend, repo_path, token, ctx).map_err(|error| {
        let files = if matches!(error, AppError::Conflict(_)) {
            conflict_paths(backend, &path)
        } else {
            Vec::new()
        };
        stage_failure("pull", SyncStage::Pull, error, files)
    })?;
    backend
        .push(&path, token)
        .map_err(|error| stage_failure("push", SyncStage::Push, error, Vec::new()))?;
    let result = status(backend, repo_path).map_err(|error| SyncFailure::new(None, error, Vec::new()))?;
    log::info!(
        target: "ainote::sync",
        "同步完成 ahead={} behind={}",
        result.ahead,
        result.behind
    );
    Ok(result)
}

fn stage_failure(stage: &str, named: SyncStage, error: AppError, files: Vec<String>) -> SyncFailure {
    log::error!(target: "ainote::sync", "同步失败 stage={stage} error={error}");
    SyncFailure::new(Some(named), error, files)
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

/// 用例：列出全部冲突文件（本地/远端内容），供三栏合并（P1-3）。
pub fn list_conflicts<B: GitBackend>(
    backend: &B,
    repo_path: &Path,
) -> Result<Vec<ConflictFile>, AppError> {
    backend.conflict_files(&repo_path.to_string_lossy())
}

/// 用例：以指定内容解决单个冲突文件；全部解决后完成 merge commit，返回同步状态（P1-3）。
pub fn resolve_file_conflict<B: GitBackend>(
    backend: &B,
    repo_path: &Path,
    rel: &str,
    content: &str,
) -> Result<SyncStatus, AppError> {
    let path = repo_path.to_string_lossy();
    let all_resolved = backend.resolve_conflict_file(&path, rel, content)?;
    if all_resolved {
        backend.complete_merge(&path, "note: resolve conflict")?;
    }
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

    /// 测试用取消标志：始终为未取消状态。
    static NEVER_CANCELLED_FOR_TEST: std::sync::atomic::AtomicBool =
        std::sync::atomic::AtomicBool::new(false);

    fn background() -> RetryContext<'static> {
        RetryContext::background()
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
        sync(&mock, &root(), "tok", &mut background()).unwrap();
        assert_eq!(
            mock.recorded(),
            vec!["changed_files", "commit:", "pull", "push"]
        );
    }

    #[test]
    fn sync_message_uses_timestamp_and_changed_files() {
        let mock = MockGitBackend {
            uncommitted: true,
            changed: vec![
                crate::domain::sync::ChangedFile {
                    path: "daily/2026-09-10.md".into(),
                    status: crate::domain::sync::ChangedFileStatus::Modified,
                },
                crate::domain::sync::ChangedFile {
                    path: "new.md".into(),
                    status: crate::domain::sync::ChangedFileStatus::Added,
                },
            ],
            ..Default::default()
        };
        sync(&mock, &root(), "tok", &mut background()).unwrap();
        let recorded = mock.recorded();
        assert_eq!(recorded[0], "changed_files");
        assert!(recorded[1].starts_with("commit:chore: "), "subject 含时间与文件数");
        assert!(recorded[1].contains("· 更新 2 个文件"));
        assert!(recorded[1].contains("M daily/2026-09-10.md"));
        assert!(recorded[1].contains("A new.md"));
    }

    #[test]
    fn sync_fails_fast_when_merging() {
        let mock = MockGitBackend {
            merging: true,
            ..Default::default()
        };
        let err = sync(&mock, &root(), "tok", &mut background()).unwrap_err();
        assert!(matches!(err.error, AppError::Conflict(_)));
        assert_eq!(mock.recorded(), vec!["conflicts"], "只读取冲突清单，不做任何写操作");
    }

    #[test]
    fn sync_propagates_pull_conflict() {
        let mock = MockGitBackend {
            conflict_on_pull: true,
            ..Default::default()
        };
        assert!(matches!(
            sync(&mock, &root(), "tok", &mut background()),
            Err(SyncFailure { error: AppError::Conflict(_), .. })
        ));
        assert_eq!(
            mock.recorded(),
            vec!["changed_files", "commit:", "pull", "conflicts"],
            "冲突后列出待解决文件供前端定位"
        );
    }

    #[test]
    fn pull_retries_network_failures_then_succeeds() {
        let mock = MockGitBackend {
            pull_network_failures: std::sync::Mutex::new(2),
            ..Default::default()
        };
        let mut delays: Vec<u64> = Vec::new();
        let mut reports: Vec<u32> = Vec::new();
        let outcome = {
            let mut sleep = |ms: u64| delays.push(ms);
            let mut report = |attempt: retry::RetryAttempt| reports.push(attempt.retry);
            let mut ctx = RetryContext {
                cancel: &NEVER_CANCELLED_FOR_TEST,
                sleep: Some(&mut sleep),
                report: Some(&mut report),
            };
            sync(&mock, &root(), "tok", &mut ctx)
        };

        assert!(outcome.is_ok());
        assert_eq!(mock.recorded(), vec!["changed_files", "commit:", "pull", "pull", "pull", "push"]);
        assert_eq!(reports, vec![1, 2]);
        assert_eq!(delays.len(), 2);
    }

    #[test]
    fn sync_stops_before_push_when_pull_keeps_failing() {
        let mock = MockGitBackend {
            pull_network_failures: std::sync::Mutex::new(10),
            ..Default::default()
        };
        let outcome = {
            let mut ctx = RetryContext {
                cancel: &NEVER_CANCELLED_FOR_TEST,
                sleep: Some(&mut |_ms: u64| {}),
                report: None,
            };
            sync(&mock, &root(), "tok", &mut ctx)
        };

        assert!(matches!(outcome, Err(SyncFailure { error: AppError::SyncNetwork(_), .. })));
        let calls = mock.recorded();
        assert_eq!(calls.iter().filter(|call| call.as_str() == "pull").count(), 4, "首次 + 3 次重试");
        assert!(!calls.iter().any(|call| call == "push"), "拉取未成功时不推送");
    }

    fn conflict(path: &str) -> ConflictFile {
        ConflictFile {
            path: path.into(),
            local: "本地".into(),
            remote: "远端".into(),
        }
    }

    #[test]
    fn commit_failure_is_attributed_to_commit_stage() {
        let mock = MockGitBackend {
            commit_fails: true,
            ..Default::default()
        };
        let failure = sync(&mock, &root(), "tok", &mut background()).unwrap_err();

        assert_eq!(failure.stage, Some(SyncStage::Commit));
        assert!(failure.files.is_empty());
        assert_eq!(failure.hint(), "retry");
        assert!(matches!(failure.error, AppError::Io(_)));
        assert!(!mock.recorded().iter().any(|call| call == "pull"));
    }

    #[test]
    fn pull_conflict_lists_files_for_locating() {
        let mock = MockGitBackend {
            conflict_on_pull: true,
            conflicts: vec![conflict("daily/a.md"), conflict("daily/b.md")],
            ..Default::default()
        };
        let failure = sync(&mock, &root(), "tok", &mut background()).unwrap_err();

        assert_eq!(failure.stage, Some(SyncStage::Pull));
        assert_eq!(failure.files, vec!["daily/a.md", "daily/b.md"]);
        assert_eq!(failure.hint(), "resolveConflicts");
    }

    #[test]
    fn unresolved_merge_is_attributed_to_pull_with_files() {
        let mock = MockGitBackend {
            merging: true,
            conflicts: vec![conflict("daily/a.md")],
            ..Default::default()
        };
        let failure = sync(&mock, &root(), "tok", &mut background()).unwrap_err();

        assert_eq!(failure.stage, Some(SyncStage::Pull));
        assert_eq!(failure.files, vec!["daily/a.md"]);
    }

    #[test]
    fn network_failure_is_attributed_to_pull_stage() {
        let mock = MockGitBackend {
            pull_network_failures: std::sync::Mutex::new(10),
            ..Default::default()
        };
        let mut ctx = RetryContext {
            cancel: &NEVER_CANCELLED_FOR_TEST,
            sleep: Some(&mut |_ms: u64| {}),
            report: None,
        };
        let failure = sync(&mock, &root(), "tok", &mut ctx).unwrap_err();

        assert_eq!(failure.stage, Some(SyncStage::Pull));
        assert!(failure.files.is_empty(), "网络错误无法定位到文件");
        assert_eq!(failure.hint(), "retry");
    }

    #[test]
    fn push_rejection_is_attributed_to_push_stage() {
        let mock = MockGitBackend {
            push_rejected: true,
            ..Default::default()
        };
        let failure = sync(&mock, &root(), "tok", &mut background()).unwrap_err();

        assert_eq!(failure.stage, Some(SyncStage::Push));
        assert_eq!(failure.hint(), "checkPermission");
        assert!(matches!(failure.error, AppError::SyncRejected(_)));
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

    #[test]
    fn resolve_file_completes_merge_when_all_resolved() {
        let mock = MockGitBackend {
            all_resolved_after_file: true,
            ..Default::default()
        };
        let s = resolve_file_conflict(&mock, &root(), "daily/a.md", "merged").unwrap();
        assert!(!s.conflicted);
        assert_eq!(
            mock.recorded(),
            vec!["resolve_file:daily/a.md", "complete_merge"]
        );
    }

    #[test]
    fn resolve_file_skips_merge_while_conflicts_remain() {
        let mock = MockGitBackend {
            all_resolved_after_file: false,
            ..Default::default()
        };
        resolve_file_conflict(&mock, &root(), "a.md", "x").unwrap();
        assert_eq!(mock.recorded(), vec!["resolve_file:a.md"]);
    }

    #[test]
    fn list_conflicts_forwards_from_backend() {
        let mock = MockGitBackend {
            conflicts: vec![ConflictFile {
                path: "a.md".into(),
                local: "l".into(),
                remote: "r".into(),
            }],
            ..Default::default()
        };
        let files = list_conflicts(&mock, &root()).unwrap();
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].path, "a.md");
        assert_eq!(mock.recorded(), vec!["conflicts"]);
    }
}

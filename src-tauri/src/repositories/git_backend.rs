use std::path::Path;

use crate::domain::error::AppError;
use crate::domain::history::{CommitInfo, FileDiff};
use crate::domain::sync::ConflictFile;

/// Git 能力抽象（防腐化关键：Service 只依赖此 trait，不依赖 git2）。
/// 实现：git2_backend.rs（本地）+ git2_remote.rs（网络）。测试注入 MockGitBackend。
/// token 由 Service 层从本地加密存储读出后传入，Repository 不关心持久化方式。
pub trait GitBackend: Send + Sync {
    fn is_git_repo(&self, path: &str) -> Result<bool, AppError>;
    /// HTTPS clone，凭证回调使用 x-access-token
    fn clone_repo(&self, url: &str, dest: &Path, token: &str) -> Result<(), AppError>;
    /// 验证远端可达且凭证有效（只读探测，clone 前置校验）
    fn ls_remote(&self, url: &str, token: &str) -> Result<(), AppError>;
    /// 提交全部变更；无变更返回 None，有则返回 commit id
    fn commit_all(&self, path: &str, message: &str) -> Result<Option<String>, AppError>;
    /// 契约保留项：独立 fetch（当前仅被 pull 内部复用，暂无单独 Command）
    #[allow(dead_code)]
    fn fetch(&self, path: &str, token: &str) -> Result<(), AppError>;
    /// fetch + merge origin/<当前分支>；冲突时返回 AppError::Conflict 并保留 MERGE_HEAD
    fn pull(&self, path: &str, token: &str) -> Result<(), AppError>;
    fn push(&self, path: &str, token: &str) -> Result<(), AppError>;
    /// 相对 origin/<当前分支> 的 (ahead, behind)；无上游时 behind=0
    fn ahead_behind(&self, path: &str) -> Result<(u32, u32), AppError>;
    fn has_uncommitted(&self, path: &str) -> Result<bool, AppError>;
    fn is_merging(&self, path: &str) -> Result<bool, AppError>;
    /// 以本地侧解决全部冲突并完成 merge commit
    fn resolve_conflict_ours(&self, path: &str) -> Result<(), AppError>;
    /// 以远端侧解决全部冲突并完成 merge commit
    fn resolve_conflict_theirs(&self, path: &str) -> Result<(), AppError>;
    /// 读取当前合并冲突文件（path + 本地/远端内容），供三栏合并（P1-3）
    fn conflict_files(&self, path: &str) -> Result<Vec<ConflictFile>, AppError>;
    /// 以指定内容解决单个冲突文件并写入 index；返回是否已无冲突
    fn resolve_conflict_file(&self, path: &str, rel: &str, content: &str) -> Result<bool, AppError>;
    /// index 已无冲突时完成 merge commit（双父 HEAD + MERGE_HEAD）
    fn complete_merge(&self, path: &str, message: &str) -> Result<(), AppError>;
    /// 指定文件（相对仓库根）的提交历史，仅含修改过该文件的提交，按时间倒序
    fn file_history(&self, path: &str, file: &str, limit: usize) -> Result<Vec<CommitInfo>, AppError>;
    /// 选中提交相对其父提交的单文件 diff
    fn file_diff(&self, path: &str, file: &str, commit_id: &str) -> Result<FileDiff, AppError>;
    /// 把文件恢复到指定提交的版本（写入工作区，不提交）
    fn restore_file(&self, path: &str, file: &str, commit_id: &str) -> Result<(), AppError>;
}

/// 测试用 Mock：通过字段编排行为，calls 记录调用序列。
#[cfg(test)]
#[derive(Default)]
pub struct MockGitBackend {
    pub is_repo: bool,
    pub uncommitted: bool,
    pub merging: bool,
    pub ahead: u32,
    pub behind: u32,
    pub conflict_on_pull: bool,
    pub conflicts: Vec<ConflictFile>,
    pub all_resolved_after_file: bool,
    pub calls: std::sync::Mutex<Vec<String>>,
}

#[cfg(test)]
impl MockGitBackend {
    fn record(&self, entry: String) {
        self.calls.lock().unwrap().push(entry);
    }

    pub fn recorded(&self) -> Vec<String> {
        self.calls.lock().unwrap().clone()
    }
}

#[cfg(test)]
impl GitBackend for MockGitBackend {
    fn is_git_repo(&self, _path: &str) -> Result<bool, AppError> {
        Ok(self.is_repo)
    }

    fn clone_repo(&self, url: &str, _dest: &Path, _token: &str) -> Result<(), AppError> {
        self.record(format!("clone:{url}"));
        Ok(())
    }

    fn ls_remote(&self, url: &str, _token: &str) -> Result<(), AppError> {
        self.record(format!("ls_remote:{url}"));
        Ok(())
    }

    fn commit_all(&self, _path: &str, message: &str) -> Result<Option<String>, AppError> {
        self.record(format!("commit:{message}"));
        Ok(self.uncommitted.then(|| "mock-commit-id".to_string()))
    }

    fn fetch(&self, _path: &str, _token: &str) -> Result<(), AppError> {
        self.record("fetch".into());
        Ok(())
    }

    fn pull(&self, _path: &str, _token: &str) -> Result<(), AppError> {
        self.record("pull".into());
        if self.conflict_on_pull {
            return Err(AppError::Conflict("mock conflict".into()));
        }
        Ok(())
    }

    fn push(&self, _path: &str, _token: &str) -> Result<(), AppError> {
        self.record("push".into());
        Ok(())
    }

    fn ahead_behind(&self, _path: &str) -> Result<(u32, u32), AppError> {
        Ok((self.ahead, self.behind))
    }

    fn has_uncommitted(&self, _path: &str) -> Result<bool, AppError> {
        Ok(self.uncommitted)
    }

    fn is_merging(&self, _path: &str) -> Result<bool, AppError> {
        Ok(self.merging)
    }

    fn resolve_conflict_ours(&self, _path: &str) -> Result<(), AppError> {
        self.record("resolve:ours".into());
        Ok(())
    }

    fn resolve_conflict_theirs(&self, _path: &str) -> Result<(), AppError> {
        self.record("resolve:theirs".into());
        Ok(())
    }

    fn conflict_files(&self, _path: &str) -> Result<Vec<ConflictFile>, AppError> {
        self.record("conflicts".into());
        Ok(self.conflicts.clone())
    }

    fn resolve_conflict_file(&self, _path: &str, rel: &str, _content: &str) -> Result<bool, AppError> {
        self.record(format!("resolve_file:{rel}"));
        Ok(self.all_resolved_after_file)
    }

    fn complete_merge(&self, _path: &str, _message: &str) -> Result<(), AppError> {
        self.record("complete_merge".into());
        Ok(())
    }

    fn file_history(&self, _path: &str, file: &str, _limit: usize) -> Result<Vec<CommitInfo>, AppError> {
        self.record(format!("history:{file}"));
        Ok(vec![CommitInfo {
            id: "a1b2c3d4".into(),
            short_id: "a1b2c3d".into(),
            message: "mock commit".into(),
            author: "mock".into(),
            timestamp: 1,
        }])
    }

    fn file_diff(&self, _path: &str, file: &str, commit_id: &str) -> Result<FileDiff, AppError> {
        self.record(format!("diff:{file}@{commit_id}"));
        Ok(FileDiff {
            path: file.into(),
            commit_id: commit_id.into(),
            lines: vec![],
        })
    }

    fn restore_file(&self, _path: &str, file: &str, commit_id: &str) -> Result<(), AppError> {
        self.record(format!("restore:{file}@{commit_id}"));
        Ok(())
    }
}

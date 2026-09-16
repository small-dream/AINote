use std::path::Path;

use crate::domain::error::AppError;
use crate::domain::history_reset::{RebuiltCommit, RepoSnapshot};
use crate::domain::remote::RemoteCredential;

/// 历史重置能力抽象（与 GitBackend / RepoMaintenanceBackend 隔离，避免继续膨胀）。
/// 实现：git2_rewrite.rs；测试注入 Mock。
///
/// 这是唯一会「物理丢弃 Git 对象」的能力，因此实现必须保证失败可回滚：
/// 旧 `.git` 先移出为备份，重建或推送失败时原样还原，只有全部成功后才删除备份。
pub trait RepoRewriteBackend: Send + Sync {
    /// 只读：读取仓库快照并完成前置校验（非 Clean 状态直接报错），
    /// 同时自愈上一次执行残留的备份目录。
    fn snapshot(&self, repo_path: &Path) -> Result<RepoSnapshot, AppError>;

    /// 破坏性：把旧 `.git` 移出为备份 → 重新初始化 → 以工作区现状建立唯一一次提交。
    fn rebuild(
        &self,
        repo_path: &Path,
        message: &str,
        snapshot: &RepoSnapshot,
    ) -> Result<RebuiltCommit, AppError>;

    /// 只读探测远端可达性与凭证：破坏性操作前的最后一道校验，避免无谓的重建。
    fn verify_remote(&self, url: &str, cred: &RemoteCredential) -> Result<(), AppError>;

    /// 强制推送当前分支：历史被重写后唯一可行的推送方式（远端旧提交已不在本地）。
    fn force_push(&self, repo_path: &Path, cred: &RemoteCredential) -> Result<(), AppError>;

    /// 回滚：删除重建出的 `.git`，把备份还原为 `.git`。
    fn restore_backup(&self, repo_path: &Path) -> Result<(), AppError>;

    /// 成功收尾：删除备份目录，旧对象就此物理消失。
    fn discard_backup(&self, repo_path: &Path) -> Result<(), AppError>;
}

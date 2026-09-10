use std::path::Path;

use crate::domain::error::AppError;
use crate::domain::maintenance::IntegrityIssue;

/// 仓库维护能力抽象（与 GitBackend 隔离，避免继续膨胀）。
/// 实现：git2_maintenance.rs；测试注入 Mock。
pub trait RepoMaintenanceBackend: Send + Sync {
    /// 只读检查仓库完整性，返回问题列表（健康仓库为空）。
    fn check_integrity(&self, repo_path: &Path) -> Result<Vec<IntegrityIssue>, AppError>;
}

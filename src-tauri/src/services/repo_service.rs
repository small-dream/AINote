use crate::domain::error::AppError;
use crate::repositories::git_backend::{Git2Backend, GitBackend};

/// 用例：校验路径是否为可用的 Git 仓库（P0-1 绑定前置校验）
pub fn validate_repo(repo_path: &str) -> Result<bool, AppError> {
    Git2Backend.is_git_repo(repo_path)
}

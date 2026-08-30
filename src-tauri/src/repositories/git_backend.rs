use crate::domain::error::AppError;

/// Git 能力抽象（防腐化关键：Service 只依赖此 trait，不依赖 git2）。
/// 实现：git2_backend.rs（libgit2）。测试注入 Mock。
pub trait GitBackend: Send + Sync {
    fn is_git_repo(&self, path: &str) -> Result<bool, AppError>;
    // 后续迭代：commit / pull / push / status / history
}

pub struct Git2Backend;

impl GitBackend for Git2Backend {
    fn is_git_repo(&self, path: &str) -> Result<bool, AppError> {
        Ok(git2::Repository::discover(path).is_ok())
    }
}

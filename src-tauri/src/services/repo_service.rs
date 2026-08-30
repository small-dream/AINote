use std::path::Path;

use crate::domain::error::AppError;
use crate::repositories::git_backend::GitBackend;

use super::github_api;

/// 用例：校验路径是否为可用的 Git 仓库（P0-1 绑定前置校验）
pub fn validate_repo<B: GitBackend>(backend: &B, repo_path: &str) -> Result<bool, AppError> {
    backend.is_git_repo(repo_path)
}

/// 用例：绑定远端仓库 —— 先 ls_remote 探测可达性与凭证，再 clone 到 dest。
/// dest 已存在时报 REPO_3001，避免覆盖用户数据。
pub fn bind_repo<B: GitBackend>(
    backend: &B,
    url: &str,
    dest: &Path,
    token: &str,
) -> Result<String, AppError> {
    if dest.exists() {
        return Err(AppError::Repo(format!(
            "目标目录已存在: {}",
            dest.display()
        )));
    }
    backend.ls_remote(url, token)?;
    backend.clone_repo(url, dest, token)?;
    Ok(dest.to_string_lossy().into_owned())
}

/// 用例：在 GitHub 建仓后走绑定流程，返回本地路径。
pub fn create_and_bind_repo<B: GitBackend>(
    backend: &B,
    token: &str,
    name: &str,
    is_private: bool,
    dest: &Path,
) -> Result<String, AppError> {
    if name.trim().is_empty() {
        return Err(AppError::Repo("仓库名不能为空".into()));
    }
    let url = github_api::create_repo(token, name, is_private)?;
    bind_repo(backend, &url, dest, token)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::repositories::git_backend::MockGitBackend;

    #[test]
    fn bind_rejects_existing_dest() {
        let tmp = tempfile::tempdir().unwrap();
        let err = bind_repo(&MockGitBackend::default(), "u", tmp.path(), "t").unwrap_err();
        assert!(matches!(err, AppError::Repo(_)));
    }

    #[test]
    fn bind_probes_then_clones() {
        let tmp = tempfile::tempdir().unwrap();
        let dest = tmp.path().join("notes");
        let mock = MockGitBackend::default();
        let path = bind_repo(&mock, "https://x/y.git", &dest, "tok").unwrap();
        assert_eq!(path, dest.to_string_lossy());
        assert_eq!(
            mock.recorded(),
            vec!["ls_remote:https://x/y.git", "clone:https://x/y.git"]
        );
    }

    #[test]
    fn create_rejects_empty_name() {
        let tmp = tempfile::tempdir().unwrap();
        let dest = tmp.path().join("notes");
        let err =
            create_and_bind_repo(&MockGitBackend::default(), "t", "  ", true, &dest).unwrap_err();
        assert!(matches!(err, AppError::Repo(_)));
    }
}

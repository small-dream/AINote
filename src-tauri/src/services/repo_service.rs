use std::path::Path;

use crate::domain::error::AppError;
use crate::repositories::git_backend::GitBackend;

use super::github_api;

/// 用例：校验路径是否为可用的 Git 仓库（P0-1 绑定前置校验）
pub fn validate_repo<B: GitBackend>(backend: &B, repo_path: &str) -> Result<bool, AppError> {
    backend.is_git_repo(repo_path)
}

/// 用例：统计当前 Git 仓库的本地磁盘占用。
pub fn repo_size<B: GitBackend>(backend: &B, repo_path: &str) -> Result<u64, AppError> {
    if !backend.is_git_repo(repo_path)? {
        return Err(AppError::Repo("当前路径不是可用的 Git 仓库".into()));
    }
    crate::repositories::repo_size::repo_size(Path::new(repo_path))
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

/// 用例：在 GitHub 建仓后走绑定流程，返回 (本地路径, 远端 URL)。
pub fn create_and_bind_repo<B: GitBackend>(
    backend: &B,
    token: &str,
    name: &str,
    is_private: bool,
    dest: &Path,
) -> Result<(String, String), AppError> {
    if name.trim().is_empty() {
        return Err(AppError::Repo("仓库名不能为空".into()));
    }
    let url = github_api::create_repo(token, name, is_private)?;
    let path = bind_repo(backend, &url, dest, token)?;
    Ok((path, url))
}

/// 纯函数：从 URL / 名称推导展示名 —— 取最后一段路径并去掉 `.git` 后缀。
pub fn derive_name(seed: &str) -> String {
    let trimmed = seed.trim();
    if trimmed.is_empty() {
        return "notes".to_string();
    }
    let seg = trimmed.rsplit(['/', '\\']).next().unwrap_or(trimmed);
    let seg = seg.strip_suffix(".git").unwrap_or(seg).trim();
    if seg.is_empty() {
        "notes".to_string()
    } else {
        seg.to_string()
    }
}

/// 纯函数：生成唯一克隆目录 `notes_dir/<slug>`，冲突时追加 `-2`/`-3`…（确定性、可单测）。
pub fn unique_clone_dir(notes_dir: &Path, seed: &str) -> Result<std::path::PathBuf, AppError> {
    let base = slugify(seed);
    let mut candidate = notes_dir.join(&base);
    let mut n = 2u32;
    while candidate.exists() {
        candidate = notes_dir.join(format!("{base}-{n}"));
        n += 1;
    }
    Ok(candidate)
}

fn slugify(seed: &str) -> String {
    let mut slug: String = seed
        .chars()
        .map(|c| {
            if c.is_alphanumeric() {
                c.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect();
    while slug.contains("--") {
        slug = slug.replace("--", "-");
    }
    let slug = slug.trim_matches('-').to_string();
    if slug.is_empty() {
        "notes".to_string()
    } else {
        slug
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::repositories::git_backend::MockGitBackend;

    #[test]
    fn repo_size_rejects_non_git_path() {
        let backend = MockGitBackend::default();
        assert!(repo_size(&backend, "/tmp/missing").is_err());
    }

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

    #[test]
    fn derive_name_strips_git_suffix_and_path() {
        assert_eq!(derive_name("https://github.com/u/my-notes.git"), "my-notes");
        assert_eq!(derive_name("  daily/工作  "), "工作");
        assert_eq!(derive_name("  "), "notes");
    }

    #[test]
    fn unique_clone_dir_appends_suffix_on_collision() {
        let tmp = tempfile::tempdir().unwrap();
        let first = unique_clone_dir(tmp.path(), "My Notes").unwrap();
        std::fs::create_dir_all(&first).unwrap();
        let second = unique_clone_dir(tmp.path(), "My Notes").unwrap();
        assert_eq!(first, tmp.path().join("my-notes"));
        assert_eq!(second, tmp.path().join("my-notes-2"));
    }
}

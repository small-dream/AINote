use std::path::Path;

use git2::{Repository, Signature, StatusOptions};

use crate::domain::error::AppError;

use super::git_backend::GitBackend;
use super::git2_remote;

/// libgit2 实现的本地操作；网络操作委托给 git2_remote。
pub struct Git2Backend;

pub(crate) fn to_git(err: git2::Error) -> AppError {
    AppError::Git(err.message().to_string())
}

pub(crate) fn open(path: &str) -> Result<Repository, AppError> {
    Repository::open(path).map_err(to_git)
}

/// 提交签名：优先读仓库 config，缺省回退到应用内置身份。
pub(crate) fn signature(repo: &Repository) -> Result<Signature<'static>, AppError> {
    let cfg = repo.config().map_err(to_git)?;
    let name = cfg.get_string("user.name").unwrap_or_else(|_| "MyNote".into());
    let email = cfg
        .get_string("user.email")
        .unwrap_or_else(|_| "mynote@localhost".into());
    Signature::now(&name, &email).map_err(to_git)
}

/// 当前分支 shorthand（如 "main"）。
pub(crate) fn current_branch(repo: &Repository) -> Result<String, AppError> {
    let head = repo.head().map_err(to_git)?;
    head.shorthand()
        .map(str::to_owned)
        .ok_or_else(|| AppError::Git("HEAD 不是有效分支引用".into()))
}

fn commit_all(repo_path: &str, message: &str) -> Result<Option<String>, AppError> {
    let repo = open(repo_path)?;
    if !has_uncommitted(&repo)? {
        return Ok(None);
    }
    let mut index = repo.index().map_err(to_git)?;
    index
        .add_all(["*"], git2::IndexAddOption::DEFAULT, None)
        .map_err(to_git)?;
    index.write().map_err(to_git)?;
    let tree = repo.find_tree(index.write_tree().map_err(to_git)?).map_err(to_git)?;
    let sig = signature(&repo)?;
    let parents = parents_of(&repo)?;
    let parent_refs: Vec<&git2::Commit> = parents.iter().collect();
    let oid = repo
        .commit(Some("HEAD"), &sig, &sig, message, &tree, &parent_refs)
        .map_err(to_git)?;
    Ok(Some(oid.to_string()))
}

fn parents_of(repo: &Repository) -> Result<Vec<git2::Commit<'_>>, AppError> {
    match repo.head() {
        Ok(head) => Ok(vec![head.peel_to_commit().map_err(to_git)?]),
        Err(_) => Ok(vec![]), // unborn HEAD：首个提交无父
    }
}

fn has_uncommitted(repo: &Repository) -> Result<bool, AppError> {
    let mut opts = StatusOptions::new();
    opts.include_untracked(true);
    Ok(!repo.statuses(Some(&mut opts)).map_err(to_git)?.is_empty())
}

fn ahead_behind(repo_path: &str) -> Result<(u32, u32), AppError> {
    let repo = open(repo_path)?;
    let local = match repo.head().and_then(|h| h.peel_to_commit()) {
        Ok(c) => c.id(),
        Err(_) => return Ok((0, 0)),
    };
    let upstream = format!("refs/remotes/origin/{}", current_branch(&repo)?);
    match repo.refname_to_id(&upstream) {
        Ok(remote) => {
            let (a, b) = repo.graph_ahead_behind(local, remote).map_err(to_git)?;
            Ok((a as u32, b as u32))
        }
        Err(_) => count_all_commits(&repo, local).map(|n| (n, 0)),
    }
}

fn count_all_commits(repo: &Repository, from: git2::Oid) -> Result<u32, AppError> {
    let mut walk = repo.revwalk().map_err(to_git)?;
    walk.push(from).map_err(to_git)?;
    Ok(walk.count() as u32)
}

impl GitBackend for Git2Backend {
    fn is_git_repo(&self, path: &str) -> Result<bool, AppError> {
        Ok(Repository::discover(path).is_ok())
    }

    fn clone_repo(&self, url: &str, dest: &Path, token: &str) -> Result<(), AppError> {
        git2_remote::clone_repo(url, dest, token)
    }

    fn ls_remote(&self, url: &str, token: &str) -> Result<(), AppError> {
        git2_remote::ls_remote(url, token)
    }

    fn commit_all(&self, path: &str, message: &str) -> Result<Option<String>, AppError> {
        commit_all(path, message)
    }

    fn fetch(&self, path: &str, token: &str) -> Result<(), AppError> {
        git2_remote::fetch(path, token)
    }

    fn pull(&self, path: &str, token: &str) -> Result<(), AppError> {
        git2_remote::pull(path, token)
    }

    fn push(&self, path: &str, token: &str) -> Result<(), AppError> {
        git2_remote::push(path, token)
    }

    fn ahead_behind(&self, path: &str) -> Result<(u32, u32), AppError> {
        ahead_behind(path)
    }

    fn has_uncommitted(&self, path: &str) -> Result<bool, AppError> {
        has_uncommitted(&open(path)?)
    }

    fn is_merging(&self, path: &str) -> Result<bool, AppError> {
        Ok(open(path)?.state() == git2::RepositoryState::Merge)
    }

    fn resolve_conflict_ours(&self, path: &str) -> Result<(), AppError> {
        git2_remote::resolve_conflicts(path, true)
    }

    fn resolve_conflict_theirs(&self, path: &str) -> Result<(), AppError> {
        git2_remote::resolve_conflicts(path, false)
    }
}

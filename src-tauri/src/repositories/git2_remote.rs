use std::path::{Path, PathBuf};

use git2::{
    build::{CheckoutBuilder, RepoBuilder},
    AnnotatedCommit, Cred, FetchOptions, PushOptions, RemoteCallbacks, Repository,
};

use crate::domain::error::AppError;

use super::git2_backend::{current_branch, open, signature, to_git};

fn callbacks(token: &str) -> RemoteCallbacks<'static> {
    let token = token.to_owned();
    let mut cb = RemoteCallbacks::new();
    cb.credentials(move |_url, _user, _allowed| {
        Cred::userpass_plaintext("x-access-token", &token)
    });
    cb
}

fn fetch_options(token: &str) -> FetchOptions<'static> {
    let mut fo = FetchOptions::new();
    fo.remote_callbacks(callbacks(token));
    fo
}

pub fn clone_repo(url: &str, dest: &Path, token: &str) -> Result<(), AppError> {
    RepoBuilder::new()
        .fetch_options(fetch_options(token))
        .clone(url, dest)
        .map_err(to_git)?;
    Ok(())
}

/// 只读探测远端：能列出引用即视为可达且凭证有效。
pub fn ls_remote(url: &str, token: &str) -> Result<(), AppError> {
    let mut remote = git2::Remote::create_detached(url).map_err(to_git)?;
    remote
        .connect_auth(git2::Direction::Fetch, Some(callbacks(token)), None)
        .map_err(to_git)?;
    remote.list().map_err(to_git)?;
    remote.disconnect().map_err(to_git)?;
    Ok(())
}

pub fn fetch(path: &str, token: &str) -> Result<(), AppError> {
    let repo = open(path)?;
    let mut remote = repo.find_remote("origin").map_err(to_git)?;
    remote
        .fetch(&[] as &[&str], Some(&mut fetch_options(token)), None)
        .map_err(to_git)
}

pub fn push(path: &str, token: &str) -> Result<(), AppError> {
    let repo = open(path)?;
    let branch = current_branch(&repo)?;
    let refspec = format!("refs/heads/{branch}:refs/heads/{branch}");
    let mut po = PushOptions::new();
    po.remote_callbacks(callbacks(token));
    let mut remote = repo.find_remote("origin").map_err(to_git)?;
    remote.push(&[refspec], Some(&mut po)).map_err(to_git)
}

pub fn pull(path: &str, token: &str) -> Result<(), AppError> {
    fetch(path, token)?;
    let repo = open(path)?;
    let branch = current_branch(&repo)?;
    let remote_ref = format!("refs/remotes/origin/{branch}");
    let their_oid = match repo.refname_to_id(&remote_ref) {
        Ok(oid) => oid,
        Err(_) => return Ok(()), // 远端无此分支（空仓库首次同步），无内容可合并
    };
    let their = repo.find_annotated_commit(their_oid).map_err(to_git)?;
    let (analysis, _) = repo.merge_analysis(&[&their]).map_err(to_git)?;
    if analysis.is_up_to_date() {
        return Ok(());
    }
    if analysis.is_fast_forward() {
        return fast_forward(&repo, &branch, their_oid);
    }
    merge_or_conflict(&repo, &their)
}

fn fast_forward(repo: &Repository, branch: &str, target: git2::Oid) -> Result<(), AppError> {
    repo.find_reference(&format!("refs/heads/{branch}"))
        .map_err(to_git)?
        .set_target(target, "fast-forward")
        .map_err(to_git)?;
    repo.checkout_head(Some(CheckoutBuilder::new().force()))
        .map_err(to_git)
}

fn merge_or_conflict(repo: &Repository, their: &AnnotatedCommit) -> Result<(), AppError> {
    repo.merge(&[their], None, None).map_err(to_git)?;
    let index = repo.index().map_err(to_git)?;
    if index.has_conflicts() {
        return Err(AppError::Conflict("pull 产生冲突，请解决后重试".into()));
    }
    commit_merge(repo, "note: merge remote changes")
}

/// 冲突解决：use_ours=true 保留本地侧，否则采用远端侧；随后完成 merge commit。
pub fn resolve_conflicts(path: &str, use_ours: bool) -> Result<(), AppError> {
    let repo = open(path)?;
    let mut index = repo.index().map_err(to_git)?;
    let conflicted = conflict_paths(&repo)?;
    for rel in conflicted {
        let mut cb = CheckoutBuilder::new();
        cb.path(&rel).force();
        if use_ours {
            cb.use_ours(true);
        } else {
            cb.use_theirs(true);
        }
        repo.checkout_index(Some(&mut index), Some(&mut cb))
            .map_err(to_git)?;
        index.add_path(&rel).map_err(to_git)?;
    }
    index.write().map_err(to_git)?;
    commit_merge(&repo, "note: resolve conflict")
}

fn conflict_paths(repo: &Repository) -> Result<Vec<PathBuf>, AppError> {
    let mut paths = Vec::new();
    for conflict in repo.index().map_err(to_git)?.conflicts().map_err(to_git)? {
        let entry = conflict.map_err(to_git)?;
        let raw = entry.our.or(entry.their).or(entry.ancestor).map(|e| e.path);
        if let Some(bytes) = raw {
            paths.push(PathBuf::from(String::from_utf8_lossy(&bytes).into_owned()));
        }
    }
    Ok(paths)
}

/// 用当前 index 完成合并提交（双父：HEAD + MERGE_HEAD），并清理 merge 状态。
fn commit_merge(repo: &Repository, message: &str) -> Result<(), AppError> {
    let mut index = repo.index().map_err(to_git)?;
    let tree = repo
        .find_tree(index.write_tree().map_err(to_git)?)
        .map_err(to_git)?;
    let sig = signature(repo)?;
    let head = repo.head().map_err(to_git)?.peel_to_commit().map_err(to_git)?;
    let their = repo
        .find_commit(read_merge_head(repo)?)
        .map_err(to_git)?;
    repo.commit(Some("HEAD"), &sig, &sig, message, &tree, &[&head, &their])
        .map_err(to_git)?;
    repo.cleanup_state().map_err(to_git)
}

fn read_merge_head(repo: &Repository) -> Result<git2::Oid, AppError> {
    let content = std::fs::read_to_string(repo.path().join("MERGE_HEAD"))?;
    git2::Oid::from_str(content.trim()).map_err(to_git)
}
#[cfg(test)]
#[path = "git2_remote_tests.rs"]
mod tests;

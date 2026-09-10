use git2::{Delta, Repository, Sort};

use crate::domain::error::AppError;
use crate::domain::history::RepoCommit;
use crate::domain::sync::{ChangedFile, ChangedFileStatus};

use super::git2_backend::{open, to_git};

/// 全仓提交历史（含每 commit 直接改动的文件），覆盖所有分支与 HEAD，按时间倒序。
/// 遍历到 limit 条即停；`limit=0` 视为 1，防止空游标。
pub fn repo_history(repo_path: &str, limit: usize) -> Result<Vec<RepoCommit>, AppError> {
    let repo = open(repo_path)?;
    let mut walk = repo.revwalk().map_err(to_git)?;
    walk.set_sorting(Sort::TIME | Sort::TOPOLOGICAL)
        .map_err(to_git)?;
    if repo.head().is_ok() {
        walk.push_head().map_err(to_git)?;
    }
    walk.push_glob("refs/heads/*").map_err(to_git)?;
    let limit = limit.max(1);
    let mut out = Vec::new();
    for oid in walk {
        let commit = repo.find_commit(oid.map_err(to_git)?).map_err(to_git)?;
        out.push(to_repo_commit(&repo, &commit)?);
        if out.len() >= limit {
            break;
        }
    }
    Ok(out)
}

fn to_repo_commit(repo: &Repository, commit: &git2::Commit<'_>) -> Result<RepoCommit, AppError> {
    let tree = commit.tree().map_err(to_git)?;
    let parent_tree = match commit.parent(0) {
        Ok(parent) => Some(parent.tree().map_err(to_git)?),
        Err(_) => None,
    };
    let parents = (0..commit.parent_count())
        .filter_map(|index| commit.parent_id(index).ok().map(|id| id.to_string()))
        .collect();
    Ok(RepoCommit {
        id: commit.id().to_string(),
        short_id: commit.id().to_string().chars().take(7).collect(),
        message: commit
            .message()
            .unwrap_or_default()
            .lines()
            .next()
            .unwrap_or_default()
            .trim()
            .to_string(),
        author: commit.author().name().unwrap_or_default().to_string(),
        timestamp: commit.time().seconds().max(0) as u64,
        parents,
        files: changed_paths(repo, parent_tree.as_ref(), &tree)?,
    })
}

/// 提交相对其首父树的直接改动文件；删除文件取 old path，其余取 new path。
fn changed_paths(
    repo: &Repository,
    parent_tree: Option<&git2::Tree<'_>>,
    tree: &git2::Tree<'_>,
) -> Result<Vec<ChangedFile>, AppError> {
    let mut opts = git2::DiffOptions::new();
    let diff = repo
        .diff_tree_to_tree(parent_tree, Some(tree), Some(&mut opts))
        .map_err(to_git)?;
    let mut files = Vec::new();
    diff.foreach(
        &mut |delta, _score| {
            if let Some(path) = delta
                .new_file()
                .path()
                .or_else(|| delta.old_file().path())
            {
                files.push(ChangedFile {
                    path: path.to_string_lossy().to_string(),
                    status: delta_status(delta.status()),
                });
            }
            true
        },
        None,
        None,
        None,
    )
    .map_err(to_git)?;
    Ok(files)
}

fn delta_status(delta: Delta) -> ChangedFileStatus {
    match delta {
        Delta::Added => ChangedFileStatus::Added,
        Delta::Deleted => ChangedFileStatus::Deleted,
        _ => ChangedFileStatus::Modified,
    }
}

#[cfg(test)]
#[path = "git2_graph_tests.rs"]
mod git2_graph_tests;

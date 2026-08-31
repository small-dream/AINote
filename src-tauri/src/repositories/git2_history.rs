use std::path::Path;
use std::path::PathBuf;

use git2::{Repository, Sort};

use crate::domain::error::AppError;
use crate::domain::history::{CommitInfo, DiffLine, DiffLineKind, FileDiff};

use super::git2_backend::{open, to_git};

/// 指定文件（相对仓库根）的提交历史：仅含修改过该文件的提交，按时间倒序。
pub fn file_history(repo_path: &str, file: &str, limit: usize) -> Result<Vec<CommitInfo>, AppError> {
    let repo = open(repo_path)?;
    let mut walk = repo.revwalk().map_err(to_git)?;
    walk.set_sorting(Sort::TIME | Sort::TOPOLOGICAL).map_err(to_git)?;
    walk.push_head().map_err(to_git)?;
    let mut out = Vec::new();
    for oid in walk {
        let commit = repo.find_commit(oid.map_err(to_git)?).map_err(to_git)?;
        if !commit_changed_file(&repo, &commit, file)? {
            continue;
        }
        out.push(to_commit_info(&commit));
        if out.len() >= limit {
            break;
        }
    }
    Ok(out)
}

/// 选中提交相对其父提交的单文件 diff。
pub fn file_diff(repo_path: &str, file: &str, commit_id: &str) -> Result<FileDiff, AppError> {
    let repo = open(repo_path)?;
    let commit = find_commit(&repo, commit_id)?;
    let tree = commit.tree().map_err(to_git)?;
    let parent_tree = match commit.parent(0) {
        Ok(parent) => Some(parent.tree().map_err(to_git)?),
        Err(_) => None,
    };
    let mut opts = git2::DiffOptions::new();
    opts.pathspec(file);
    let diff = repo
        .diff_tree_to_tree(parent_tree.as_ref(), Some(&tree), Some(&mut opts))
        .map_err(to_git)?;
    Ok(FileDiff {
        path: file.to_string(),
        commit_id: commit.id().to_string(),
        lines: collect_diff_lines(diff)?,
    })
}

/// 把文件恢复到指定提交的版本（写入工作区，不自动提交）。
pub fn restore_file(repo_path: &str, file: &str, commit_id: &str) -> Result<(), AppError> {
    let repo = open(repo_path)?;
    let commit = find_commit(&repo, commit_id)?;
    let entry = commit
        .tree()
        .map_err(to_git)?
        .get_path(Path::new(file))
        .map_err(|_| AppError::Git(format!("提交中不存在该文件: {file}")))?;
    let blob = entry
        .to_object(&repo)
        .map_err(to_git)?
        .peel_to_blob()
        .map_err(to_git)?;
    let dest = PathBuf::from(repo_path).join(file);
    Ok(std::fs::write(dest, blob.content())?)
}

fn find_commit<'a>(repo: &'a Repository, commit_id: &str) -> Result<git2::Commit<'a>, AppError> {
    repo.revparse_single(commit_id)
        .map_err(to_git)?
        .peel_to_commit()
        .map_err(to_git)
}

/// 提交是否修改过指定文件（比较其与首父提交的 blob）。
fn commit_changed_file(
    repo: &Repository,
    commit: &git2::Commit,
    file: &str,
) -> Result<bool, AppError> {
    let tree = commit.tree().map_err(to_git)?;
    let parent_tree = match commit.parent(0) {
        Ok(parent) => parent.tree().map_err(to_git)?,
        Err(_) => return Ok(tree.get_path(Path::new(file)).is_ok()),
    };
    Ok(blob_in_tree(repo, &parent_tree, file)? != blob_in_tree(repo, &tree, file)?)
}

fn blob_in_tree(repo: &Repository, tree: &git2::Tree, file: &str) -> Result<Option<Vec<u8>>, AppError> {
    let entry = match tree.get_path(Path::new(file)) {
        Ok(entry) => entry,
        Err(_) => return Ok(None),
    };
    let blob = entry.to_object(repo).map_err(to_git)?.peel_to_blob().map_err(to_git)?;
    Ok(Some(blob.content().to_vec()))
}

fn to_commit_info(commit: &git2::Commit) -> CommitInfo {
    let id = commit.id().to_string();
    CommitInfo {
        id: id.clone(),
        short_id: id.chars().take(7).collect(),
        message: first_line(commit.message().unwrap_or_default()),
        author: commit.author().name().unwrap_or_default().to_string(),
        timestamp: commit.time().seconds().max(0) as u64,
    }
}

fn first_line(text: &str) -> String {
    text.lines().next().unwrap_or_default().trim().to_string()
}

fn collect_diff_lines(diff: git2::Diff) -> Result<Vec<DiffLine>, AppError> {
    let mut lines = Vec::new();
    diff.foreach(
        &mut |_delta, _score| true,
        Some(&mut |_delta, _binary| true),
        Some(&mut |_delta, _hunk| true),
        Some(&mut |_delta, _hunk, line| {
            let kind = match line.origin() {
                '+' => DiffLineKind::Added,
                '-' => DiffLineKind::Removed,
                _ => DiffLineKind::Context,
            };
            let text = String::from_utf8_lossy(line.content())
                .trim_end_matches('\n')
                .to_string();
            lines.push(DiffLine { kind, text });
            true
        }),
    )
    .map_err(to_git)?;
    Ok(lines)
}

#[cfg(test)]
#[path = "git2_history_tests.rs"]
mod git2_history_tests;

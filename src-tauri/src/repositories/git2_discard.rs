use std::fs;
use std::path::Path;

use git2::{ObjectType, Repository, Tree};

use crate::domain::discard::DiscardReport;
use crate::domain::error::AppError;

use super::git2_backend::{open, to_git};

/// 丢弃指定路径的本地改动：HEAD 中存在该路径则把该版本写回工作区并同步 index，
/// 否则（新增文件，没有可恢复的历史版本）直接删除工作区文件。
///
/// 纯本地操作，不读任何历史 blob（加密笔记与普通文件同规则）。
/// 路径必须已由 Service 层校验并复核为待提交变更。逐个处理，任一文件写盘失败即中断：
/// 已处理的文件保持已生效状态，未处理的文件原样不动，错误消息里说明已处理数量。
pub fn discard_working(repo_path: &str, files: &[String]) -> Result<DiscardReport, AppError> {
    let repo = open(repo_path)?;
    let head_tree = head_tree(&repo)?;
    let mut index = repo.index().map_err(to_git)?;
    let mut report = DiscardReport::default();
    for file in files {
        match head_blob(&repo, head_tree.as_ref(), file)? {
            Some(content) => {
                restore_worktree(repo_path, file, &content, report.changed_count())?;
                index.add_path(Path::new(file)).map_err(to_git)?;
                report.restored.push(file.clone());
            }
            None => {
                delete_worktree(repo_path, file, report.changed_count())?;
                // 新增文件可能只存在于 index（已 stage 未提交）：移除条目，不在 index 中则忽略
                let _ = index.remove_path(Path::new(file));
                report.deleted.push(file.clone());
            }
        }
    }
    index.write().map_err(to_git)?;
    Ok(report)
}

/// HEAD 树；unborn HEAD（空仓库）返回 None，此时所有文件都按新增处理。
fn head_tree(repo: &Repository) -> Result<Option<Tree<'_>>, AppError> {
    match repo.head() {
        Ok(head) => Ok(Some(head.peel_to_tree().map_err(to_git)?)),
        Err(_) => Ok(None),
    }
}

/// HEAD 中该路径的 blob 内容；路径不存在或不是 blob（目录等）时返回 None。
fn head_blob(
    repo: &Repository,
    tree: Option<&Tree<'_>>,
    file: &str,
) -> Result<Option<Vec<u8>>, AppError> {
    let Some(entry) = tree.and_then(|tree| tree.get_path(Path::new(file)).ok()) else {
        return Ok(None);
    };
    if entry.kind() != Some(ObjectType::Blob) {
        return Ok(None);
    }
    let blob = entry
        .to_object(repo)
        .map_err(to_git)?
        .peel_to_blob()
        .map_err(to_git)?;
    Ok(Some(blob.content().to_vec()))
}

/// 把 HEAD 版本写回工作区（按需补建父目录，二进制原样写回）。
fn restore_worktree(
    repo_path: &str,
    file: &str,
    content: &[u8],
    done: usize,
) -> Result<(), AppError> {
    let dest = Path::new(repo_path).join(file);
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|err| failure("创建目录", file, done, err))?;
    }
    fs::write(&dest, content).map_err(|err| failure("恢复", file, done, err))
}

/// 删除新增文件；文件已不在工作区时视为已完成（幂等）。
fn delete_worktree(repo_path: &str, file: &str, done: usize) -> Result<(), AppError> {
    let dest = Path::new(repo_path).join(file);
    if !dest.is_file() {
        return Ok(());
    }
    fs::remove_file(&dest).map_err(|err| failure("删除", file, done, err))
}

/// 单个文件失败：带上已处理数量，前端据此告知「部分生效、可重试」。
fn failure(action: &str, file: &str, done: usize, err: std::io::Error) -> AppError {
    AppError::Io(format!(
        "{action} {file} 失败（已处理 {done} 个文件，其余未改动，可重试）: {err}"
    ))
}

#[cfg(test)]
#[path = "git2_discard_tests.rs"]
mod git2_discard_tests;

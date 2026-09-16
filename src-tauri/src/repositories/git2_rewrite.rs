use std::fs;
use std::path::{Path, PathBuf};

use git2::{IndexAddOption, Repository, RepositoryInitOptions};

use crate::domain::error::AppError;
use crate::domain::history_reset::{RebuiltCommit, RepoSnapshot};
use crate::domain::remote::RemoteCredential;
use crate::repositories::git_backend::GitBackend;
use crate::repositories::git2_backend::{current_branch, open, signature, to_git, Git2Backend};

use super::git2_remote;
use super::repo_rewrite::RepoRewriteBackend;

/// 旧 `.git` 的暂存目录名（与仓库同级：rename 不跨卷、不落在工作区内）。
/// 带 AINote 前缀以便识别，执行成功后删除。
const BACKUP_PREFIX: &str = ".ainote-git-backup-";

/// 历史重置的 libgit2 + 文件系统实现。
pub struct Git2Rewrite;

impl RepoRewriteBackend for Git2Rewrite {
    fn snapshot(&self, repo_path: &Path) -> Result<RepoSnapshot, AppError> {
        snapshot(repo_path)
    }

    fn rebuild(
        &self,
        repo_path: &Path,
        message: &str,
        snapshot: &RepoSnapshot,
    ) -> Result<RebuiltCommit, AppError> {
        rebuild(repo_path, message, snapshot)
    }

    fn verify_remote(&self, url: &str, cred: &RemoteCredential) -> Result<(), AppError> {
        git2_remote::ls_remote(url, cred)
    }

    fn force_push(&self, repo_path: &Path, cred: &RemoteCredential) -> Result<(), AppError> {
        git2_remote::force_push(&repo_path.to_string_lossy(), cred)
    }

    fn restore_backup(&self, repo_path: &Path) -> Result<(), AppError> {
        restore_backup(repo_path)
    }

    fn discard_backup(&self, repo_path: &Path) -> Result<(), AppError> {
        discard_backup(repo_path)
    }
}

fn snapshot(repo_path: &Path) -> Result<RepoSnapshot, AppError> {
    heal_leftover(repo_path)?;
    let path = repo_path.to_string_lossy();
    let repo = open(&path)?;
    if repo.state() != git2::RepositoryState::Clean {
        return Err(AppError::Repo(
            "仓库处于合并等未完成状态，请先处理后再重置历史".into(),
        ));
    }
    let (ahead, behind) = Git2Backend.ahead_behind(&path)?;
    Ok(RepoSnapshot {
        branch: current_branch(&repo)?,
        remote_url: origin_url(&repo)?,
        ahead,
        behind,
        commits: count_commits(&repo)?,
    })
}

/// 自愈上一次执行留下的备份目录：新 `.git` 存在说明重建已完成（只剩清理），
/// 否则说明重建中途中断，先把备份还原回来让仓库恢复可用。
fn heal_leftover(repo_path: &Path) -> Result<(), AppError> {
    let backup = backup_dir(repo_path)?;
    if !backup.is_dir() {
        return Ok(());
    }
    if repo_path.join(".git").is_dir() {
        fs::remove_dir_all(&backup)?;
        Ok(())
    } else {
        restore_backup_at(repo_path, &backup)
    }
}

fn rebuild(
    repo_path: &Path,
    message: &str,
    snapshot: &RepoSnapshot,
) -> Result<RebuiltCommit, AppError> {
    let git_dir = repo_path.join(".git");
    if !git_dir.is_dir() {
        return Err(AppError::Repo(
            "当前仓库不是标准布局（缺少 .git 目录），git worktree 与子模块暂不支持重置历史".into(),
        ));
    }
    let backup = backup_dir(repo_path)?;
    if backup.exists() {
        return Err(AppError::Repo(format!(
            "存在未清理的重置备份：{}",
            backup.display()
        )));
    }
    fs::rename(&git_dir, &backup)?;
    match build_single_commit(repo_path, message, snapshot) {
        Ok(built) => Ok(built),
        Err(err) => Err(rollback_error(repo_path, &backup, err)),
    }
}

fn build_single_commit(
    repo_path: &Path,
    message: &str,
    snapshot: &RepoSnapshot,
) -> Result<RebuiltCommit, AppError> {
    let mut opts = RepositoryInitOptions::new();
    opts.initial_head(&snapshot.branch).no_reinit(true);
    let repo = Repository::init_opts(repo_path, &opts).map_err(to_git)?;
    if let Some(url) = &snapshot.remote_url {
        repo.remote("origin", url).map_err(to_git)?;
        configure_tracking(&repo, &snapshot.branch)?;
    }
    let commit_id = commit_workdir(&repo, message)?;
    let files = repo.index().map_err(to_git)?.len() as u32;
    Ok(RebuiltCommit { commit_id, files })
}

/// 工作区现状 = 唯一一次提交：索引语义与日常提交（commit_all）一致，
/// 未提交的改动一并纳入，被 `.gitignore` 忽略的文件不进入提交。
fn commit_workdir(repo: &Repository, message: &str) -> Result<String, AppError> {
    let mut index = repo.index().map_err(to_git)?;
    index
        .add_all(["*"], IndexAddOption::DEFAULT, None)
        .map_err(to_git)?;
    index.write().map_err(to_git)?;
    let tree = repo
        .find_tree(index.write_tree().map_err(to_git)?)
        .map_err(to_git)?;
    let sig = signature(repo)?;
    let oid = repo
        .commit(Some("HEAD"), &sig, &sig, message, &tree, &[])
        .map_err(to_git)?;
    Ok(oid.to_string())
}

/// 记录上游跟踪信息，让新仓库在其它 Git 客户端里同样表现正常。
fn configure_tracking(repo: &Repository, branch: &str) -> Result<(), AppError> {
    let mut config = repo.config().map_err(to_git)?;
    config
        .set_str(&format!("branch.{branch}.remote"), "origin")
        .map_err(to_git)?;
    config
        .set_str(
            &format!("branch.{branch}.merge"),
            &format!("refs/heads/{branch}"),
        )
        .map_err(to_git)
}

fn origin_url(repo: &Repository) -> Result<Option<String>, AppError> {
    match repo.find_remote("origin") {
        Ok(remote) => Ok(remote.url().map(str::to_owned)),
        Err(_) => Ok(None),
    }
}

fn count_commits(repo: &Repository) -> Result<u32, AppError> {
    let head = match repo.head().and_then(|head| head.peel_to_commit()) {
        Ok(commit) => commit.id(),
        Err(_) => return Ok(0), // unborn HEAD：空仓库没有历史可清除
    };
    let mut walk = repo.revwalk().map_err(to_git)?;
    walk.push(head).map_err(to_git)?;
    Ok(walk.count() as u32)
}

fn restore_backup(repo_path: &Path) -> Result<(), AppError> {
    let backup = backup_dir(repo_path)?;
    if !backup.is_dir() {
        return Err(AppError::Repo("没有可还原的重置备份".into()));
    }
    restore_backup_at(repo_path, &backup)
}

/// 删除重建出的 `.git` 并还原备份：重建产物刚由本进程创建，删除是安全的。
fn restore_backup_at(repo_path: &Path, backup: &Path) -> Result<(), AppError> {
    let git_dir = repo_path.join(".git");
    if git_dir.exists() {
        fs::remove_dir_all(&git_dir)?;
    }
    fs::rename(backup, &git_dir)?;
    Ok(())
}

fn discard_backup(repo_path: &Path) -> Result<(), AppError> {
    let backup = backup_dir(repo_path)?;
    if backup.exists() {
        fs::remove_dir_all(&backup)?;
    }
    Ok(())
}

/// 备份目录（与仓库同级）：不跨卷，也不落在工作区内，因此不会被提交。
fn backup_dir(repo_path: &Path) -> Result<PathBuf, AppError> {
    let parent = repo_path
        .parent()
        .ok_or_else(|| AppError::Repo("仓库路径没有上级目录，无法重置历史".into()))?;
    let name = repo_path
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| "repo".into());
    let safe: String = name
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect();
    Ok(parent.join(format!("{BACKUP_PREFIX}{safe}")))
}

/// 重建失败：尽力还原备份；连还原都失败时把备份路径写进错误，避免用户无从下手。
fn rollback_error(repo_path: &Path, backup: &Path, err: AppError) -> AppError {
    match restore_backup_at(repo_path, backup) {
        Ok(()) => err,
        Err(rollback) => AppError::Repo(format!(
            "{err}；且自动回滚失败（{rollback}），旧仓库仍保留在 {}，可手动改名为 .git 恢复",
            backup.display()
        )),
    }
}

#[cfg(test)]
#[path = "git2_rewrite_tests.rs"]
mod git2_rewrite_tests;

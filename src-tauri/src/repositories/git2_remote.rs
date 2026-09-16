use std::path::{Path, PathBuf};

use git2::{
    build::{CheckoutBuilder, RepoBuilder},
    AnnotatedCommit, Cred, FetchOptions, PushOptions, RemoteCallbacks, Repository,
};

use crate::domain::error::AppError;
use crate::domain::remote::RemoteCredential;
use crate::domain::sync::ConflictFile;
use crate::domain::vault::is_envelope;
use crate::repositories::note_files::validate_rel_path;
use crate::repositories::vault_files;

use super::ca_bundle;
use super::git2_backend::{blob_is_envelope, current_branch, open, signature, to_git};
use super::git2_error::to_sync;

fn callbacks(cred: &RemoteCredential) -> RemoteCallbacks<'static> {
    let username = cred.username.clone();
    let token = cred.token.clone();
    let mut cb = RemoteCallbacks::new();
    cb.credentials(move |_url, _user, _allowed| Cred::userpass_plaintext(&username, &token));
    cb
}

fn fetch_options(cred: &RemoteCredential) -> FetchOptions<'static> {
    let mut fo = FetchOptions::new();
    fo.remote_callbacks(callbacks(cred));
    fo
}

pub fn clone_repo(url: &str, dest: &Path, cred: &RemoteCredential) -> Result<(), AppError> {
    ca_bundle::configure_ssl_certificates()?;
    RepoBuilder::new()
        .fetch_options(fetch_options(cred))
        .clone(url, dest)
        .map_err(to_sync)?;
    Ok(())
}

/// 只读探测远端：能列出引用即视为可达且凭证有效。
pub fn ls_remote(url: &str, cred: &RemoteCredential) -> Result<(), AppError> {
    ca_bundle::configure_ssl_certificates()?;
    let mut remote = git2::Remote::create_detached(url).map_err(to_git)?;
    remote
        .connect_auth(git2::Direction::Fetch, Some(callbacks(cred)), None)
        .map_err(to_sync)?;
    remote.list().map_err(to_sync)?;
    remote.disconnect().map_err(to_sync)?;
    Ok(())
}

pub fn fetch(path: &str, cred: &RemoteCredential) -> Result<(), AppError> {
    ca_bundle::configure_ssl_certificates()?;
    let repo = open(path)?;
    let mut remote = repo.find_remote("origin").map_err(to_git)?;
    remote
        .fetch(&[] as &[&str], Some(&mut fetch_options(cred)), None)
        .map_err(to_sync)
}

pub fn push(path: &str, cred: &RemoteCredential) -> Result<(), AppError> {
    ca_bundle::configure_ssl_certificates()?;
    let repo = open(path)?;
    let branch = current_branch(&repo)?;
    let refspec = format!("refs/heads/{branch}:refs/heads/{branch}");
    let mut po = PushOptions::new();
    po.remote_callbacks(callbacks(cred));
    let mut remote = repo.find_remote("origin").map_err(to_git)?;
    remote.push(&[refspec], Some(&mut po)).map_err(to_sync)
}

/// 强制推送当前分支（`+` refspec 覆盖远端）：历史被重写后唯一可行的推送方式。
///
/// 普通 push 只用于快进同步（`push`），此处单独成函数，避免 force 语义被误用。
/// 推送成功后远端该分支即本地 HEAD，直接刷新远端跟踪引用，避免随后 `ahead_behind`
/// 把已推送的提交误报成「待推送」。
pub fn force_push(path: &str, cred: &RemoteCredential) -> Result<(), AppError> {
    ca_bundle::configure_ssl_certificates()?;
    let repo = open(path)?;
    let branch = current_branch(&repo)?;
    let head = repo.head().map_err(to_git)?.peel_to_commit().map_err(to_git)?.id();
    let refspec = format!("+refs/heads/{branch}:refs/heads/{branch}");
    let mut po = PushOptions::new();
    po.remote_callbacks(callbacks(cred));
    let mut remote = repo.find_remote("origin").map_err(to_git)?;
    remote.push(&[refspec], Some(&mut po)).map_err(to_sync)?;
    repo.reference(
        &format!("refs/remotes/origin/{branch}"),
        head,
        true,
        "reset history: force push",
    )
    .map_err(to_git)
    .map(|_| ())
}

pub fn pull(path: &str, cred: &RemoteCredential) -> Result<(), AppError> {
    fetch(path, cred)?;
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
    // 先检出再移动分支引用：检出失败（如工作区仍有本地改动）时分支保持原状，不留下半完成状态。
    // 不用 force：理论上 sync 已先提交，万一仍撞上本地改动，宁可报错也不静默覆盖。
    let object = repo.find_object(target, None).map_err(to_git)?;
    repo.checkout_tree(&object, Some(CheckoutBuilder::new().safe()))
        .map_err(to_git)?;
    repo.find_reference(&format!("refs/heads/{branch}"))
        .map_err(to_git)?
        .set_target(target, "fast-forward")
        .map_err(to_git)
        .map(|_| ())
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

/// 读取当前合并冲突文件（path + 本地 stage2 / 远端 stage3 内容），供三栏合并（P1-3）。
pub fn conflict_files(path: &str) -> Result<Vec<ConflictFile>, AppError> {
    let repo = open(path)?;
    let index = repo.index().map_err(to_git)?;
    let mut files = Vec::new();
    for conflict in index.conflicts().map_err(to_git)? {
        let entry = conflict.map_err(to_git)?;
        let our = entry.our;
        let their = entry.their;
        let ancestor = entry.ancestor;
        let rel_bytes = our
            .as_ref()
            .or(their.as_ref())
            .or(ancestor.as_ref())
            .map(|e| e.path.as_slice())
            .ok_or_else(|| AppError::Io("conflict entry missing path".into()))?;
        let rel = String::from_utf8_lossy(rel_bytes).into_owned();
        let local = our
            .map(|e| read_blob(&repo, e.id))
            .transpose()?
            .unwrap_or_default();
        let remote = their
            .map(|e| read_blob(&repo, e.id))
            .transpose()?
            .unwrap_or_default();
        files.push(ConflictFile {
            path: rel,
            local,
            remote,
        });
    }
    files.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(files)
}

/// 以指定内容解决单个冲突文件并写入 index；返回是否已无冲突（P1-3）。
pub fn resolve_conflict_file(path: &str, rel: &str, content: &str) -> Result<bool, AppError> {
    let repo = open(path)?;
    let rel = validate_rel_path(rel)?;
    let file_path = repo
        .workdir()
        .ok_or_else(|| AppError::Repo("no workdir".into()))?
        .join(&rel);
    reject_plaintext_over_envelope(&repo, &rel, &file_path, content)?;
    std::fs::write(&file_path, content)?;
    let mut index = repo.index().map_err(to_git)?;
    index.add_path(&rel).map_err(to_git)?;
    index.write().map_err(to_git)?;
    Ok(!index.has_conflicts())
}

/// 加密笔记冲突兜底（§6：只允许保留本地/远端二选一）。命令层可被直接 invoke，
/// 不能信任前端已隐藏三栏合并——落盘前必须判定：
/// content 本身是信封 → 放行（EncryptedMergePane 把某一侧原字节写回的正常路径）；
/// 否则目标「当前是或冲突方曾是」信封时拒绝写入明文，防止密文被静默覆盖成明文。
fn reject_plaintext_over_envelope(
    repo: &Repository,
    rel: &Path,
    file_path: &Path,
    content: &str,
) -> Result<(), AppError> {
    if is_envelope(content) || !path_is_encrypted(repo, rel, file_path)? {
        return Ok(());
    }
    Err(AppError::VaultInvalid(format!(
        "{} 是加密笔记，冲突解决只允许保留本地/远端的信封原文，拒绝写入明文",
        rel.to_string_lossy()
    )))
}

/// 目标路径「当前是或曾是」加密信封：工作区首行判定 + 冲突三方（base/本地/远端）blob 判定。
fn path_is_encrypted(repo: &Repository, rel: &Path, file_path: &Path) -> Result<bool, AppError> {
    if vault_files::is_envelope_file(file_path) {
        return Ok(true);
    }
    conflict_sides_contain_envelope(repo, rel)
}

fn conflict_sides_contain_envelope(repo: &Repository, rel: &Path) -> Result<bool, AppError> {
    let rel = rel.to_string_lossy();
    let index = repo.index().map_err(to_git)?;
    for conflict in index.conflicts().map_err(to_git)? {
        let entry = conflict.map_err(to_git)?;
        let sides = [entry.ancestor, entry.our, entry.their];
        if !sides.iter().flatten().any(|e| e.path == rel.as_bytes()) {
            continue;
        }
        for side in sides.iter().flatten() {
            if blob_is_envelope(repo, side.id)? {
                return Ok(true);
            }
        }
    }
    Ok(false)
}

/// index 已无冲突时完成 merge commit（复用 commit_merge，P1-3）。
pub fn complete_merge(path: &str, message: &str) -> Result<(), AppError> {
    let repo = open(path)?;
    commit_merge(&repo, message)
}

fn read_blob(repo: &Repository, oid: git2::Oid) -> Result<String, AppError> {
    let blob = repo.find_blob(oid).map_err(to_git)?;
    Ok(String::from_utf8_lossy(blob.content()).into_owned())
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
    let head = repo
        .head()
        .map_err(to_git)?
        .peel_to_commit()
        .map_err(to_git)?;
    let their = repo.find_commit(read_merge_head(repo)?).map_err(to_git)?;
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

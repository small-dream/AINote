//! git2_rewrite 集成测试：真实仓库上验证「折叠为单次提交」、物理清除与备份自愈。

use std::fs;
use std::path::{Path, PathBuf};

use super::{backup_dir, discard_backup, rebuild, restore_backup, snapshot};
use crate::domain::remote::RemoteCredential;
use crate::repositories::git2_remote;

/// 本地 bare 仓库模拟远端时不需要认证，令牌留空即可。
fn cred() -> RemoteCredential {
    RemoteCredential::new("x-access-token", "")
}

fn init_repo(dir: &Path) -> git2::Repository {
    let mut opts = git2::RepositoryInitOptions::new();
    opts.initial_head("main");
    let repo = git2::Repository::init_opts(dir, &opts).unwrap();
    let mut cfg = repo.config().unwrap();
    cfg.set_str("user.name", "tester").unwrap();
    cfg.set_str("user.email", "t@example.com").unwrap();
    repo
}

fn commit_file(repo: &git2::Repository, path: &str, content: &str, msg: &str) -> git2::Oid {
    let root = repo.workdir().unwrap();
    let target = root.join(path);
    fs::create_dir_all(target.parent().unwrap()).unwrap();
    fs::write(&target, content).unwrap();
    let mut index = repo.index().unwrap();
    index.add_all(["*"], git2::IndexAddOption::DEFAULT, None).unwrap();
    index.write().unwrap();
    let tree = repo.find_tree(index.write_tree().unwrap()).unwrap();
    let sig = repo.signature().unwrap();
    let parent = repo.head().ok().and_then(|h| h.peel_to_commit().ok());
    let parents: Vec<&git2::Commit> = parent.iter().collect();
    repo.commit(Some("HEAD"), &sig, &sig, msg, &tree, &parents).unwrap()
}

fn commit_count(dir: &Path) -> usize {
    let repo = git2::Repository::open(dir).unwrap();
    let mut walk = repo.revwalk().unwrap();
    walk.push_head().unwrap();
    walk.count()
}

/// 工作区待提交变更数（忽略 .gitignore 命中的文件，与 changed_files 口径一致）
fn pending_count(repo: &git2::Repository) -> usize {
    let mut opts = git2::StatusOptions::new();
    opts.include_untracked(true).include_ignored(false);
    repo.statuses(Some(&mut opts)).unwrap().iter().count()
}

/// 三次提交的仓库：a.md 与 notes/b.md 都被改过
fn repo_with_history(tmp: &tempfile::TempDir) -> PathBuf {
    let dir = tmp.path().join("notes");
    fs::create_dir_all(&dir).unwrap();
    let repo = init_repo(&dir);
    commit_file(&repo, "a.md", "1", "c1");
    commit_file(&repo, "notes/b.md", "2", "c2");
    commit_file(&repo, "a.md", "3", "c3");
    dir
}

#[test]
fn snapshot_counts_history_of_local_repo() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = repo_with_history(&tmp);

    let snap = snapshot(&dir).unwrap();

    assert_eq!(snap.branch, "main");
    assert_eq!(snap.remote_url, None);
    assert_eq!(snap.commits, 3);
    assert_eq!((snap.ahead, snap.behind), (3, 0));
}

#[test]
fn rebuild_collapses_history_and_keeps_working_tree() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = repo_with_history(&tmp);
    let old_head = git2::Repository::open(&dir)
        .unwrap()
        .head()
        .unwrap()
        .peel_to_commit()
        .unwrap()
        .id();

    // 未提交改动与未跟踪文件都会进入唯一那次提交
    fs::write(dir.join("a.md"), "3-edited").unwrap();
    fs::write(dir.join("new.md"), "untracked").unwrap();
    let rebuilt = rebuild(&dir, "note: reset history", &snapshot(&dir).unwrap()).unwrap();

    assert_eq!(commit_count(&dir), 1);
    assert_eq!(fs::read_to_string(dir.join("a.md")).unwrap(), "3-edited");
    assert_eq!(fs::read_to_string(dir.join("new.md")).unwrap(), "untracked");
    assert_eq!(rebuilt.files, 3);

    let repo = git2::Repository::open(&dir).unwrap();
    let head = repo.head().unwrap().peel_to_commit().unwrap();
    assert_eq!(head.parent_count(), 0);
    assert_eq!(head.id().to_string(), rebuilt.commit_id);
    assert_eq!(repo.head().unwrap().shorthand(), Some("main"));
    assert_eq!(pending_count(&repo), 0);
    // 旧提交不在新仓库里：对象已被物理丢弃
    assert!(repo.find_commit(old_head).is_err());
    // 备份保留到收尾：推送失败还能整体回滚
    assert!(backup_dir(&dir).unwrap().is_dir());

    discard_backup(&dir).unwrap();
    assert!(!backup_dir(&dir).unwrap().exists());
    assert_eq!(snapshot(&dir).unwrap().commits, 1);
}

#[test]
fn rebuild_keeps_ignored_files_out_of_commit() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("notes");
    fs::create_dir_all(&dir).unwrap();
    let repo = init_repo(&dir);
    commit_file(&repo, ".gitignore", "secret.tmp\n", "c1");
    fs::write(dir.join("secret.tmp"), "local only").unwrap();

    rebuild(&dir, "note: reset history", &snapshot(&dir).unwrap()).unwrap();

    let repo = git2::Repository::open(&dir).unwrap();
    let index = repo.index().unwrap();
    assert!(index.get_path(Path::new("secret.tmp"), 0).is_none());
    assert!(dir.join("secret.tmp").is_file());
    assert_eq!(pending_count(&repo), 0);
}

#[test]
fn restore_backup_brings_old_history_back() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = repo_with_history(&tmp);
    let old_head = git2::Repository::open(&dir)
        .unwrap()
        .head()
        .unwrap()
        .peel_to_commit()
        .unwrap()
        .id();

    rebuild(&dir, "note: reset history", &snapshot(&dir).unwrap()).unwrap();
    assert_eq!(commit_count(&dir), 1);

    restore_backup(&dir).unwrap();

    let repo = git2::Repository::open(&dir).unwrap();
    assert_eq!(repo.head().unwrap().peel_to_commit().unwrap().id(), old_head);
    assert_eq!(commit_count(&dir), 3);
    assert!(!backup_dir(&dir).unwrap().exists());
    assert_eq!(pending_count(&repo), 0);
}

#[test]
fn snapshot_heals_backup_when_git_is_gone() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = repo_with_history(&tmp);
    // 备份已就位，但新 .git 未建立 = 重建中途中断
    fs::rename(dir.join(".git"), backup_dir(&dir).unwrap()).unwrap();

    let snap = snapshot(&dir).unwrap();

    assert_eq!(snap.commits, 3);
    assert!(!backup_dir(&dir).unwrap().exists());
    assert!(git2::Repository::open(&dir).is_ok());
}

#[test]
fn snapshot_clears_stale_backup_when_rebuild_succeeded() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = repo_with_history(&tmp);
    rebuild(&dir, "note: reset history", &snapshot(&dir).unwrap()).unwrap();

    let snap = snapshot(&dir).unwrap();

    assert_eq!(snap.commits, 1);
    assert!(!backup_dir(&dir).unwrap().exists());
}

#[test]
fn rebuild_rejects_worktree_layout() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("plain");
    fs::create_dir_all(&dir).unwrap();
    let snap = super::RepoSnapshot {
        branch: "main".into(),
        remote_url: None,
        ahead: 0,
        behind: 0,
        commits: 0,
    };

    let err = rebuild(&dir, "note: reset history", &snap).unwrap_err();

    assert!(err.to_string().contains(".git"));
}

#[test]
fn force_push_replaces_remote_history_with_single_commit() {
    let tmp = tempfile::tempdir().unwrap();
    let remote_dir = tmp.path().join("origin.git");
    git2::Repository::init_bare(&remote_dir).unwrap();
    let dir = repo_with_history(&tmp);
    let repo = git2::Repository::open(&dir).unwrap();
    repo.remote("origin", remote_dir.to_str().unwrap()).unwrap();
    let path = dir.to_string_lossy().to_string();
    git2_remote::push(&path, &cred()).unwrap();
    let bare = git2::Repository::open(&remote_dir).unwrap();
    assert_eq!(remote_commit_count(&bare), 3);

    let rebuilt = rebuild(&dir, "note: reset history", &snapshot(&dir).unwrap()).unwrap();
    git2_remote::force_push(&path, &cred()).unwrap();

    let bare = git2::Repository::open(&remote_dir).unwrap();
    assert_eq!(
        bare.refname_to_id("refs/heads/main").unwrap().to_string(),
        rebuilt.commit_id
    );
    assert_eq!(remote_commit_count(&bare), 1);
    // 新仓库的远端跟踪引用被同步刷新，同步状态不会误报「待推送」
    assert_eq!(snapshot(&dir).unwrap().ahead, 0);
    discard_backup(&dir).unwrap();
}

fn remote_commit_count(bare: &git2::Repository) -> usize {
    let mut walk = bare.revwalk().unwrap();
    walk.push(bare.refname_to_id("refs/heads/main").unwrap()).unwrap();
    walk.count()
}

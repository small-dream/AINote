//! git2_remote 集成测试：用本地 bare 仓库模拟远端，验证 push/pull/sync 真实行为。

use std::path::Path;

use super::{clone_repo, pull, push};

fn sig() -> git2::Signature<'static> {
    git2::Signature::now("t", "t@t").unwrap()
}

fn commit_file(repo: &git2::Repository, name: &str, content: &str, msg: &str) -> git2::Oid {
    let blob = repo.blob(content.as_bytes()).unwrap();
    let mut tb = repo.treebuilder(None).unwrap();
    tb.insert(name, blob, 0o100644).unwrap();
    let tree = repo.find_tree(tb.write().unwrap()).unwrap();
    let sig = sig();
    let parents: Vec<git2::Commit> = repo
        .head()
        .ok()
        .and_then(|h| h.peel_to_commit().ok())
        .into_iter()
        .collect();
    let parent_refs: Vec<&git2::Commit> = parents.iter().collect();
    repo.commit(Some("HEAD"), &sig, &sig, msg, &tree, &parent_refs)
        .unwrap()
}

fn init_local(remote_url: &str) -> (tempfile::TempDir, std::path::PathBuf) {
    let dir = tempfile::tempdir().unwrap();
    let repo = git2::Repository::init(dir.path()).unwrap();
    repo.remote("origin", remote_url).unwrap();
    let path = dir.path().to_path_buf();
    (dir, path)
}

fn seed_bare(bare: &Path) {
    let repo = git2::Repository::init_bare(bare).unwrap();
    let blob = repo.blob(b"seed").unwrap();
    let mut tb = repo.treebuilder(None).unwrap();
    tb.insert("seed.md", blob, 0o100644).unwrap();
    let tree = repo.find_tree(tb.write().unwrap()).unwrap();
    let commit = repo
        .commit(
            Some("refs/heads/master"),
            &sig(),
            &sig(),
            "seed",
            &tree,
            &[],
        )
        .unwrap();
    repo.reference("refs/heads/master", commit, true, "seed")
        .unwrap();
    repo.set_head("refs/heads/master").unwrap();
}

#[test]
fn push_creates_branch_on_empty_remote() {
    let remote_dir = tempfile::tempdir().unwrap();
    let bare = remote_dir.path().join("remote.git");
    git2::Repository::init_bare(&bare).unwrap();

    let (_work, local) = init_local(&bare.to_string_lossy());
    {
        let repo = git2::Repository::open(&local).unwrap();
        commit_file(&repo, "a.md", "hi", "c1");
    }
    push(&local.to_string_lossy(), "").unwrap();

    let remote_repo = git2::Repository::open(&bare).unwrap();
    assert!(remote_repo.find_reference("refs/heads/master").is_ok());
}

#[test]
fn pull_ok_when_remote_branch_absent() {
    let remote_dir = tempfile::tempdir().unwrap();
    let bare = remote_dir.path().join("remote.git");
    git2::Repository::init_bare(&bare).unwrap();

    let (_work, local) = init_local(&bare.to_string_lossy());
    {
        let repo = git2::Repository::open(&local).unwrap();
        commit_file(&repo, "a.md", "hi", "c1");
    }
    let res = pull(&local.to_string_lossy(), "");
    assert!(res.is_ok());
}

#[test]
fn clone_commit_pull_push_roundtrip() {
    let remote_dir = tempfile::tempdir().unwrap();
    let bare = remote_dir.path().join("remote.git");
    seed_bare(&bare);

    let work = tempfile::tempdir().unwrap();
    let local = work.path().join("repo");
    clone_repo(&bare.to_string_lossy(), &local, "").unwrap();

    let repo = git2::Repository::open(&local).unwrap();
    commit_file(&repo, "note.md", "hello", "c2");

    pull(&local.to_string_lossy(), "").unwrap();
    push(&local.to_string_lossy(), "").unwrap();

    let remote_repo = git2::Repository::open(&bare).unwrap();
    let head = remote_repo.head().unwrap().peel_to_commit().unwrap();
    assert_eq!(head.message().unwrap(), "c2");
}

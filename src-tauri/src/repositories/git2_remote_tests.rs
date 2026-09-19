//! git2_remote 集成测试：用本地 bare 仓库模拟远端，验证 push/pull/sync 真实行为。

use std::path::Path;

use super::{clone_repo, pull, push, resolve_conflict_file, resolve_conflicts};
use crate::domain::error::AppError;
use crate::domain::remote::RemoteCredential;

/// 本地 bare 仓库模拟远端不需要认证，用户名与令牌留空即可。
fn cred() -> RemoteCredential {
    RemoteCredential::new("x-access-token", "")
}

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
    push(&local.to_string_lossy(), &cred()).unwrap();

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
    let res = pull(&local.to_string_lossy(), &cred());
    assert!(res.is_ok());
}

#[test]
fn clone_commit_pull_push_roundtrip() {
    let remote_dir = tempfile::tempdir().unwrap();
    let bare = remote_dir.path().join("remote.git");
    seed_bare(&bare);

    let work = tempfile::tempdir().unwrap();
    let local = work.path().join("repo");
    clone_repo(&bare.to_string_lossy(), &local, &cred()).unwrap();

    let repo = git2::Repository::open(&local).unwrap();
    commit_file(&repo, "note.md", "hello", "c2");

    pull(&local.to_string_lossy(), &cred()).unwrap();
    push(&local.to_string_lossy(), &cred()).unwrap();

    let remote_repo = git2::Repository::open(&bare).unwrap();
    let head = remote_repo.head().unwrap().peel_to_commit().unwrap();
    assert_eq!(head.message().unwrap(), "c2");
}

#[test]
fn fast_forward_keeps_local_modification_instead_of_overwriting_it() {
    let remote_dir = tempfile::tempdir().unwrap();
    let bare = remote_dir.path().join("remote.git");
    seed_bare(&bare);

    let work = tempfile::tempdir().unwrap();
    let local = work.path().join("repo");
    clone_repo(&bare.to_string_lossy(), &local, &cred()).unwrap();

    // 远端前进：修改 seed.md 的新提交
    {
        let remote_repo = git2::Repository::open(&bare).unwrap();
        commit_file(&remote_repo, "seed.md", "remote-change", "remote");
    }
    // 本地同一文件存在未提交修改
    std::fs::write(local.join("seed.md"), "local-change").unwrap();

    let error = pull(&local.to_string_lossy(), &cred()).unwrap_err();

    assert!(matches!(error, AppError::Git(_)), "检出冲突报错而不是静默覆盖");
    assert_eq!(
        std::fs::read_to_string(local.join("seed.md")).unwrap(),
        "local-change",
        "本地未提交内容必须保留"
    );
    let repo = git2::Repository::open(&local).unwrap();
    assert_eq!(
        repo.head().unwrap().peel_to_commit().unwrap().message().unwrap(),
        "seed",
        "检出失败时分支引用保持原状，不留下半完成状态"
    );
}

const ENVELOPE_BASE: &str = "AINOTE-ENC-v1\nQkFTRQo=\n";
const ENVELOPE_OURS: &str = "AINOTE-ENC-v1\nT1VSUwo=\n";
const ENVELOPE_THEIRS: &str = "AINOTE-ENC-v1\nVEhFSVJTCg==\n";

/// 夹具：base/本地/远端三侧内容各不相同，merge 必然在 note.md 上产生冲突。
/// 返回时仓库处于合并中状态，工作区 note.md 为冲突标记文本。
fn merge_conflict_repo(base: &str, ours: &str, theirs: &str) -> (tempfile::TempDir, std::path::PathBuf) {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("repo");
    std::fs::create_dir_all(&dir).unwrap();
    let repo = git2::Repository::init(&dir).unwrap();
    commit_file(&repo, "note.md", base, "base");
    let head_ref = repo.head().unwrap().name().unwrap().to_string();
    let base_commit = repo.head().unwrap().peel_to_commit().unwrap();
    repo.branch("side", &base_commit, false).unwrap();
    commit_file(&repo, "note.md", ours, "ours");
    repo.set_head("refs/heads/side").unwrap();
    repo.checkout_head(Some(git2::build::CheckoutBuilder::new().force()))
        .unwrap();
    commit_file(&repo, "note.md", theirs, "theirs");
    // commit_file 只写对象库不动工作区/索引；merge 前把两者重置到 HEAD（theirs）保持干净。
    repo.checkout_head(Some(git2::build::CheckoutBuilder::new().force()))
        .unwrap();
    let ours_oid = repo.refname_to_id(&head_ref).unwrap();
    let annotated = repo.find_annotated_commit(ours_oid).unwrap();
    let mut checkout = git2::build::CheckoutBuilder::new();
    checkout.force();
    repo.merge(&[&annotated], None, Some(&mut checkout)).unwrap();
    assert!(repo.index().unwrap().has_conflicts(), "夹具必须制造冲突");
    (tmp, dir)
}

#[test]
fn resolve_conflict_allows_envelope_over_envelope() {
    // EncryptedMergePane 的正常路径：把某一侧的信封原字节写回。
    let (_tmp, dir) = merge_conflict_repo(ENVELOPE_BASE, ENVELOPE_OURS, ENVELOPE_THEIRS);
    resolve_conflict_file(dir.to_str().unwrap(), "note.md", ENVELOPE_OURS).unwrap();
    assert_eq!(
        std::fs::read_to_string(dir.join("note.md")).unwrap(),
        ENVELOPE_OURS
    );
}

#[test]
fn resolve_conflict_rejects_plaintext_over_envelope_sides() {
    // M2：冲突三方是信封（工作区为冲突标记），命令层直接 invoke 传入合并明文 → 拒绝。
    let (_tmp, dir) = merge_conflict_repo(ENVELOPE_BASE, ENVELOPE_OURS, ENVELOPE_THEIRS);
    let before = std::fs::read_to_string(dir.join("note.md")).unwrap();
    let err = resolve_conflict_file(dir.to_str().unwrap(), "note.md", "# 合并出的明文\n").unwrap_err();
    assert!(matches!(err, AppError::VaultInvalid(_)), "应返回 VAULT_9004");
    assert!(err.to_string().contains("加密笔记"));
    assert_eq!(
        std::fs::read_to_string(dir.join("note.md")).unwrap(),
        before,
        "拒绝时工作区不得被改写"
    );
}

#[test]
fn resolve_conflict_rejects_plaintext_over_envelope_worktree() {
    // 冲突侧是明文、但工作区文件当前是信封：同样拒绝（工作区判定路径）。
    let (_tmp, dir) = merge_conflict_repo("base\n", "ours\n", "theirs\n");
    std::fs::write(dir.join("note.md"), ENVELOPE_OURS).unwrap();
    let err = resolve_conflict_file(dir.to_str().unwrap(), "note.md", "plain merged\n").unwrap_err();
    assert!(matches!(err, AppError::VaultInvalid(_)));
}

#[test]
fn resolve_conflict_keeps_plaintext_flow_untouched() {
    // 明文笔记冲突：保持现状放行，合并结果正常落盘。
    let (_tmp, dir) = merge_conflict_repo("base\n", "ours\n", "theirs\n");
    resolve_conflict_file(dir.to_str().unwrap(), "note.md", "merged\n").unwrap();
    assert_eq!(std::fs::read_to_string(dir.join("note.md")).unwrap(), "merged\n");
}

#[test]
fn resolve_conflict_allows_envelope_when_worktree_file_missing() {
    // 冲突中一侧新建的加密笔记场景：目标在工作区不存在，content 是信封 → 允许。
    let (_tmp, dir) = merge_conflict_repo("base\n", "ours\n", "theirs\n");
    std::fs::remove_file(dir.join("note.md")).unwrap();
    resolve_conflict_file(dir.to_str().unwrap(), "note.md", ENVELOPE_OURS).unwrap();
    assert_eq!(
        std::fs::read_to_string(dir.join("note.md")).unwrap(),
        ENVELOPE_OURS
    );
}

// 注意夹具 merge 方向：HEAD 在 side 分支（第三个参数），merge 进 master（第二个参数）。
// 因此 resolve_conflicts 视角下 本地 ours = 第三个参数，远端 theirs = 第二个参数。

#[test]
fn resolve_conflicts_rejects_plaintext_local_over_envelope_remote() {
    // 本地明文 / 远端信封 + 保留本地 → 整批拒绝：不产生 merge commit，冲突保持未解决。
    let (_tmp, dir) = merge_conflict_repo(ENVELOPE_BASE, ENVELOPE_THEIRS, "local plain\n");
    let err = resolve_conflicts(dir.to_str().unwrap(), true).unwrap_err();
    assert!(matches!(err, AppError::VaultInvalid(_)), "应返回 VAULT_9004");
    assert!(err.to_string().contains("note.md"), "错误消息须列出违规文件");
    let repo = git2::Repository::open(&dir).unwrap();
    assert_eq!(
        repo.head().unwrap().peel_to_commit().unwrap().message().unwrap(),
        "theirs",
        "拒绝时不得产生 merge commit"
    );
    assert!(repo.path().join("MERGE_HEAD").exists(), "拒绝时合并状态必须保留");
    assert!(repo.index().unwrap().has_conflicts(), "拒绝时冲突必须保持未解决");
}

#[test]
fn resolve_conflicts_rejects_plaintext_remote_over_envelope_local() {
    // 本地信封 / 远端明文 + 保留远端 → 同样拒绝（对称方向）。
    let (_tmp, dir) = merge_conflict_repo(ENVELOPE_BASE, "remote plain\n", ENVELOPE_OURS);
    let err = resolve_conflicts(dir.to_str().unwrap(), false).unwrap_err();
    assert!(matches!(err, AppError::VaultInvalid(_)));
    assert!(err.to_string().contains("note.md"));
    let repo = git2::Repository::open(&dir).unwrap();
    assert!(repo.index().unwrap().has_conflicts(), "拒绝时冲突必须保持未解决");
}

#[test]
fn resolve_conflicts_allows_envelope_over_envelope() {
    // 两侧都是信封：行为不变，保留本地侧信封并完成 merge commit。
    let (_tmp, dir) = merge_conflict_repo(ENVELOPE_BASE, ENVELOPE_OURS, ENVELOPE_THEIRS);
    resolve_conflicts(dir.to_str().unwrap(), true).unwrap();
    assert_eq!(
        std::fs::read_to_string(dir.join("note.md")).unwrap(),
        ENVELOPE_THEIRS
    );
    let repo = git2::Repository::open(&dir).unwrap();
    let head = repo.head().unwrap().peel_to_commit().unwrap();
    assert_eq!(head.parent_count(), 2, "必须产生双父 merge commit");
    assert!(!repo.index().unwrap().has_conflicts());
}

#[test]
fn resolve_conflicts_keeps_plaintext_flow_untouched() {
    // 回归：两侧都明文时行为不变，保留本地侧并正常落盘提交。
    let (_tmp, dir) = merge_conflict_repo("base\n", "remote\n", "local\n");
    resolve_conflicts(dir.to_str().unwrap(), true).unwrap();
    assert_eq!(std::fs::read_to_string(dir.join("note.md")).unwrap(), "local\n");
    let repo = git2::Repository::open(&dir).unwrap();
    assert_eq!(repo.head().unwrap().peel_to_commit().unwrap().parent_count(), 2);
}

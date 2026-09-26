use super::*;
use std::path::PathBuf;

use crate::repositories::git2_backend::Git2Backend;
use crate::repositories::git_backend::GitBackend;

fn init_repo(dir: &Path) -> Repository {
    let repo = Repository::init(dir).unwrap();
    let mut cfg = repo.config().unwrap();
    cfg.set_str("user.name", "tester").unwrap();
    cfg.set_str("user.email", "t@example.com").unwrap();
    repo
}

/// 建一次提交：把给定文件写盘、入 index 并提交。
fn commit_files(repo: &Repository, files: &[(&str, &[u8])], msg: &str) {
    let mut index = repo.index().unwrap();
    for (path, content) in files {
        let abs = repo.path().parent().unwrap().join(path);
        fs::create_dir_all(abs.parent().unwrap()).unwrap();
        fs::write(&abs, content).unwrap();
        index.add_path(Path::new(path)).unwrap();
    }
    index.write().unwrap();
    let tree = repo.find_tree(index.write_tree().unwrap()).unwrap();
    let sig = repo.signature().unwrap();
    let head = repo.head().ok();
    let parent = head
        .as_ref()
        .and_then(|h| h.peel_to_commit().ok())
        .map(|c| vec![c]);
    let parents: Vec<&git2::Commit> = parent.iter().flatten().collect();
    repo.commit(Some("HEAD"), &sig, &sig, msg, &tree, &parents)
        .unwrap();
}

fn dir_of(tmp: &tempfile::TempDir) -> PathBuf {
    let dir = tmp.path().join("repo");
    fs::create_dir_all(&dir).unwrap();
    dir
}

fn read(dir: &Path, rel: &str) -> Vec<u8> {
    fs::read(dir.join(rel)).unwrap()
}

/// 丢弃后工作区应当回到「无待提交变更」状态（index 与 HEAD 一致）。
fn assert_clean(dir: &Path) {
    let files = Git2Backend.changed_files(dir.to_str().unwrap()).unwrap();
    assert!(files.is_empty(), "丢弃后不应再有待提交变更: {files:?}");
}

#[test]
fn modified_file_is_restored_to_head_version() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = dir_of(&tmp);
    let repo = init_repo(&dir);
    commit_files(&repo, &[("a.md", b"v1")], "c1");
    fs::write(dir.join("a.md"), "v2").unwrap();

    let report = discard_working(dir.to_str().unwrap(), &["a.md".into()]).unwrap();

    assert_eq!(report.restored, vec!["a.md"]);
    assert!(report.deleted.is_empty());
    assert_eq!(read(&dir, "a.md"), b"v1");
    assert_clean(&dir);
}

#[test]
fn file_deleted_in_worktree_is_restored() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = dir_of(&tmp);
    let repo = init_repo(&dir);
    commit_files(&repo, &[("a.md", b"v1")], "c1");
    fs::remove_file(dir.join("a.md")).unwrap();

    let report = discard_working(dir.to_str().unwrap(), &["a.md".into()]).unwrap();

    assert_eq!(report.restored, vec!["a.md"]);
    assert_eq!(read(&dir, "a.md"), b"v1", "被删掉的文件要按 HEAD 版本找回");
    assert_clean(&dir);
}

#[test]
fn added_file_is_deleted_and_left_no_trace() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = dir_of(&tmp);
    let repo = init_repo(&dir);
    commit_files(&repo, &[("a.md", b"v1")], "c1");
    fs::write(dir.join("new.md"), "draft").unwrap();

    let report = discard_working(dir.to_str().unwrap(), &["new.md".into()]).unwrap();

    assert_eq!(report.deleted, vec!["new.md"]);
    assert!(!dir.join("new.md").exists(), "新增文件无历史版本，只能删除");
    assert_clean(&dir);
}

#[test]
fn only_selected_paths_are_touched() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = dir_of(&tmp);
    let repo = init_repo(&dir);
    commit_files(&repo, &[("a.md", b"v1"), ("b.md", b"v1")], "c1");
    fs::write(dir.join("a.md"), "v2").unwrap();
    fs::write(dir.join("b.md"), "v2").unwrap();

    let report = discard_working(dir.to_str().unwrap(), &["a.md".into()]).unwrap();

    assert_eq!(report.restored, vec!["a.md"]);
    assert_eq!(read(&dir, "a.md"), b"v1");
    assert_eq!(read(&dir, "b.md"), b"v2", "未选中的文件保持本地改动");
}

#[test]
fn binary_and_hidden_paths_round_trip_byte_exact() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = dir_of(&tmp);
    let repo = init_repo(&dir);
    let png: &[u8] = &[0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0xfe];
    commit_files(
        &repo,
        &[
            ("assets/logo.png", png),
            (".ainote/todos.json", b"{\"schemaVersion\":3}"),
            (".gitignore", b"secret.tmp\n"),
        ],
        "c1",
    );
    fs::write(dir.join("assets/logo.png"), [0x00, 0x01]).unwrap();
    fs::write(dir.join(".ainote/todos.json"), "{}").unwrap();
    fs::write(dir.join(".gitignore"), "changed\n").unwrap();

    let report = discard_working(
        dir.to_str().unwrap(),
        &[
            "assets/logo.png".into(),
            ".ainote/todos.json".into(),
            ".gitignore".into(),
        ],
    )
    .unwrap();

    assert_eq!(report.restored.len(), 3);
    assert_eq!(read(&dir, "assets/logo.png"), png, "二进制按字节恢复");
    assert_eq!(read(&dir, ".ainote/todos.json"), b"{\"schemaVersion\":3}");
    assert_eq!(read(&dir, ".gitignore"), b"secret.tmp\n");
    assert_clean(&dir);
}

#[test]
fn staged_only_addition_is_removed_from_index() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = dir_of(&tmp);
    let repo = init_repo(&dir);
    commit_files(&repo, &[("a.md", b"v1")], "c1");
    fs::write(dir.join("staged.md"), "staged").unwrap();
    let mut index = repo.index().unwrap();
    index.add_path(Path::new("staged.md")).unwrap();
    index.write().unwrap();

    let report = discard_working(dir.to_str().unwrap(), &["staged.md".into()]).unwrap();

    assert_eq!(report.deleted, vec!["staged.md"]);
    assert!(!dir.join("staged.md").exists());
    assert_clean(&dir);
}

#[test]
fn unborn_head_treats_every_path_as_added() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = dir_of(&tmp);
    let repo = init_repo(&dir);
    assert!(repo.head().is_err(), "空仓库没有 HEAD");
    fs::write(dir.join("a.md"), "only copy").unwrap();

    let report = discard_working(dir.to_str().unwrap(), &["a.md".into()]).unwrap();

    assert_eq!(report.deleted, vec!["a.md"]);
    assert!(!dir.join("a.md").exists());
}

#[test]
fn already_missing_added_file_is_skipped_without_error() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = dir_of(&tmp);
    let repo = init_repo(&dir);
    commit_files(&repo, &[("a.md", b"v1")], "c1");

    let report = discard_working(dir.to_str().unwrap(), &["ghost.md".into()]).unwrap();

    assert_eq!(report.deleted, vec!["ghost.md"], "幂等：没有文件也算处理完成");
    assert_clean(&dir);
}

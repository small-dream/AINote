use super::*;
use std::fs;
use std::path::PathBuf;

use crate::domain::sync::{ChangedFile, ChangedFileStatus};

fn init_repo(dir: &Path) -> Repository {
    let repo = Repository::init(dir).unwrap();
    let mut cfg = repo.config().unwrap();
    cfg.set_str("user.name", "tester").unwrap();
    cfg.set_str("user.email", "t@example.com").unwrap();
    repo
}

fn commit_file(repo: &Repository, path: &str, content: &str, msg: &str) {
    let abs = repo.path().parent().unwrap().join(path);
    fs::write(abs, content).unwrap();
    let mut index = repo.index().unwrap();
    index.add_path(Path::new(path)).unwrap();
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

fn repo_dir(tmp: &tempfile::TempDir) -> PathBuf {
    tmp.path().join("repo")
}

#[test]
fn changed_files_lists_added_modified_deleted_sorted() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = repo_dir(&tmp);
    fs::create_dir_all(&dir).unwrap();
    let repo = init_repo(&dir);
    commit_file(&repo, "a.md", "v1", "first");
    commit_file(&repo, "old.md", "old", "first");

    // 修改 a.md、删除 old.md、新建 untracked.md
    fs::write(dir.join("a.md"), "v2").unwrap();
    fs::remove_file(dir.join("old.md")).unwrap();
    fs::write(dir.join("untracked.md"), "new").unwrap();

    let files = changed_files(dir.to_str().unwrap()).unwrap();
    assert_eq!(
        files,
        vec![
            ChangedFile { path: "a.md".into(), status: ChangedFileStatus::Modified },
            ChangedFile { path: "old.md".into(), status: ChangedFileStatus::Deleted },
            ChangedFile { path: "untracked.md".into(), status: ChangedFileStatus::Added },
        ],
        "按路径排序，状态映射为 M/D/A"
    );
}

#[test]
fn changed_files_is_empty_when_clean() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = repo_dir(&tmp);
    fs::create_dir_all(&dir).unwrap();
    let repo = init_repo(&dir);
    commit_file(&repo, "a.md", "v1", "first");

    assert!(changed_files(dir.to_str().unwrap()).unwrap().is_empty());
}

#[test]
fn changed_files_ignores_ignored_files() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = repo_dir(&tmp);
    fs::create_dir_all(&dir).unwrap();
    let repo = init_repo(&dir);
    commit_file(&repo, "a.md", "v1", "first");
    fs::write(dir.join(".gitignore"), "secret.tmp\n").unwrap();

    fs::write(dir.join("secret.tmp"), "noise").unwrap();

    let files = changed_files(dir.to_str().unwrap()).unwrap();
    assert_eq!(files, vec![ChangedFile { path: ".gitignore".into(), status: ChangedFileStatus::Added }]);
}

#[test]
fn to_git_redacts_local_paths_in_message() {
    let err = to_git(git2::Error::from_str("failed to open /Users/jake/notes/.git"));
    let AppError::Git(message) = err else {
        panic!("应为 Git 变体");
    };
    assert!(!message.contains("/Users/jake"), "不透传本机绝对路径");
    assert!(message.contains("~/notes/.git"));
}

use super::*;
use std::fs;
use std::path::Path;
use std::path::PathBuf;

use crate::domain::sync::ChangedFileStatus;

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

fn delete_file(repo: &Repository, path: &str, msg: &str) {
    let abs = repo.path().parent().unwrap().join(path);
    fs::remove_file(abs).unwrap();
    let mut index = repo.index().unwrap();
    index.remove_path(Path::new(path)).unwrap();
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

fn file_status<'a>(files: &'a [ChangedFile], path: &str) -> ChangedFileStatus {
    files
        .iter()
        .find(|f| f.path == path)
        .map(|f| f.status)
        .expect("path present")
}

#[test]
fn repo_history_lists_newest_first_with_changed_files() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = repo_dir(&tmp);
    fs::create_dir_all(&dir).unwrap();
    let repo = init_repo(&dir);
    commit_file(&repo, "a.md", "v1", "first");
    commit_file(&repo, "b.md", "b", "second");
    commit_file(&repo, "a.md", "v2", "third");
    delete_file(&repo, "b.md", "fourth");

    let history = repo_history(dir.to_str().unwrap(), 10).unwrap();
    assert_eq!(history.len(), 4);
    assert_eq!(history[0].message, "fourth");
    assert_eq!(history[0].parents.len(), 1);
    assert_eq!(history[0].short_id.len(), 7);

    let first_files = &history[3].files;
    assert_eq!(file_status(first_files, "a.md"), ChangedFileStatus::Added);
    assert_eq!(history[2].files.len(), 1, "second 只改 b.md");
    assert_eq!(file_status(&history[2].files, "b.md"), ChangedFileStatus::Added);
    assert_eq!(
        file_status(&history[1].files, "a.md"),
        ChangedFileStatus::Modified
    );
    assert_eq!(
        file_status(&history[0].files, "b.md"),
        ChangedFileStatus::Deleted
    );
}

#[test]
fn repo_history_respects_limit() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = repo_dir(&tmp);
    fs::create_dir_all(&dir).unwrap();
    let repo = init_repo(&dir);
    for i in 0..5 {
        commit_file(&repo, "a.md", &format!("v{i}"), &format!("commit {i}"));
    }

    let limited = repo_history(dir.to_str().unwrap(), 3).unwrap();
    assert_eq!(limited.len(), 3);
    assert_eq!(limited[0].message, "commit 4");
}

#[test]
fn repo_history_is_empty_for_unborn_repo() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = repo_dir(&tmp);
    fs::create_dir_all(&dir).unwrap();
    let _repo = init_repo(&dir);
    assert!(repo_history(dir.to_str().unwrap(), 10).unwrap().is_empty());
}

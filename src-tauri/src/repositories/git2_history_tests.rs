use super::*;
use std::fs;

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
fn history_lists_only_commits_touching_file() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = repo_dir(&tmp);
    fs::create_dir_all(&dir).unwrap();
    let repo = init_repo(&dir);
    commit_file(&repo, "a.md", "# a\none", "first");
    commit_file(&repo, "b.md", "# b", "second");
    commit_file(&repo, "a.md", "# a\ntwo", "third");

    let history = file_history(dir.to_str().unwrap(), "a.md", 10).unwrap();
    assert_eq!(history.len(), 2);
    assert_eq!(history[0].message, "third");
    assert_eq!(history[1].message, "first");
    assert_eq!(history[0].short_id.len(), 7);
}

#[test]
fn diff_returns_added_and_removed_lines() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = repo_dir(&tmp);
    fs::create_dir_all(&dir).unwrap();
    let repo = init_repo(&dir);
    commit_file(&repo, "a.md", "line one\nline two\n", "first");
    commit_file(&repo, "a.md", "line one\nline three\n", "third");
    let id = repo.head().unwrap().peel_to_commit().unwrap().id().to_string();

    let diff = file_diff(dir.to_str().unwrap(), "a.md", &id).unwrap();
    let texts: Vec<&str> = diff.lines.iter().map(|l| l.text.as_str()).collect();
    assert!(texts.contains(&"line two"));
    assert!(texts.contains(&"line three"));
    assert!(diff.lines.iter().any(|l| l.kind == DiffLineKind::Removed));
    assert!(diff.lines.iter().any(|l| l.kind == DiffLineKind::Added));
}

#[test]
fn restore_file_writes_historical_content() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = repo_dir(&tmp);
    fs::create_dir_all(&dir).unwrap();
    let repo = init_repo(&dir);
    commit_file(&repo, "a.md", "v1 content", "first");
    let first_id = repo.head().unwrap().peel_to_commit().unwrap().id().to_string();
    commit_file(&repo, "a.md", "v2 content", "second");

    restore_file(dir.to_str().unwrap(), "a.md", &first_id).unwrap();
    let restored = fs::read_to_string(dir.join("a.md")).unwrap();
    assert_eq!(restored, "v1 content");
}

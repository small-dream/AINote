use super::*;
use std::fs;
use std::path::PathBuf;

fn init_repo(dir: &Path) -> Repository {
    let repo = Repository::init(dir).unwrap();
    let mut cfg = repo.config().unwrap();
    cfg.set_str("user.name", "tester").unwrap();
    cfg.set_str("user.email", "t@example.com").unwrap();
    repo
}

fn commit_file(repo: &Repository, path: &str, content: &str, message: &str) {
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
    repo.commit(Some("HEAD"), &sig, &sig, message, &tree, &parents)
        .unwrap();
}

fn repo_dir(tmp: &tempfile::TempDir) -> PathBuf {
    tmp.path().join("repo")
}

fn texts(diff: &WorkingDiff) -> Vec<&str> {
    diff.lines.iter().map(|line| line.text.as_str()).collect()
}

#[test]
fn returns_added_and_removed_lines_for_modified_file() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = repo_dir(&tmp);
    fs::create_dir_all(&dir).unwrap();
    let repo = init_repo(&dir);
    commit_file(&repo, "a.md", "line one\nline two\n", "first");
    fs::write(dir.join("a.md"), "line one\nline three\n").unwrap();

    let diff = working_diff(dir.to_str().unwrap(), "a.md").unwrap();
    assert!(texts(&diff).contains(&"line two"));
    assert!(texts(&diff).contains(&"line three"));
    assert!(diff
        .lines
        .iter()
        .any(|line| line.kind == DiffLineKind::Removed));
    assert!(diff
        .lines
        .iter()
        .any(|line| line.kind == DiffLineKind::Added));
    assert!(!diff.encrypted && !diff.binary && !diff.truncated);
}

#[test]
fn includes_untracked_added_file() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = repo_dir(&tmp);
    fs::create_dir_all(&dir).unwrap();
    let repo = init_repo(&dir);
    commit_file(&repo, "a.md", "# a\n", "first");
    fs::write(dir.join("new.md"), "brand new\n").unwrap();

    let diff = working_diff(dir.to_str().unwrap(), "new.md").unwrap();
    assert!(diff
        .lines
        .iter()
        .all(|line| line.kind == DiffLineKind::Added));
    assert!(texts(&diff).contains(&"brand new"));
}

#[test]
fn shows_removed_lines_for_deleted_file() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = repo_dir(&tmp);
    fs::create_dir_all(&dir).unwrap();
    let repo = init_repo(&dir);
    commit_file(&repo, "a.md", "will be deleted\n", "first");
    fs::remove_file(dir.join("a.md")).unwrap();

    let diff = working_diff(dir.to_str().unwrap(), "a.md").unwrap();
    assert!(diff
        .lines
        .iter()
        .any(|line| line.kind == DiffLineKind::Removed));
    assert!(texts(&diff).contains(&"will be deleted"));
}

#[test]
fn works_in_empty_repo_with_unborn_head() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = repo_dir(&tmp);
    fs::create_dir_all(&dir).unwrap();
    let _repo = init_repo(&dir);
    fs::write(dir.join("first.md"), "hello\n").unwrap();

    let diff = working_diff(dir.to_str().unwrap(), "first.md").unwrap();
    assert!(texts(&diff).contains(&"hello"));
}

#[test]
fn flags_binary_file_without_lines() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = repo_dir(&tmp);
    fs::create_dir_all(&dir).unwrap();
    let repo = init_repo(&dir);
    commit_file(&repo, "a.md", "text\n", "first");
    fs::write(dir.join("image.bin"), [0u8, 1, 2, 3, 0, 5]).unwrap();

    let diff = working_diff(dir.to_str().unwrap(), "image.bin").unwrap();
    assert!(diff.binary);
    assert!(diff.lines.is_empty());
}

#[test]
fn hides_encrypted_envelope_content() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = repo_dir(&tmp);
    fs::create_dir_all(&dir).unwrap();
    let repo = init_repo(&dir);
    commit_file(&repo, "secret.md", "plain\n", "first");
    fs::write(dir.join("secret.md"), "AINOTE-ENC-v1\nQUJD\n").unwrap();

    let diff = working_diff(dir.to_str().unwrap(), "secret.md").unwrap();
    assert!(diff.encrypted);
    assert!(diff.lines.is_empty());
}

#[test]
fn hides_deleted_encrypted_file_content() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = repo_dir(&tmp);
    fs::create_dir_all(&dir).unwrap();
    let repo = init_repo(&dir);
    commit_file(&repo, "secret.md", "AINOTE-ENC-v1\nQUJD\n", "first");
    fs::remove_file(dir.join("secret.md")).unwrap();

    let diff = working_diff(dir.to_str().unwrap(), "secret.md").unwrap();
    assert!(diff.encrypted);
    assert!(diff.lines.is_empty());
}

#[cfg(unix)]
#[test]
fn added_symlink_shows_target_without_following_it() {
    use std::os::unix::fs::symlink;

    let tmp = tempfile::tempdir().unwrap();
    let dir = repo_dir(&tmp);
    fs::create_dir_all(&dir).unwrap();
    let _repo = init_repo(&dir);
    fs::write(tmp.path().join("outside.md"), "must not be read\n").unwrap();
    symlink("../outside.md", dir.join("link.md")).unwrap();

    let diff = working_diff(dir.to_str().unwrap(), "link.md").unwrap();
    assert_eq!(texts(&diff), vec!["../outside.md"]);
}

#[test]
fn truncates_large_text_diff() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = repo_dir(&tmp);
    fs::create_dir_all(&dir).unwrap();
    let repo = init_repo(&dir);
    commit_file(&repo, "big.md", "old\n", "first");
    let body = (0..MAX_LINES + 50)
        .map(|n| format!("line {n}"))
        .collect::<Vec<_>>()
        .join("\n");
    fs::write(dir.join("big.md"), body).unwrap();

    let diff = working_diff(dir.to_str().unwrap(), "big.md").unwrap();
    assert!(diff.truncated);
    assert_eq!(diff.lines.len(), MAX_LINES);
}

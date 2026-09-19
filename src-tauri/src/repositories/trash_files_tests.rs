//! trash_files 单元测试：软删除/恢复/回收站行为，含符号链接（R1）与非笔记文件删除保护（R7）。

use super::*;
use std::fs;

fn setup() -> (tempfile::TempDir, PathBuf) {
    let tmp = tempfile::tempdir().unwrap();
    let root = tmp.path().to_path_buf();
    (tmp, root)
}

fn seed_note(root: &Path, rel: &str, content: &str) {
    let path = root.join(rel);
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, content).unwrap();
}

#[test]
fn soft_delete_moves_note_into_trash_and_records_original() {
    let (_tmp, root) = setup();
    seed_note(&root, "daily/a.md", "---\ntitle: 标题A\n---\n正文");
    let item = soft_delete_note(&root, "daily/a.md").unwrap();
    assert_eq!(item.path, "daily/a.md");
    assert_eq!(item.title, "标题A");
    assert!(!root.join("daily/a.md").exists());
    assert!(root.join(".trash").join(format!("{}.md", item.id)).is_file());
    let listed = list(&root).unwrap();
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].path, "daily/a.md");
}

#[test]
fn restore_puts_note_back_at_original_path() {
    let (_tmp, root) = setup();
    seed_note(&root, "a.md", "# 标题A\n正文");
    let item = soft_delete_note(&root, "a.md").unwrap();
    let restored = restore(&root, &item.id).unwrap();
    assert_eq!(restored, "a.md");
    assert_eq!(fs::read_to_string(root.join("a.md")).unwrap(), "# 标题A\n正文");
    assert!(list(&root).unwrap().is_empty());
}

#[test]
fn restore_avoids_collision_with_existing_file() {
    let (_tmp, root) = setup();
    seed_note(&root, "a.md", "旧内容");
    let item = soft_delete_note(&root, "a.md").unwrap();
    seed_note(&root, "a.md", "新内容");
    let restored = restore(&root, &item.id).unwrap();
    assert_eq!(restored, "a-1.md");
    assert_eq!(fs::read_to_string(root.join("a-1.md")).unwrap(), "旧内容");
}

#[test]
fn permanent_delete_removes_file_and_manifest_entry() {
    let (_tmp, root) = setup();
    seed_note(&root, "a.md", "x");
    let item = soft_delete_note(&root, "a.md").unwrap();
    permanent_delete(&root, &item.id).unwrap();
    assert!(!root.join(".trash").join(format!("{}.md", item.id)).exists());
    assert!(list(&root).unwrap().is_empty());
}

#[test]
fn empty_clears_all_items() {
    let (_tmp, root) = setup();
    seed_note(&root, "a.md", "x");
    seed_note(&root, "b/c.md", "y");
    soft_delete_note(&root, "a.md").unwrap();
    soft_delete_note(&root, "b/c.md").unwrap();
    empty(&root).unwrap();
    assert!(list(&root).unwrap().is_empty());
    assert!(!root.join(".trash/manifest.json").exists());
}

#[test]
fn soft_delete_folder_recurses_and_removes_dir() {
    let (_tmp, root) = setup();
    seed_note(&root, "f/a.md", "A");
    seed_note(&root, "f/sub/b.md", "B");
    let items = soft_delete_folder(&root, "f").unwrap();
    assert_eq!(items.len(), 2);
    assert!(!root.join("f").exists());
    assert_eq!(list(&root).unwrap().len(), 2);
}

#[test]
fn missing_note_returns_not_found() {
    let (_tmp, root) = setup();
    assert!(matches!(
        soft_delete_note(&root, "nope.md"),
        Err(AppError::NoteNotFound(_))
    ));
}

/// R7：目录含非笔记文件（图片）时拒绝删除，且不丢失任何文件。
#[test]
fn folder_with_non_note_files_is_refused_and_nothing_is_lost() {
    let (_tmp, root) = setup();
    seed_note(&root, "f/a.md", "A");
    seed_note(&root, "f/sub/b.md", "B");
    fs::write(root.join("f/pic.png"), b"png").unwrap();
    fs::write(root.join("f/sub/manual.pdf"), b"pdf").unwrap();

    let err = soft_delete_folder(&root, "f").unwrap_err();
    let AppError::FolderHasNonNoteFiles(message) = err else {
        panic!("应为 FolderHasNonNoteFiles");
    };
    assert!(message.contains("pic.png"), "错误消息应列出文件名: {message}");
    assert!(message.contains("manual.pdf"), "子目录文件也应列出: {message}");
    // 任何文件都不得被删除或移入回收站
    assert!(root.join("f/a.md").is_file());
    assert!(root.join("f/sub/b.md").is_file());
    assert!(root.join("f/pic.png").is_file());
    assert!(root.join("f/sub/manual.pdf").is_file());
    assert!(list(&root).unwrap().is_empty());
}

/// R7：隐藏文件（如 macOS 的 `.DS_Store`）不算非笔记文件，纯笔记目录正常删除。
#[test]
fn folder_with_ds_store_and_notes_still_deleted() {
    let (_tmp, root) = setup();
    seed_note(&root, "f/a.md", "A");
    fs::write(root.join("f/.DS_Store"), b"ds").unwrap();

    let items = soft_delete_folder(&root, "f").unwrap();
    assert_eq!(items.len(), 1);
    assert!(!root.join("f").exists());
}

/// R7：目录内的符号链接按非笔记条目处理，拒绝删除；
/// 同时证明指向祖先目录的链接不会导致无限递归（测试能结束即证明）。
#[cfg(unix)]
#[test]
fn folder_with_symlink_is_refused_without_recursion() {
    let (_tmp, root) = setup();
    seed_note(&root, "f/a.md", "A");
    std::os::unix::fs::symlink(&root, root.join("f/loop")).unwrap();

    let err = soft_delete_folder(&root, "f").unwrap_err();
    assert!(matches!(err, AppError::FolderHasNonNoteFiles(_)));
    assert!(root.join("f/a.md").is_file(), "任何文件都不得被动");
}

/// R1：软删除经指向仓库外文件的符号链接必须拒绝（AppError 而非读出/删除外部文件）。
#[cfg(unix)]
#[test]
fn soft_delete_rejects_symlink_escaping_root() {
    let (_tmp, root) = setup();
    let outside = tempfile::NamedTempFile::new().unwrap();
    fs::write(outside.path(), "secret").unwrap();
    std::os::unix::fs::symlink(outside.path(), root.join("leak.md")).unwrap();

    assert!(matches!(
        soft_delete_note(&root, "leak.md"),
        Err(AppError::InvalidPath(_))
    ));
    assert_eq!(fs::read_to_string(outside.path()).unwrap(), "secret");
}

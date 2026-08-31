use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::domain::error::AppError;
use crate::domain::note::extract_title;
use crate::domain::trash::TrashItem;

use super::file_storage::is_hidden;
use super::note_files::validate_rel_path;

/// 回收站目录（隐藏 → 搜索/wiki/文件树自动忽略，Git 版本化随仓库同步）
pub const TRASH_DIR: &str = ".trash";
const MANIFEST: &str = ".trash/manifest.json";

pub fn read_manifest(root: &Path) -> Result<Vec<TrashItem>, AppError> {
    let path = root.join(MANIFEST);
    if !path.is_file() {
        return Ok(Vec::new());
    }
    let raw = fs::read_to_string(path)?;
    serde_json::from_str(&raw).map_err(|e| AppError::Io(e.to_string()))
}

fn write_manifest(root: &Path, items: &[TrashItem]) -> Result<(), AppError> {
    fs::create_dir_all(root.join(TRASH_DIR))?;
    let raw = serde_json::to_string_pretty(items).map_err(|e| AppError::Io(e.to_string()))?;
    Ok(fs::write(root.join(MANIFEST), raw)?)
}

/// 按删除时间倒序返回全部回收站条目。
pub fn list(root: &Path) -> Result<Vec<TrashItem>, AppError> {
    let mut items = read_manifest(root)?;
    items.sort_by(|a, b| b.deleted_at.cmp(&a.deleted_at));
    Ok(items)
}

/// 软删除单篇笔记：正文移入 `.trash/<id>.md`，原路径记入 manifest，再移除原文件。
pub fn soft_delete_note(root: &Path, rel: &str) -> Result<TrashItem, AppError> {
    let rel = validate_rel_path(rel)?;
    let src = root.join(&rel);
    if !src.is_file() {
        return Err(AppError::NoteNotFound(rel.to_string_lossy().into_owned()));
    }
    let content = fs::read_to_string(&src)?;
    let fallback = src
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_default();
    let item = TrashItem {
        id: new_id(&rel.to_string_lossy()),
        path: rel.to_string_lossy().into_owned(),
        deleted_at: now_secs(),
        title: extract_title(&content, &fallback),
    };
    let mut items = read_manifest(root)?;
    fs::create_dir_all(root.join(TRASH_DIR))?;
    fs::write(root.join(TRASH_DIR).join(format!("{}.md", item.id)), content)?;
    items.push(item.clone());
    write_manifest(root, &items)?;
    fs::remove_file(&src)?;
    Ok(item)
}

/// 软删除目录：递归移入其内全部 `.md` 笔记到回收站，随后移除该目录。
pub fn soft_delete_folder(root: &Path, rel: &str) -> Result<Vec<TrashItem>, AppError> {
    let files = collect_md_files(root, rel)?;
    let mut items = Vec::new();
    for file in &files {
        let file_rel = file
            .strip_prefix(root)
            .map_err(|e| AppError::Io(e.to_string()))?
            .to_string_lossy()
            .into_owned();
        items.push(soft_delete_note(root, &file_rel)?);
    }
    let dir = root.join(validate_rel_path(rel)?);
    if dir.is_dir() {
        fs::remove_dir_all(&dir)?;
    }
    Ok(items)
}

/// 恢复指定条目到原路径；原路径已被占用时自动追加 `-1`、`-2`…。
pub fn restore(root: &Path, id: &str) -> Result<String, AppError> {
    let mut items = read_manifest(root)?;
    let index = items
        .iter()
        .position(|i| i.id == id)
        .ok_or_else(|| AppError::Repo(format!("trash item not found: {id}")))?;
    let item = items.remove(index);
    let src = root.join(TRASH_DIR).join(format!("{id}.md"));
    if !src.is_file() {
        return Err(AppError::Repo(format!("trash file missing: {id}")));
    }
    let content = fs::read_to_string(&src)?;
    let target = if root.join(&item.path).exists() {
        dedup_target(root, &item.path)
    } else {
        PathBuf::from(&item.path)
    };
    if let Some(parent) = target.parent() {
        fs::create_dir_all(root.join(parent))?;
    }
    fs::write(root.join(&target), content)?;
    fs::remove_file(&src)?;
    write_manifest(root, &items)?;
    Ok(target.to_string_lossy().into_owned())
}

/// 彻底删除单个回收站条目。
pub fn permanent_delete(root: &Path, id: &str) -> Result<(), AppError> {
    let mut items = read_manifest(root)?;
    if !items.iter().any(|i| i.id == id) {
        return Err(AppError::Repo(format!("trash item not found: {id}")));
    }
    items.retain(|i| i.id != id);
    fs::remove_file(root.join(TRASH_DIR).join(format!("{id}.md")))?;
    write_manifest(root, &items)
}

/// 清空回收站：删除全部正文文件与 manifest。
pub fn empty(root: &Path) -> Result<(), AppError> {
    let items = read_manifest(root)?;
    for item in &items {
        let _ = fs::remove_file(root.join(TRASH_DIR).join(format!("{}.md", item.id)));
    }
    let manifest = root.join(MANIFEST);
    if manifest.is_file() {
        fs::remove_file(manifest)?;
    }
    Ok(())
}

/// 递归收集目录内的 `.md` 文件（跳过隐藏项），供目录软删除。
fn collect_md_files(root: &Path, rel: &str) -> Result<Vec<PathBuf>, AppError> {
    let dir = root.join(validate_rel_path(rel)?);
    if !dir.is_dir() {
        return Err(AppError::Io(format!("folder not found: {rel}")));
    }
    let mut files = Vec::new();
    walk_md(&dir, &mut files)?;
    files.sort();
    Ok(files)
}

fn walk_md(dir: &Path, out: &mut Vec<PathBuf>) -> Result<(), AppError> {
    for entry in fs::read_dir(dir)? {
        let path = entry?.path();
        if is_hidden(&path) {
            continue;
        }
        if path.is_dir() {
            walk_md(&path, out)?;
        } else if path.extension().is_some_and(|ext| ext == "md") {
            out.push(path);
        }
    }
    Ok(())
}

/// 原路径被占用时生成不冲突的恢复路径（同目录追加 `-1`、`-2`…）。
fn dedup_target(root: &Path, path: &str) -> PathBuf {
    let path = Path::new(path);
    let stem = path
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| "restored".into());
    let ext = path
        .extension()
        .map(|e| format!(".{}", e.to_string_lossy()))
        .unwrap_or_default();
    let parent = path
        .parent()
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_default();
    for n in 1.. {
        let name = format!("{stem}-{n}{ext}");
        let candidate = if parent.is_empty() {
            PathBuf::from(name)
        } else {
            Path::new(&parent).join(name)
        };
        if !root.join(&candidate).exists() {
            return candidate;
        }
    }
    unreachable!()
}

fn new_id(path: &str) -> String {
    let secs = now_secs();
    format!("{secs}-{hash:016x}", hash = fnv1a(path))
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn fnv1a(text: &str) -> u64 {
    let mut hash = 0xcbf2_9ce4_8422_2325u64;
    for byte in text.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
    }
    hash
}

#[cfg(test)]
mod tests {
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
        seed_note(&root, "daily/a.md", "# 标题A\n正文");
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
}

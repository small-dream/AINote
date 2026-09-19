use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::domain::error::AppError;
use crate::domain::note::{extract_title, is_note_file, NoteKind};
use crate::domain::rich_text;
use crate::domain::trash::TrashItem;

use super::file_storage::is_hidden;
use super::note_files::{resolve_within_root, validate_rel_path};

/// 回收站目录（隐藏 → 搜索/wiki/文件树自动忽略，Git 版本化随仓库同步）
pub const TRASH_DIR: &str = ".trash";
const MANIFEST: &str = ".trash/manifest.json";

pub fn read_manifest(root: &Path) -> Result<Vec<TrashItem>, AppError> {
    let path = root.join(MANIFEST);
    if !path.is_file() {
        return Ok(Vec::new());
    }
    let raw = fs::read_to_string(&path).map_err(|err| AppError::io_context("读取回收站清单失败", &path, err))?;
    serde_json::from_str(&raw).map_err(|e| AppError::Io(e.to_string()))
}

fn write_manifest(root: &Path, items: &[TrashItem]) -> Result<(), AppError> {
    let dir = root.join(TRASH_DIR);
    fs::create_dir_all(&dir).map_err(|err| AppError::io_context("创建回收站目录失败", &dir, err))?;
    let raw = serde_json::to_string_pretty(items).map_err(|e| AppError::Io(e.to_string()))?;
    let path = root.join(MANIFEST);
    fs::write(&path, raw).map_err(|err| AppError::io_context("写入回收站清单失败", &path, err))
}

/// 按删除时间倒序返回全部回收站条目。
pub fn list(root: &Path) -> Result<Vec<TrashItem>, AppError> {
    let mut items = read_manifest(root)?;
    items.sort_by_key(|item| std::cmp::Reverse(item.deleted_at));
    Ok(items)
}

/// 软删除单篇笔记：正文移入 `.trash/<id>.md`，原路径记入 manifest，再移除原文件。
pub fn soft_delete_note(root: &Path, rel: &str) -> Result<TrashItem, AppError> {
    let rel = validate_rel_path(rel)?;
    let src = resolve_within_root(root, &rel)?;
    if !src.is_file() {
        return Err(AppError::NoteNotFound(rel.to_string_lossy().into_owned()));
    }
    let content = fs::read_to_string(&src).map_err(|err| AppError::io_context("读取失败", &src, err))?;
    let fallback = src
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_default();
    let kind = NoteKind::of_path(&src).unwrap_or(NoteKind::Markdown);
    let title = match kind {
        NoteKind::Markdown => extract_title(&content, &fallback),
        NoteKind::RichText => rich_text::extract_title(&content).unwrap_or(fallback),
    };
    let item = TrashItem {
        id: new_id(&rel.to_string_lossy()),
        path: rel.to_string_lossy().into_owned(),
        deleted_at: now_secs(),
        title,
    };
    let mut items = read_manifest(root)?;
    let trash_dir = root.join(TRASH_DIR);
    fs::create_dir_all(&trash_dir)
        .map_err(|err| AppError::io_context("创建回收站目录失败", &trash_dir, err))?;
    let trashed = trash_dir.join(format!("{}.md", item.id));
    fs::write(&trashed, content).map_err(|err| AppError::io_context("写入回收站失败", &trashed, err))?;
    items.push(item.clone());
    write_manifest(root, &items)?;
    fs::remove_file(&src).map_err(|err| AppError::io_context("删除失败", &src, err))?;
    Ok(item)
}

/// 软删除目录：仅当目录内全部为笔记文件（隐藏项除外）时执行——
/// 递归移入全部笔记到回收站后移除目录；存在非笔记文件则整体拒绝，避免不可恢复的数据丢失（R7）。
pub fn soft_delete_folder(root: &Path, rel: &str) -> Result<Vec<TrashItem>, AppError> {
    let dir = resolve_within_root(root, &validate_rel_path(rel)?)?;
    if !dir.is_dir() {
        return Err(AppError::Io(format!("folder not found: {rel}")));
    }
    ensure_only_note_files(&dir)?;
    let mut files = Vec::new();
    walk_notes(&dir, &mut files)?;
    files.sort();
    let mut items = Vec::new();
    for file in &files {
        let file_rel = file
            .strip_prefix(root)
            .map_err(|e| AppError::Io(e.to_string()))?
            .to_string_lossy()
            .into_owned();
        items.push(soft_delete_note(root, &file_rel)?);
    }
    fs::remove_dir_all(&dir).map_err(|err| AppError::io_context("删除目录失败", &dir, err))?;
    Ok(items)
}

/// R7 数据安全：目录（含子目录）内存在「非笔记且非隐藏」条目（含符号链接）时拒绝删除，
/// 错误消息最多列出前几个文件名；隐藏文件（如 `.DS_Store`）除外，避免 macOS 误伤。
fn ensure_only_note_files(dir: &Path) -> Result<(), AppError> {
    const MAX_LISTED: usize = 3;
    let mut offenders: Vec<String> = Vec::new();
    collect_non_note_files(dir, dir, &mut offenders, MAX_LISTED)?;
    if offenders.is_empty() {
        return Ok(());
    }
    Err(AppError::FolderHasNonNoteFiles(format!(
        "目录包含非笔记文件，已取消删除（请先移出）：{}",
        offenders.join("、")
    )))
}

fn collect_non_note_files(
    base: &Path,
    dir: &Path,
    out: &mut Vec<String>,
    max: usize,
) -> Result<(), AppError> {
    if out.len() >= max {
        return Ok(());
    }
    let entries = fs::read_dir(dir).map_err(|err| AppError::io_context("列目录失败", dir, err))?;
    for entry in entries {
        let entry = entry.map_err(|err| AppError::io_context("列目录失败", dir, err))?;
        let file_type = entry
            .file_type()
            .map_err(|err| AppError::io_context("读取文件类型失败", dir, err))?;
        let path = entry.path();
        if is_hidden(&path) {
            continue;
        }
        // 符号链接（含指向祖先的目录链接）不跟随，按非笔记条目计入，拒绝删除以防误删
        if file_type.is_symlink() || (file_type.is_file() && !is_note_file(&path)) {
            let shown = path.strip_prefix(base).unwrap_or(&path);
            out.push(shown.to_string_lossy().into_owned());
        } else if file_type.is_dir() {
            collect_non_note_files(base, &path, out, max)?;
        }
        if out.len() >= max {
            return Ok(());
        }
    }
    Ok(())
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
    let content = fs::read_to_string(&src).map_err(|err| AppError::io_context("读取回收站失败", &src, err))?;
    let target = if root.join(&item.path).exists() {
        dedup_target(root, &item.path)
    } else {
        PathBuf::from(&item.path)
    };
    if let Some(parent) = target.parent() {
        let dir = root.join(parent);
        fs::create_dir_all(&dir).map_err(|err| AppError::io_context("创建目录失败", &dir, err))?;
    }
    let dest = resolve_within_root(root, &target)?;
    fs::write(&dest, content).map_err(|err| AppError::io_context("写入失败", &dest, err))?;
    fs::remove_file(&src).map_err(|err| AppError::io_context("删除失败", &src, err))?;
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
    let path = root.join(TRASH_DIR).join(format!("{id}.md"));
    fs::remove_file(&path).map_err(|err| AppError::io_context("删除回收站文件失败", &path, err))?;
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
        fs::remove_file(&manifest)
            .map_err(|err| AppError::io_context("删除回收站清单失败", &manifest, err))?;
    }
    Ok(())
}

/// 递归收集目录内的笔记文件（跳过隐藏项与符号链接），供目录软删除。
/// `file_type()` 不跟随符号链接（R1）：链接条目一律跳过，避免经链接删除/收集仓库外文件或无限递归。
fn walk_notes(dir: &Path, out: &mut Vec<PathBuf>) -> Result<(), AppError> {
    let entries = fs::read_dir(dir).map_err(|err| AppError::io_context("列目录失败", dir, err))?;
    for entry in entries {
        let entry = entry.map_err(|err| AppError::io_context("列目录失败", dir, err))?;
        let file_type = entry
            .file_type()
            .map_err(|err| AppError::io_context("读取文件类型失败", dir, err))?;
        let path = entry.path();
        if is_hidden(&path) || file_type.is_symlink() {
            continue;
        }
        if file_type.is_dir() {
            walk_notes(&path, out)?;
        } else if file_type.is_file() && is_note_file(&path) {
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
#[path = "trash_files_tests.rs"]
mod tests;

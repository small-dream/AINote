use std::collections::HashMap;
use std::path::Path;

use crate::domain::favorite::toggle_favorite;
use crate::domain::error::AppError;
use crate::domain::note::{NoteKind, NoteMeta};
use crate::repositories::{favorite_files, note_files};
use crate::services::note_service;

/// 用例：按收藏顺序返回仍存在的笔记；列表不修改索引，避免读操作产生 Git 变更。
pub fn list_favorite_notes(repo_path: &Path) -> Result<Vec<NoteMeta>, AppError> {
    let index = favorite_files::load(repo_path)?;
    let notes = note_service::list_notes(repo_path)?;
    let notes_by_path: HashMap<String, NoteMeta> = notes
        .into_iter()
        .map(|note| (note.path.clone(), note))
        .collect();
    Ok(index
        .paths
        .into_iter()
        .rev()
        .filter_map(|path| notes_by_path.get(&path).cloned())
        .collect())
}

/// 用例：切换收藏状态并清理已失效路径；返回切换后的状态。
pub fn toggle_note_favorite(repo_path: &Path, rel: &str) -> Result<bool, AppError> {
    let path = note_files::validate_rel_path(rel)?
        .to_string_lossy()
        .into_owned();
    if NoteKind::of_path(Path::new(&path)).is_none() || !repo_path.join(&path).is_file() {
        return Err(AppError::NoteNotFound(rel.to_string()));
    }

    let mut index = favorite_files::load(repo_path)?;
    let note_exists = |path: &String| repo_path.join(path).is_file();
    index.paths.retain(note_exists);
    let is_favorite = toggle_favorite(&mut index.paths, &path);
    favorite_files::save(repo_path, &index.paths)?;
    Ok(is_favorite)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write(root: &Path, path: &str, content: &str) {
        note_files::write_note(root, path, content).unwrap();
    }

    #[test]
    fn toggles_and_lists_existing_favorites() {
        let root = tempfile::tempdir().unwrap();
        write(root.path(), "a.md", "# First");
        write(root.path(), "sub/b.md", "# Second");

        assert!(toggle_note_favorite(root.path(), "a.md").unwrap());
        assert!(toggle_note_favorite(root.path(), "sub/b.md").unwrap());
        let favorites = list_favorite_notes(root.path()).unwrap();
        assert_eq!(
            favorites.iter().map(|note| note.title.as_str()).collect::<Vec<_>>(),
            vec!["b", "a"]
        );

        assert!(!toggle_note_favorite(root.path(), "a.md").unwrap());
        let favorites = list_favorite_notes(root.path()).unwrap();
        assert_eq!(favorites.len(), 1);
        assert_eq!(favorites[0].title, "b");
    }

    #[test]
    fn filters_missing_and_stale_paths() {
        let root = tempfile::tempdir().unwrap();
        write(root.path(), "exists.md", "# Exists");
        toggle_note_favorite(root.path(), "exists.md").unwrap();
        toggle_note_favorite(root.path(), "missing.md").unwrap_err();

        std::fs::remove_file(root.path().join("exists.md")).unwrap();
        assert!(list_favorite_notes(root.path()).unwrap().is_empty());
    }
}

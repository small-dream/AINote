use std::fs;
use std::path::Path;

use crate::domain::favorite::{FavoriteIndex, FAVORITE_SCHEMA_VERSION};
use crate::domain::error::AppError;

pub const FAVORITES_FILE: &str = ".ainote/favorites.json";

/// Repository 边界：读取收藏索引；缺失文件视为空收藏。
pub fn load(root: &Path) -> Result<FavoriteIndex, AppError> {
    let path = root.join(FAVORITES_FILE);
    if !path.is_file() {
        return Ok(FavoriteIndex {
            schema_version: FAVORITE_SCHEMA_VERSION,
            paths: Vec::new(),
        });
    }

    let raw = fs::read_to_string(path)?;
    let index: FavoriteIndex = serde_json::from_str(&raw)
        .map_err(|error| AppError::Repo(format!("invalid favorites index: {error}")))?;
    Ok(index)
}

/// Repository 边界：原子写入收藏索引，避免半写状态破坏 JSON。
pub fn save(root: &Path, paths: &[String]) -> Result<(), AppError> {
    let path = root.join(FAVORITES_FILE);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let index = FavoriteIndex {
        schema_version: FAVORITE_SCHEMA_VERSION,
        paths: paths.to_vec(),
    };
    let temporary = path.with_extension("tmp");
    let serialized = serde_json::to_vec_pretty(&index)
        .map_err(|error| AppError::Repo(format!("serialize favorites failed: {error}")))?;
    fs::write(&temporary, serialized)?;
    fs::rename(&temporary, &path)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn load_treats_missing_index_as_empty() {
        let root = tempfile::tempdir().unwrap();
        let index = load(root.path()).unwrap();
        assert!(index.paths.is_empty());
        assert_eq!(index.schema_version, FAVORITE_SCHEMA_VERSION);
    }

    #[test]
    fn save_and_load_round_trips_paths() {
        let root = tempfile::tempdir().unwrap();
        save(root.path(), &["a.md".to_string(), "b.md".to_string()]).unwrap();
        let index = load(root.path()).unwrap();
        assert_eq!(index.paths, vec!["a.md".to_string(), "b.md".to_string()]);
    }
}

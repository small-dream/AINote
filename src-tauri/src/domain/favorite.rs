use serde::{Deserialize, Serialize};

pub const FAVORITE_SCHEMA_VERSION: u32 = 1;

/// 收藏索引的落盘结构；`schemaVersion` 供后续规则演进使用。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FavoriteIndex {
    pub schema_version: u32,
    #[serde(default)]
    pub paths: Vec<String>,
}

/// 纯函数：切换指定路径的收藏状态。返回切换后的状态，并保证路径唯一。
pub fn toggle_favorite(paths: &mut Vec<String>, path: &str) -> bool {
    match paths.iter().position(|item| item == path) {
        Some(index) => {
            paths.remove(index);
            false
        }
        None => {
            paths.push(path.to_string());
            true
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn toggle_adds_missing_path_without_duplicates() {
        let mut paths = vec!["a.md".to_string()];
        assert!(toggle_favorite(&mut paths, "b.md"));
        assert_eq!(paths, vec!["a.md".to_string(), "b.md".to_string()]);
    }

    #[test]
    fn toggle_removes_existing_path() {
        let mut paths = vec!["a.md".to_string(), "b.md".to_string()];
        assert!(!toggle_favorite(&mut paths, "a.md"));
        assert_eq!(paths, vec!["b.md".to_string()]);
    }
}

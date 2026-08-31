use std::fs;
use std::path::{Path, PathBuf};

use crate::domain::asset::AssetInfo;
use crate::domain::error::AppError;

const ASSET_DIR: &str = "assets";

/// 纯函数：规范化文件名（保留字母数字、CJK、`-` `_` `.`，其余转 `_`；去首尾点；空则回退 file）。
pub fn sanitize_file_name(name: &str) -> String {
    let mut cleaned: String = name
        .trim()
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' || c == '.' {
                c
            } else {
                '_'
            }
        })
        .collect();
    cleaned = cleaned.trim_matches('.').to_string();
    if cleaned.is_empty() {
        "file".to_string()
    } else {
        cleaned
    }
}

/// 纯函数：小写扩展名（不含点）；无扩展返回空串。
pub fn file_extension(name: &str) -> String {
    Path::new(name)
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default()
}

/// 把源文件复制到仓库 `assets/` 下（重名自动加序号），返回仓库相对路径。
pub fn import_from_path(root: &Path, source: &Path) -> Result<AssetInfo, AppError> {
    let bytes = fs::read(source)?;
    let name = source
        .file_name()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| "file".to_string());
    write_unique(root, &bytes, &sanitize_file_name(&name))
}

/// 把内存字节写入仓库 `assets/` 下（重名自动加序号），返回仓库相对路径。
pub fn import_bytes(root: &Path, bytes: &[u8], file_name: &str) -> Result<AssetInfo, AppError> {
    write_unique(root, bytes, &sanitize_file_name(file_name))
}

fn write_unique(root: &Path, bytes: &[u8], name: &str) -> Result<AssetInfo, AppError> {
    let dir = root.join(ASSET_DIR);
    fs::create_dir_all(&dir)?;
    let target = unique_asset_path(root, name);
    fs::write(&target, bytes)?;
    let rel = target
        .strip_prefix(root)
        .map_err(|e| AppError::Io(e.to_string()))?;
    Ok(AssetInfo {
        path: rel.to_string_lossy().into_owned(),
    })
}

/// 纯函数：`assets/<name>` 已存在时在扩展名前插入 `-1`/`-2`/…，返回不冲突的目标路径。
pub fn unique_asset_path(root: &Path, name: &str) -> PathBuf {
    let base = root.join(ASSET_DIR).join(name);
    if !base.exists() {
        return base;
    }
    let stem = base
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_default();
    let ext = base
        .extension()
        .map(|e| format!(".{}", e.to_string_lossy()))
        .unwrap_or_default();
    for i in 1.. {
        let candidate = root.join(ASSET_DIR).join(format!("{stem}-{i}{ext}"));
        if !candidate.exists() {
            return candidate;
        }
    }
    unreachable!()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_name_keeps_safe_chars() {
        assert_eq!(sanitize_file_name("我的图.png"), "我的图.png");
        assert_eq!(sanitize_file_name("a/b: c?.png"), "a_b__c_.png");
        assert_eq!(sanitize_file_name("..hidden.."), "hidden");
        assert_eq!(sanitize_file_name("   "), "file");
        assert_eq!(sanitize_file_name("a-b_c.d"), "a-b_c.d");
    }

    #[test]
    fn extension_is_lowercased_without_dot() {
        assert_eq!(file_extension("X.PNG"), "png");
        assert_eq!(file_extension("archive.tar.gz"), "gz");
        assert_eq!(file_extension("noext"), "");
    }

    #[test]
    fn unique_path_appends_suffix_on_collision() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path();
        fs::create_dir_all(root.join("assets")).unwrap();
        fs::write(root.join("assets/a.png"), "1").unwrap();
        fs::write(root.join("assets/a-1.png"), "2").unwrap();
        let next = unique_asset_path(root, "a.png");
        assert_eq!(next, root.join("assets/a-2.png"));
    }

    #[test]
    fn import_bytes_writes_to_assets_and_returns_rel_path() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path();
        let info = import_bytes(root, b"\x89PNG", "pic.png").unwrap();
        assert_eq!(info.path, "assets/pic.png");
        assert!(root.join("assets/pic.png").is_file());
        let again = import_bytes(root, b"x", "pic.png").unwrap();
        assert_eq!(again.path, "assets/pic-1.png");
    }

    #[test]
    fn import_from_path_copies_source() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path();
        let src = root.join("src.png");
        fs::write(&src, b"data").unwrap();
        let info = import_from_path(root, &src).unwrap();
        assert_eq!(info.path, "assets/src.png");
        assert_eq!(fs::read(root.join("assets/src.png")).unwrap(), b"data");
    }
}

use std::fs;
use std::path::{Path, PathBuf};

use crate::domain::error::AppError;

/// 文件系统访问抽象的实现：递归收集仓库内的 Markdown 文件。
/// 纯 IO 层，不含业务规则；业务编排在 services/。
pub fn collect_markdown_files(root: &Path) -> Result<Vec<PathBuf>, AppError> {
    if !root.is_dir() {
        return Err(AppError::Repo(format!(
            "not a directory: {}",
            root.display()
        )));
    }
    let mut files = Vec::new();
    walk(root, root, &mut files)?;
    files.sort();
    Ok(files)
}

fn walk(root: &Path, dir: &Path, out: &mut Vec<PathBuf>) -> Result<(), AppError> {
    for entry in fs::read_dir(dir)? {
        let path = entry?.path();
        if is_hidden(&path) {
            continue;
        }
        if path.is_dir() {
            walk(root, &path, out)?;
        } else if path.extension().is_some_and(|ext| ext == "md") {
            out.push(path);
        }
    }
    Ok(())
}

fn is_hidden(path: &Path) -> bool {
    path.file_name()
        .is_some_and(|name| name.to_string_lossy().starts_with('.'))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{create_dir_all, File};

    #[test]
    fn collects_only_markdown_and_skips_hidden() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path();
        create_dir_all(root.join("daily")).unwrap();
        create_dir_all(root.join(".git")).unwrap();
        File::create(root.join("a.md")).unwrap();
        File::create(root.join("daily/b.md")).unwrap();
        File::create(root.join("c.txt")).unwrap();
        File::create(root.join(".git/ignored.md")).unwrap();

        let files = collect_markdown_files(root).unwrap();
        assert_eq!(files.len(), 2);
    }

    #[test]
    fn rejects_non_directory() {
        let err = collect_markdown_files(Path::new("/nonexistent/path")).unwrap_err();
        assert!(matches!(err, AppError::Repo(_)));
    }
}

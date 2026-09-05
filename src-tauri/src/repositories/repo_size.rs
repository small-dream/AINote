use std::fs;
use std::path::Path;

use crate::domain::error::AppError;

/// 统计 Git 仓库在磁盘上的文件大小（字节），包含 `.git` 历史库。
/// 符号链接不跟随，避免递归循环或统计仓库外的数据。
pub fn repo_size(root: &Path) -> Result<u64, AppError> {
    let metadata = fs::symlink_metadata(root).map_err(AppError::from)?;
    if !metadata.is_dir() {
        return Err(AppError::Repo(format!(
            "not a directory: {}",
            root.display()
        )));
    }
    walk(root)
}

fn walk(dir: &Path) -> Result<u64, AppError> {
    let mut size = 0;
    for entry in fs::read_dir(dir).map_err(AppError::from)? {
        let entry = entry.map_err(AppError::from)?;
        let path = entry.path();
        let metadata = fs::symlink_metadata(&path).map_err(AppError::from)?;
        if metadata.is_dir() {
            size += walk(&path)?;
        } else if metadata.is_file() {
            size += metadata.len();
        }
    }
    Ok(size)
}

#[cfg(test)]
mod tests {
    use std::fs::{create_dir_all, File};
    use std::io::Write;

    use tempfile::tempdir;

    use super::*;

    #[test]
    fn sums_regular_files_including_git_directory() {
        let tmp = tempdir().unwrap();
        create_dir_all(tmp.path().join(".git/objects")).unwrap();
        create_dir_all(tmp.path().join("daily")).unwrap();
        write_file(&tmp.path().join("a.md"), b"note");
        write_file(&tmp.path().join("daily/b.md"), b"note two");
        write_file(&tmp.path().join(".git/objects/pack"), b"history");

        assert_eq!(repo_size(tmp.path()).unwrap(), 19);
    }

    #[test]
    fn skips_symbolic_links() {
        let tmp = tempdir().unwrap();
        write_file(&tmp.path().join("a.md"), b"note");
        #[cfg(unix)]
        std::os::unix::fs::symlink("/tmp", tmp.path().join("outside")).unwrap();

        assert_eq!(repo_size(tmp.path()).unwrap(), 4);
    }

    #[test]
    fn rejects_missing_or_non_directory() {
        let tmp = tempdir().unwrap();
        let file = tmp.path().join("file.md");
        write_file(&file, b"note");

        assert!(repo_size(&file).is_err());
        assert!(repo_size(&tmp.path().join("missing")).is_err());
    }

    fn write_file(path: &Path, contents: &[u8]) {
        let mut file = File::create(path).unwrap();
        file.write_all(contents).unwrap();
    }
}

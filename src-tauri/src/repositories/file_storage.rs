use std::fs;
use std::path::{Path, PathBuf};

use crate::domain::error::AppError;
use crate::domain::note::is_note_file;

/// 文件系统访问抽象的实现：递归收集仓库内的笔记文件（`.md` / `.ainote`）。
/// 纯 IO 层，不含业务规则；业务编排在 services/。
pub fn collect_note_files(root: &Path) -> Result<Vec<PathBuf>, AppError> {
    if !root.is_dir() {
        return Err(AppError::Repo(format!(
            "not a directory: {}",
            root.display()
        )));
    }
    let mut files = Vec::new();
    walk(root, &mut files)?;
    files.sort();
    Ok(files)
}

/// 递归遍历不跟随符号链接（R1）：`file_type()` 来自 dirent 不解析链接，
/// 符号链接条目一律跳过，避免读出仓库外文件或因指向祖先的目录链接无限递归。
fn walk(dir: &Path, out: &mut Vec<PathBuf>) -> Result<(), AppError> {
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let path = entry.path();
        if is_hidden(&path) || file_type.is_symlink() {
            continue;
        }
        if file_type.is_dir() {
            walk(&path, out)?;
        } else if file_type.is_file() && is_note_file(&path) {
            out.push(path);
        }
    }
    Ok(())
}

pub(crate) fn is_hidden(path: &Path) -> bool {
    path.file_name()
        .is_some_and(|name| name.to_string_lossy().starts_with('.'))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{create_dir_all, File};

    #[test]
    fn collects_only_note_files_and_skips_hidden() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path();
        create_dir_all(root.join("daily")).unwrap();
        create_dir_all(root.join(".git")).unwrap();
        File::create(root.join("a.md")).unwrap();
        File::create(root.join("daily/b.md")).unwrap();
        File::create(root.join("daily/c.ainote")).unwrap();
        File::create(root.join("c.txt")).unwrap();
        File::create(root.join(".git/ignored.md")).unwrap();

        let files = collect_note_files(root).unwrap();
        assert_eq!(files.len(), 3);
    }

    #[test]
    fn rejects_non_directory() {
        let err = collect_note_files(Path::new("/nonexistent/path")).unwrap_err();
        assert!(matches!(err, AppError::Repo(_)));
    }

    /// R1：符号链接笔记与目录一律跳过；指向祖先目录的链接不得造成无限递归。
    #[cfg(unix)]
    #[test]
    fn skips_symlinks_and_ancestor_loops() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path();
        create_dir_all(root.join("sub")).unwrap();
        File::create(root.join("a.md")).unwrap();
        File::create(root.join("sub/b.md")).unwrap();
        // 指向仓库外文件的链接（伪装成笔记）
        std::os::unix::fs::symlink("/etc/hosts", root.join("leak.md")).unwrap();
        // 指向祖先目录的链接：若跟随链接会无限递归
        std::os::unix::fs::symlink(root, root.join("sub/loop")).unwrap();

        let files = collect_note_files(root).unwrap();
        assert_eq!(files.len(), 2, "符号链接条目必须全部跳过");
        assert!(files.iter().all(|p| !p.ends_with("leak.md")));
    }
}

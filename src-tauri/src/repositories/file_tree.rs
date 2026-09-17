use std::fs;
use std::path::Path;

use crate::domain::error::AppError;
use crate::domain::sync::{NodeKind, TreeNode};

use super::{file_storage::is_hidden, vault_files};
use crate::domain::note::is_note_file;

/// 用例支撑：列出仓库的笔记文件树（目录优先、按名称排序，跳过隐藏项）。
pub fn list_tree(root: &Path) -> Result<TreeNode, AppError> {
    if !root.is_dir() {
        return Err(AppError::Repo(format!(
            "not a directory: {}",
            root.display()
        )));
    }
    build_node(root, root)
}

fn build_node(root: &Path, dir: &Path) -> Result<TreeNode, AppError> {
    let mut children = Vec::new();
    for entry in fs::read_dir(dir)? {
        let path = entry?.path();
        if is_hidden(&path) {
            continue;
        }
        if path.is_dir() {
            children.push(build_node(root, &path)?);
        } else if is_note_file(&path) {
            children.push(leaf(root, &path));
        }
    }
    children.sort_by(|a, b| (b.node_type, &a.name).cmp(&(a.node_type, &b.name)));
    Ok(TreeNode {
        name: file_name(dir),
        path: rel_path(root, dir),
        node_type: NodeKind::Dir,
        encrypted: false,
        children,
    })
}

fn leaf(root: &Path, path: &Path) -> TreeNode {
    TreeNode {
        name: file_name(path),
        path: rel_path(root, path),
        node_type: NodeKind::File,
        encrypted: vault_files::is_envelope_file(path),
        children: vec![],
    }
}

fn file_name(path: &Path) -> String {
    path.file_name()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_default()
}

fn rel_path(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::vault::ENVELOPE_MAGIC;
    use std::fs;
    use std::fs::{create_dir_all, File};

    #[test]
    fn builds_tree_dirs_first_and_skips_hidden() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path();
        create_dir_all(root.join("daily")).unwrap();
        create_dir_all(root.join(".git")).unwrap();
        File::create(root.join("b.md")).unwrap();
        File::create(root.join("daily/a.md")).unwrap();
        File::create(root.join("daily/c.ainote")).unwrap();
        File::create(root.join(".git/x.md")).unwrap();
        File::create(root.join("note.txt")).unwrap();
        fs::write(root.join("daily/secret.md"), format!("{ENVELOPE_MAGIC}\nQUJD\n")).unwrap();

        let tree = list_tree(root).unwrap();
        assert_eq!(tree.node_type, NodeKind::Dir);
        assert_eq!(tree.children.len(), 2);
        assert_eq!(tree.children[0].name, "daily");
        assert_eq!(tree.children[0].node_type, NodeKind::Dir);
        assert_eq!(tree.children[0].children[0].path, "daily/a.md");
        assert!(!tree.children[0].children[0].encrypted);
        assert_eq!(tree.children[0].children[1].path, "daily/c.ainote");
        assert_eq!(tree.children[0].children[2].path, "daily/secret.md");
        assert!(tree.children[0].children[2].encrypted, "信封文件必须标记为加密");
        assert_eq!(tree.children[1].name, "b.md");
        assert!(!tree.children[1].encrypted);
    }
}

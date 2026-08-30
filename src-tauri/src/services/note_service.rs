use std::fs;
use std::path::Path;

use crate::domain::error::AppError;
use crate::domain::note::{NoteContent, NoteMeta};
use crate::domain::sync::TreeNode;
use crate::repositories::{file_storage, file_tree, note_files};

const NEW_NOTE_TEMPLATE: &str = "# 未命名\n";

/// 用例：列出仓库内全部笔记的元数据（标题取首个 ATX 标题）
pub fn list_notes(repo_path: &Path) -> Result<Vec<NoteMeta>, AppError> {
    let files = file_storage::collect_markdown_files(repo_path)?;
    files.iter().map(|f| to_meta(repo_path, f)).collect()
}

/// 用例：新建笔记；content 为 None 时写入默认模板 `# 未命名`，已存在时幂等返回元数据。
pub fn create_note(repo_path: &Path, rel: &str, content: Option<&str>) -> Result<NoteMeta, AppError> {
    let content = content.unwrap_or(NEW_NOTE_TEMPLATE);
    if !repo_path
        .join(note_files::validate_rel_path(rel)?)
        .is_file()
    {
        note_files::write_note(repo_path, rel, content)?;
    }
    to_meta(repo_path, &repo_path.join(rel))
}

/// 用例：新建文件夹（目录）；已存在时幂等。空目录不产生 Git 变更，首次放入笔记后才会被版本化。
pub fn create_folder(repo_path: &Path, rel: &str) -> Result<(), AppError> {
    let dir = repo_path.join(note_files::validate_rel_path(rel)?);
    fs::create_dir_all(dir)?;
    Ok(())
}

/// 用例：读取笔记完整内容
pub fn read_note(repo_path: &Path, rel: &str) -> Result<NoteContent, AppError> {
    Ok(NoteContent {
        path: rel.to_string(),
        content: note_files::read_note(repo_path, rel)?,
    })
}

/// 用例：更新笔记内容
pub fn update_note(repo_path: &Path, rel: &str, content: &str) -> Result<(), AppError> {
    note_files::write_note(repo_path, rel, content)
}

/// 用例：删除笔记
pub fn delete_note(repo_path: &Path, rel: &str) -> Result<(), AppError> {
    note_files::delete_note(repo_path, rel)
}

/// 用例：移动/重命名笔记
pub fn move_note(repo_path: &Path, from: &str, to: &str) -> Result<(), AppError> {
    note_files::move_note(repo_path, from, to)
}

/// 用例：列出笔记文件树
pub fn list_tree(repo_path: &Path) -> Result<TreeNode, AppError> {
    file_tree::list_tree(repo_path)
}

/// 纯函数：取内容中首个 ATX 一级标题（`# xxx`），无则回退文件名。
pub fn extract_title(content: &str, fallback: &str) -> String {
    for line in content.lines() {
        if let Some(title) = line.strip_prefix("# ") {
            let title = title.trim();
            if !title.is_empty() {
                return title.to_string();
            }
        }
    }
    fallback.to_string()
}

fn to_meta(root: &Path, file: &Path) -> Result<NoteMeta, AppError> {
    let rel = file
        .strip_prefix(root)
        .map_err(|e| AppError::Io(e.to_string()))?;
    let fallback = file
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_default();
    let title = extract_title(
        &std::fs::read_to_string(file).unwrap_or_default(),
        &fallback,
    );
    let updated_at = file
        .metadata()?
        .modified()?
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    Ok(NoteMeta {
        path: rel.to_string_lossy().into_owned(),
        title,
        updated_at,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup() -> tempfile::TempDir {
        tempfile::tempdir().unwrap()
    }

    #[test]
    fn extract_title_prefers_atx_heading() {
        assert_eq!(extract_title("# 你好\nbody", "a"), "你好");
        assert_eq!(extract_title("no heading\n## two", "a.md"), "a.md");
        assert_eq!(extract_title("#\n# 第二个", "f"), "第二个");
    }

    #[test]
    fn create_read_update_move_delete_roundtrip() {
        let tmp = setup();
        let root = tmp.path();
        let meta = create_note(root, "d/n.md", None).unwrap();
        assert_eq!(meta.title, "未命名");
        assert_eq!(
            read_note(root, "d/n.md").unwrap().content,
            NEW_NOTE_TEMPLATE
        );
        update_note(root, "d/n.md", "# 新标题\n正文").unwrap();
        move_note(root, "d/n.md", "e/m.md").unwrap();
        assert!(read_note(root, "d/n.md").is_err());
        delete_note(root, "e/m.md").unwrap();
        assert!(list_notes(root).unwrap().is_empty());
    }

    #[test]
    fn create_is_idempotent_and_validates_path() {
        let tmp = setup();
        let root = tmp.path();
        create_note(root, "a.md", None).unwrap();
        update_note(root, "a.md", "# 自定义").unwrap();
        let meta = create_note(root, "a.md", None).unwrap();
        assert_eq!(meta.title, "自定义");
        assert!(create_note(root, "../evil.md", None).is_err());
    }

    #[test]
    fn create_uses_supplied_template() {
        let tmp = setup();
        let root = tmp.path();
        let meta = create_note(root, "daily/2026-08-30.md", Some("# 2026-08-30\n\n")).unwrap();
        assert_eq!(meta.title, "2026-08-30");
        assert_eq!(
            read_note(root, "daily/2026-08-30.md").unwrap().content,
            "# 2026-08-30\n\n"
        );
        let blank = create_note(root, "blank.md", Some("")).unwrap();
        assert_eq!(blank.title, "blank");
    }

    #[test]
    fn create_folder_creates_and_is_idempotent() {
        let tmp = setup();
        let root = tmp.path();
        create_folder(root, "daily/2026").unwrap();
        assert!(root.join("daily/2026").is_dir());
        create_folder(root, "daily/2026").unwrap();
        assert!(create_folder(root, "../evil").is_err());
        assert!(create_folder(root, "").is_err());
    }

    #[test]
    fn list_notes_reads_atx_title() {
        let tmp = setup();
        let root = tmp.path();
        update_note(root, "sub/x.md", "# 标题X\n").unwrap();
        update_note(root, "y.md", "无标题").unwrap();
        let notes = list_notes(root).unwrap();
        let by_path: std::collections::HashMap<_, _> = notes
            .iter()
            .map(|n| (n.path.as_str(), n.title.as_str()))
            .collect();
        assert_eq!(by_path["sub/x.md"], "标题X");
        assert_eq!(by_path["y.md"], "y");
    }
}

use std::fs;
use std::path::Path;

use crate::domain::error::AppError;
use crate::domain::note::{NoteContent, NoteKind, NoteMeta};
use crate::domain::rich_text;
use crate::domain::sync::TreeNode;
use crate::repositories::{file_storage, file_tree, note_files, trash_files};

const NEW_NOTE_TEMPLATE: &str = "# 未命名\n";

/// 用例：列出仓库内全部笔记的元数据（Markdown 标题优先 frontmatter，否则文件名）
pub fn list_notes(repo_path: &Path) -> Result<Vec<NoteMeta>, AppError> {
    let files = file_storage::collect_note_files(repo_path)?;
    files.iter().map(|f| to_meta(repo_path, f)).collect()
}

/// 用例：新建笔记；content 为 None 时按类型写入默认模板（Markdown `# 未命名` /
/// 富文本一级标题「未命名」），已存在时幂等返回元数据。
pub fn create_note(
    repo_path: &Path,
    rel: &str,
    kind: NoteKind,
    content: Option<&str>,
) -> Result<NoteMeta, AppError> {
    let content = match content {
        Some(c) => c.to_string(),
        None => match kind {
            NoteKind::Markdown => NEW_NOTE_TEMPLATE.to_string(),
            NoteKind::RichText => rich_text::default_template(),
        },
    };
    if !repo_path
        .join(note_files::validate_rel_path(rel)?)
        .is_file()
    {
        note_files::write_note(repo_path, rel, &content)?;
    }
    to_meta(repo_path, &repo_path.join(rel))
}

/// 用例：新建文件夹（目录）；已存在时幂等。空目录不产生 Git 变更，首次放入笔记后才会被版本化。
pub fn create_folder(repo_path: &Path, rel: &str) -> Result<(), AppError> {
    let dir = repo_path.join(note_files::validate_rel_path(rel)?);
    fs::create_dir_all(dir)?;
    Ok(())
}

/// 用例：导入外部 Markdown 内容为笔记（写入当前目录，重名自动加序号）。
pub fn import_note(
    repo_path: &Path,
    dir: &str,
    file_name: &str,
    content: &str,
) -> Result<NoteMeta, AppError> {
    let rel = note_files::unique_note_path(repo_path, dir, file_name)?;
    note_files::write_note(repo_path, &rel, content)?;
    to_meta(repo_path, &repo_path.join(&rel))
}

/// 用例：读取笔记完整内容
pub fn read_note(repo_path: &Path, rel: &str) -> Result<NoteContent, AppError> {
    let path = note_files::validate_rel_path(rel)?;
    Ok(NoteContent {
        path: rel.to_string(),
        kind: NoteKind::of_path(&path).unwrap_or(NoteKind::Markdown),
        content: note_files::read_note(repo_path, rel)?,
    })
}

/// 用例：更新笔记内容
pub fn update_note(repo_path: &Path, rel: &str, content: &str) -> Result<(), AppError> {
    note_files::write_note(repo_path, rel, content)
}

/// 用例：删除笔记（软删除：移入回收站 `.trash`，可恢复，P2）
pub fn delete_note(repo_path: &Path, rel: &str) -> Result<(), AppError> {
    trash_files::soft_delete_note(repo_path, rel).map(|_| ())
}

/// 用例：递归删除目录及其中的笔记（软删除：全部移入回收站，P2）
pub fn delete_folder(repo_path: &Path, rel: &str) -> Result<(), AppError> {
    trash_files::soft_delete_folder(repo_path, rel).map(|_| ())
}

/// 用例：移动/重命名笔记
pub fn move_note(repo_path: &Path, from: &str, to: &str) -> Result<(), AppError> {
    note_files::move_note(repo_path, from, to)
}

/// 用例：转换笔记类型（`.md` ↔ `.ainote`）；content 为前端已转换的新内容
pub fn convert_note_kind(
    repo_path: &Path,
    from: &str,
    to: &str,
    content: &str,
) -> Result<(), AppError> {
    note_files::convert_note(repo_path, from, to, content)
}

/// 用例：列出笔记文件树
pub fn list_tree(repo_path: &Path) -> Result<TreeNode, AppError> {
    file_tree::list_tree(repo_path)
}

/// re-export：纯函数取展示标题（自 domain/note.rs，供 search/wiki 复用）
pub use crate::domain::note::extract_title;
fn to_meta(root: &Path, file: &Path) -> Result<NoteMeta, AppError> {
    let rel = file
        .strip_prefix(root)
        .map_err(|e| AppError::Io(e.to_string()))?;
    let fallback = file
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_default();
    let content = std::fs::read_to_string(file).unwrap_or_default();
    let kind = NoteKind::of_path(file).unwrap_or(NoteKind::Markdown);
    let title = match kind {
        NoteKind::Markdown => extract_title(&content, &fallback),
        NoteKind::RichText => rich_text::extract_title(&content).unwrap_or(fallback),
    };
    let updated_at = file
        .metadata()?
        .modified()?
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    Ok(NoteMeta {
        path: rel.to_string_lossy().into_owned(),
        kind,
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
    fn extract_title_uses_frontmatter_or_file_name() {
        assert_eq!(extract_title("# 正文标题\nbody", "note"), "note");
        assert_eq!(extract_title("---\ntitle: 元数据标题\n---\n# 标题", "n"), "元数据标题");
        assert_eq!(extract_title("---\ntitle: \"Quoted\"\n---\nbody", "a"), "Quoted");
        assert_eq!(extract_title("body", "fallback"), "fallback");
    }

    #[test]
    fn create_read_update_move_delete_roundtrip() {
        let tmp = setup();
        let root = tmp.path();
        let meta = create_note(root, "d/n.md", NoteKind::Markdown, None).unwrap();
        assert_eq!(meta.kind, NoteKind::Markdown);
        assert_eq!(meta.title, "n");
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
        create_note(root, "a.md", NoteKind::Markdown, None).unwrap();
        update_note(root, "a.md", "# 自定义").unwrap();
        let meta = create_note(root, "a.md", NoteKind::Markdown, None).unwrap();
        assert_eq!(meta.title, "a");
        assert!(create_note(root, "../evil.md", NoteKind::Markdown, None).is_err());
    }

    #[test]
    fn create_uses_supplied_template() {
        let tmp = setup();
        let root = tmp.path();
        let meta = create_note(
            root,
            "daily/2026-08-30.md",
            NoteKind::Markdown,
            Some("# 2026-08-30\n\n"),
        )
        .unwrap();
        assert_eq!(meta.title, "2026-08-30");
        assert_eq!(
            read_note(root, "daily/2026-08-30.md").unwrap().content,
            "# 2026-08-30\n\n"
        );
        let blank = create_note(root, "blank.md", NoteKind::Markdown, Some("")).unwrap();
        assert_eq!(blank.title, "blank");
    }

    #[test]
    fn rich_text_create_read_roundtrip_with_kind() {
        let tmp = setup();
        let root = tmp.path();
        let meta = create_note(root, "r.ainote", NoteKind::RichText, None).unwrap();
        assert_eq!(meta.kind, NoteKind::RichText);
        assert_eq!(meta.title, "未命名");
        let content = read_note(root, "r.ainote").unwrap();
        assert_eq!(content.kind, NoteKind::RichText);
        assert!(serde_json::from_str::<serde_json::Value>(&content.content).is_ok());
        assert_eq!(list_notes(root).unwrap().len(), 1);
    }

    #[test]
    fn rich_text_blank_template_has_no_title() {
        let tmp = setup();
        let root = tmp.path();
        let meta = create_note(root, "blank.ainote", NoteKind::RichText, Some("")).unwrap();
        assert_eq!(meta.title, "blank");
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
    fn list_notes_reads_display_title() {
        let tmp = setup();
        let root = tmp.path();
        update_note(root, "sub/x.md", "# 标题X\n").unwrap();
        update_note(root, "y.md", "无标题").unwrap();
        let notes = list_notes(root).unwrap();
        let by_path: std::collections::HashMap<_, _> = notes
            .iter()
            .map(|n| (n.path.as_str(), n.title.as_str()))
            .collect();
        assert_eq!(by_path["sub/x.md"], "x");
        assert_eq!(by_path["y.md"], "y");
    }

    #[test]
    fn import_note_writes_to_current_dir_with_unique_name() {
        let tmp = setup();
        let root = tmp.path();
        let meta = import_note(root, "", "README.md", "# 导入\n正文").unwrap();
        assert_eq!(meta.path, "README.md");
        assert_eq!(meta.kind, NoteKind::Markdown);
        assert_eq!(meta.title, "README");
        assert_eq!(read_note(root, "README.md").unwrap().content, "# 导入\n正文");
        // 重名自动加序号
        let second = import_note(root, "", "README.md", "other").unwrap();
        assert_eq!(second.path, "README-1.md");
        // 子目录 + `.markdown` 归一化为 `.md`
        let sub = import_note(root, "sub", "docs.markdown", "x").unwrap();
        assert_eq!(sub.path, "sub/docs.md");
        // 非法目录拒绝（路径穿越 / 隐藏段）
        assert!(import_note(root, "../evil", "x.md", "y").is_err());
        assert!(import_note(root, ".hidden", "x.md", "y").is_err());
    }
}

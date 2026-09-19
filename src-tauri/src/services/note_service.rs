use std::fs;
use std::path::Path;

use crate::domain::error::AppError;
use crate::domain::note::{NoteContent, NoteKind, NoteMeta};
use crate::domain::rich_text;
use crate::domain::sync::TreeNode;
use crate::repositories::{file_storage, file_tree, note_files, trash_files, vault_files};
use crate::services::note_content;

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
        note_content::write_text(repo_path, rel, &content)?;
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
    note_content::write_text(repo_path, &rel, content)?;
    to_meta(repo_path, &repo_path.join(&rel))
}

/// 用例：读取笔记完整内容。加密笔记在锁定态返回 `locked: true` 与空内容（前端渲染解锁遮罩）。
pub fn read_note(repo_path: &Path, rel: &str) -> Result<NoteContent, AppError> {
    let path = note_files::validate_rel_path(rel)?;
    let read = note_content::read_file(repo_path, &repo_path.join(&path))?;
    let locked = read.is_locked();
    Ok(NoteContent {
        path: rel.to_string(),
        kind: NoteKind::of_path(&path).unwrap_or(NoteKind::Markdown),
        content: read.text.unwrap_or_default(),
        locked,
        encrypted: read.encrypted,
    })
}

/// 用例：把一篇已有笔记切换为加密态 / 明文态（E4 逐篇开关）。
/// 已处于目标状态时是幂等的，只返回最新元数据、不改写文件。
pub fn set_note_encryption(
    repo_path: &Path,
    rel: &str,
    encrypted: bool,
) -> Result<NoteMeta, AppError> {
    let path = note_files::validate_rel_path(rel)?;
    let file = repo_path.join(&path);
    if !file.is_file() {
        return Err(AppError::NoteNotFound(rel.to_string()));
    }
    ensure_vault_ready(repo_path, encrypted)?;
    if note_content::is_encrypted_file(&file) != encrypted {
        let plain = plaintext_of(repo_path, &file)?;
        let payload = if encrypted {
            note_content::encrypt_text(repo_path, &plain)?
        } else {
            plain
        };
        note_files::write_note(repo_path, rel, &payload)?;
    }
    to_meta(repo_path, &file)
}

/// 加密前仓库必须已建库：否则用户要先在设置里创建（给出可操作提示而不是「需要解锁」）。
fn ensure_vault_ready(repo_path: &Path, encrypted: bool) -> Result<(), AppError> {
    if encrypted && vault_files::load(repo_path)?.is_none() {
        return Err(AppError::VaultInvalid(
            "该仓库尚未启用加密笔记，请先在设置中启用".to_string(),
        ));
    }
    Ok(())
}

/// 取笔记明文；加密笔记在锁定态会在此被拦截（`VAULT_9001`）。
fn plaintext_of(repo_path: &Path, file: &Path) -> Result<String, AppError> {
    let read = note_content::read_file(repo_path, file)?;
    read.text.ok_or_else(|| {
        AppError::VaultLocked("加密笔记需要先解锁仓库密钥".to_string())
    })
}

/// 用例：更新笔记内容（加密笔记继续以密文落盘）
pub fn update_note(repo_path: &Path, rel: &str, content: &str) -> Result<(), AppError> {
    note_content::write_text(repo_path, rel, content)
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
    // 源笔记是加密态时，转换后的新笔记必须保持密文，否则类型转换会把内容悄悄降级为明文。
    let source = repo_path.join(note_files::validate_rel_path(from)?);
    let payload = if note_content::is_encrypted_file(&source) {
        note_content::encrypt_text(repo_path, content)?
    } else {
        content.to_string()
    };
    note_files::convert_note(repo_path, from, to, &payload)
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
    let read = match note_content::read_file(root, file) {
        Ok(read) => read,
        Err(err) => {
            log::warn!(
                target: "ainote::note",
                "读取笔记内容失败 path={} error={err}",
                crate::config::logging::redact(&file.to_string_lossy())
            );
            note_content::NoteRead::unreadable()
        }
    };
    // 锁定态或密文损坏时明文为空，标题自然回退为文件名（列表不因单篇失败中断）。
    let content = read.text.unwrap_or_default();
    let kind = NoteKind::of_path(file).unwrap_or(NoteKind::Markdown);
    let title = match kind {
        NoteKind::Markdown => extract_title(&content, &fallback),
        NoteKind::RichText => rich_text::extract_title(&content).unwrap_or(fallback),
    };
    let updated_at = file_storage::mtime_secs(file);
    Ok(NoteMeta {
        path: rel.to_string_lossy().into_owned(),
        kind,
        title,
        updated_at,
        encrypted: read.encrypted,
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

    #[test]
    fn set_note_encryption_toggles_and_is_idempotent() {
        let _serial = crate::services::vault_service::test_guard();
        let tmp = setup();
        let root = tmp.path();
        crate::services::vault_service::create(root, "correct horse battery").unwrap();
        update_note(root, "a.md", "# 机密\n正文").unwrap();

        assert!(set_note_encryption(root, "a.md", true).unwrap().encrypted);
        let on_disk = std::fs::read_to_string(root.join("a.md")).unwrap();
        assert!(on_disk.starts_with("AINOTE-ENC-v1"));
        assert!(!on_disk.contains("机密"));

        // 幂等：已是加密态时再次加密不改写文件
        assert!(set_note_encryption(root, "a.md", true).unwrap().encrypted);
        assert_eq!(std::fs::read_to_string(root.join("a.md")).unwrap(), on_disk);

        // 解密回到明文，且不再是锁定态
        assert!(!set_note_encryption(root, "a.md", false).unwrap().encrypted);
        let read = read_note(root, "a.md").unwrap();
        assert_eq!(read.content, "# 机密\n正文");
        assert!(!read.locked);
        assert!(!read.encrypted);
        crate::services::vault_service::lock(root).unwrap();
    }

    #[test]
    fn set_note_encryption_requires_vault_then_unlock() {
        let _serial = crate::services::vault_service::test_guard();
        let tmp = setup();
        let root = tmp.path();
        update_note(root, "a.md", "# 明文").unwrap();

        // 未建库：给出「先去设置启用」的可操作错误，而不是含糊的锁定错误
        assert!(matches!(
            set_note_encryption(root, "a.md", true),
            Err(AppError::VaultInvalid(_))
        ));
        assert_eq!(read_note(root, "a.md").unwrap().content, "# 明文");

        crate::services::vault_service::create(root, "correct horse battery").unwrap();
        set_note_encryption(root, "a.md", true).unwrap();
        crate::services::vault_service::lock(root).unwrap();

        // 锁定态既不能解密也不能加密新笔记
        assert!(matches!(
            set_note_encryption(root, "a.md", false),
            Err(AppError::VaultLocked(_))
        ));
        assert!(read_note(root, "a.md").unwrap().locked);
        assert!(matches!(
            set_note_encryption(root, "missing.md", false),
            Err(AppError::NoteNotFound(_))
        ));
    }
}

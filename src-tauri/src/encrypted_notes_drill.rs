//! 加密笔记端到端演练（E3）：建库 → 加密单篇 → 校验「解锁可读、锁定不可读」贯穿所有读取路径。
//!
//! 覆盖的是最容易漏的旁路：列表标题、全文搜索、wiki 索引、AI 全库上下文。

use std::fs;
use std::path::{Path, PathBuf};

use crate::domain::note::{NoteKind, NoteMeta};
use crate::services::{ai_service, note_service, search_service, vault_service, wiki_service};

const PASSPHRASE: &str = "correct horse battery";

fn setup() -> (tempfile::TempDir, PathBuf) {
    let tmp = tempfile::tempdir().expect("临时仓库");
    let root = tmp.path().to_path_buf();
    fs::create_dir_all(root.join("sub")).unwrap();
    (tmp, root)
}

fn write(root: &Path, rel: &str, content: &str) {
    let path = root.join(rel);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).unwrap();
    }
    fs::write(path, content).unwrap();
}

fn titles(notes: &[NoteMeta]) -> Vec<(String, String, bool)> {
    notes
        .iter()
        .map(|note| (note.path.clone(), note.title.clone(), note.encrypted))
        .collect()
}

/// 建库并把 `sub/secret.md` 就地加密（模拟 E4 的「加密此笔记」）。
fn create_vault_with_encrypted_note(root: &Path) {
    vault_service::create(root, PASSPHRASE).expect("建库");
    let plain = "---\ntitle: 机密标题\n---\n#tag 机密正文 [[公开笔记]]\n";
    let envelope = crate::services::note_content::encrypt_text(root, plain).expect("加密正文");
    write(root, "sub/secret.md", &envelope);
    write(root, "open.md", "# 公开笔记\n明文正文 rustlang\n");
}

#[test]
fn encrypted_note_is_unreadable_on_disk_but_readable_when_unlocked() {
    let _serial = vault_service::test_guard();
    let (_tmp, root) = setup();
    create_vault_with_encrypted_note(&root);

    // 磁盘上只有信封：明文标题与正文都不落盘
    let on_disk = fs::read_to_string(root.join("sub/secret.md")).unwrap();
    assert!(on_disk.starts_with("AINOTE-ENC-v1"));
    assert!(!on_disk.contains("机密标题"));
    assert!(!on_disk.contains("机密正文"));

    // 解锁态：标题取自 frontmatter、搜索与 wiki 都能看到内容
    let listed = titles(&note_service::list_notes(&root).unwrap());
    assert!(listed.contains(&("sub/secret.md".to_string(), "机密标题".to_string(), true)));
    // 明文笔记标题仍按 PRD 口径取文件名（正文 `#` 标题不参与展示标题）
    assert!(listed.contains(&("open.md".to_string(), "open".to_string(), false)));

    let content = note_service::read_note(&root, "sub/secret.md").unwrap();
    assert!(!content.locked);
    assert!(content.content.contains("机密正文"));

    let hits = search_service::search_notes(&root, "机密正文").unwrap();
    assert_eq!(hits.len(), 1);
    assert_eq!(hits[0].path, "sub/secret.md");

    let wiki = wiki_service::wiki_index(&root).unwrap();
    let secret = wiki.iter().find(|note| note.path == "sub/secret.md").unwrap();
    assert!(secret.tags.iter().any(|tag| tag == "tag"));

    // AI 全库上下文：即使已解锁，加密笔记也不进入上下文（决策③）
    let context = ai_service::retrieve_context(&root, "机密正文", 5).unwrap();
    assert!(!context.contains("机密正文"), "加密笔记不得进入 AI 上下文");

    vault_service::lock(&root).unwrap();
}

#[test]
fn locked_vault_hides_content_everywhere_without_breaking_scans() {
    let _serial = vault_service::test_guard();
    let (_tmp, root) = setup();
    create_vault_with_encrypted_note(&root);
    vault_service::lock(&root).unwrap();

    // 列表：不报错，标题回退文件名，并标记为加密
    let listed = titles(&note_service::list_notes(&root).unwrap());
    assert!(listed.contains(&("sub/secret.md".to_string(), "secret".to_string(), true)));

    // 打开：返回锁定态而不是密文或错误弹窗
    let content = note_service::read_note(&root, "sub/secret.md").unwrap();
    assert!(content.locked);
    assert_eq!(content.content, "");

    // 搜索 / wiki：静默跳过，明文笔记照常
    assert!(search_service::search_notes(&root, "机密正文").unwrap().is_empty());
    assert_eq!(search_service::search_notes(&root, "rustlang").unwrap().len(), 1);
    let wiki = wiki_service::wiki_index(&root).unwrap();
    assert!(wiki.iter().all(|note| note.path != "sub/secret.md"));
    assert!(wiki.iter().any(|note| note.path == "open.md"));

    // AI 上下文同样不含加密笔记
    assert_eq!(ai_service::retrieve_context(&root, "机密正文", 5).unwrap(), "");
}

#[test]
fn corrupt_ciphertext_is_reported_instead_of_looking_locked() {
    let _serial = vault_service::test_guard();
    let (_tmp, root) = setup();
    create_vault_with_encrypted_note(&root);
    write(&root, "sub/secret.md", "AINOTE-ENC-v1\nQUJD\n");

    let err = note_service::read_note(&root, "sub/secret.md").unwrap_err();
    assert_eq!(crate::domain::error::AppErrorDto::from(err).code, "VAULT_9005");

    // 扫描路径仍然容错：坏文件不影响其余笔记
    assert!(search_service::search_notes(&root, "rustlang").unwrap().len() == 1);
    vault_service::lock(&root).unwrap();
}

#[test]
fn converting_note_kind_keeps_the_note_encrypted() {
    let _serial = vault_service::test_guard();
    let (_tmp, root) = setup();
    create_vault_with_encrypted_note(&root);

    note_service::convert_note_kind(
        &root,
        "sub/secret.md",
        "sub/secret.ainote",
        r#"{"type":"doc","content":[]}"#,
    )
    .unwrap();

    let converted = fs::read_to_string(root.join("sub/secret.ainote")).unwrap();
    assert!(converted.starts_with("AINOTE-ENC-v1"), "类型转换不得把内容降级为明文");
    let read = note_service::read_note(&root, "sub/secret.ainote").unwrap();
    assert!(!read.locked);
    assert_eq!(read.kind, NoteKind::RichText);
    assert_eq!(read.content, r#"{"type":"doc","content":[]}"#);
    vault_service::lock(&root).unwrap();
}

use super::*;
use crate::domain::vault::ENVELOPE_MAGIC;
use crate::services::vault_service;

const PASSPHRASE: &str = "correct horse battery";

fn repo() -> tempfile::TempDir {
    tempfile::tempdir().unwrap()
}

fn write(root: &Path, rel: &str, content: &str) {
    let path = root.join(rel);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).unwrap();
    }
    std::fs::write(path, content).unwrap();
}

#[test]
fn plain_repo_reads_and_writes_verbatim() {
    let tmp = repo();
    let root = tmp.path();
    write(root, "a.md", "# 明文");

    let read = read_file(root, &root.join("a.md")).unwrap();
    assert!(!read.encrypted);
    assert_eq!(read.text.as_deref(), Some("# 明文"));

    write_text(root, "b.md", "# 新笔记").unwrap();
    assert_eq!(std::fs::read_to_string(root.join("b.md")).unwrap(), "# 新笔记");
}

#[test]
fn missing_note_reports_not_found() {
    let tmp = repo();
    assert!(matches!(
        read_file(tmp.path(), &tmp.path().join("nope.md")),
        Err(AppError::NoteNotFound(_))
    ));
}

#[test]
fn encrypted_note_round_trips_while_unlocked_and_stays_encrypted_on_write() {
    let _serial = vault_service::test_guard();
    let tmp = repo();
    let root = tmp.path();
    vault_service::create(root, PASSPHRASE).unwrap();
    let envelope = encrypt_text(root, "# 机密").unwrap();
    write(root, "secret.md", &envelope);

    let read = read_file(root, &root.join("secret.md")).unwrap();
    assert!(read.encrypted);
    assert_eq!(read.text.as_deref(), Some("# 机密"));
    assert!(!read.is_locked());

    // 重新写入后仍是密文，且不含明文
    write_text(root, "secret.md", "# 机密改").unwrap();
    let on_disk = std::fs::read_to_string(root.join("secret.md")).unwrap();
    assert!(is_envelope(&on_disk));
    assert!(!on_disk.contains("机密"));
    assert_eq!(
        read_file(root, &root.join("secret.md")).unwrap().text.as_deref(),
        Some("# 机密改")
    );

    // 新建的普通笔记默认仍是明文（逐篇开关）
    write_text(root, "plain.md", "# 明文").unwrap();
    assert_eq!(std::fs::read_to_string(root.join("plain.md")).unwrap(), "# 明文");
    vault_service::lock(root).unwrap();
}

#[test]
fn locked_session_hides_encrypted_notes_without_breaking_scan() {
    let _serial = vault_service::test_guard();
    let tmp = repo();
    let root = tmp.path();
    vault_service::create(root, PASSPHRASE).unwrap();
    write(root, "secret.md", &encrypt_text(root, "# 机密").unwrap());
    write(root, "plain.md", "# 明文");
    vault_service::lock(root).unwrap();

    // 锁定态：不报错，由调用方决定跳过还是提示解锁
    let locked = read_file(root, &root.join("secret.md")).unwrap();
    assert!(locked.is_locked());
    assert_eq!(locked.text, None);

    // 明文笔记不受锁定影响
    assert_eq!(
        read_file(root, &root.join("plain.md")).unwrap().text.as_deref(),
        Some("# 明文")
    );

    // 锁定态不覆盖已加密笔记（避免静默降级为明文）
    assert!(matches!(
        write_text(root, "secret.md", "# 新内容"),
        Err(AppError::VaultLocked(_))
    ));
    assert_eq!(
        read_file(root, &root.join("secret.md")).unwrap().encrypted,
        true
    );
}

#[test]
fn corrupt_envelope_is_reported_loudly() {
    let _serial = vault_service::test_guard();
    let tmp = repo();
    let root = tmp.path();
    vault_service::create(root, PASSPHRASE).unwrap();
    write(root, "broken.md", &format!("{ENVELOPE_MAGIC}\nQUJD\n"));

    assert!(matches!(
        read_file(root, &root.join("broken.md")),
        Err(AppError::VaultCorrupt(_))
    ));
    vault_service::lock(root).unwrap();
}

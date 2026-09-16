use super::*;
use crate::domain::vault::ENVELOPE_MAGIC;

/// 会话是进程级全局状态：凡触碰会话的用例串行执行，避免并行测试互相清空解锁态。
fn session_lock() -> std::sync::MutexGuard<'static, ()> {
    test_guard()
}

fn repo() -> tempfile::TempDir {
    tempfile::tempdir().unwrap()
}

fn write_note(root: &Path, rel: &str, content: &str) {
    let path = root.join(rel);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).unwrap();
    }
    std::fs::write(path, content).unwrap();
}

#[test]
fn status_is_absent_before_the_repo_has_a_vault() {
    let tmp = repo();
    let status = status(tmp.path()).unwrap();
    assert_eq!(status.state, VaultState::Absent);
    assert_eq!(status.encrypted_notes, 0);
}

#[test]
fn encrypted_note_count_only_reads_file_headers() {
    let tmp = repo();
    let root = tmp.path();
    write_note(root, "plain.md", "# 明文笔记\n" );
    write_note(root, "sub/enc.md", &format!("{ENVELOPE_MAGIC}\nQUJD\n"));
    write_note(root, "sub/rich.ainote", &format!("{ENVELOPE_MAGIC}\nREVG\n"));
    write_note(root, "assets/pic.bin", "not a note");

    assert_eq!(count_encrypted_notes(root).unwrap(), 2);
    assert_eq!(status(root).unwrap().encrypted_notes, 2);
}

#[test]
fn create_unlock_lock_and_change_passphrase_lifecycle() {
    let _serial = session_lock();
    let tmp = repo();
    let root = tmp.path();
    let passphrase = "correct horse battery";

    // 建库：立即处于解锁态，vault.json 落盘但不含明文口令
    let created = create(root, passphrase).unwrap();
    assert_eq!(created.state, VaultState::Unlocked);
    let raw = std::fs::read_to_string(root.join(vault_files::VAULT_FILE)).unwrap();
    assert!(!raw.contains(passphrase));
    assert!(raw.contains("argon2id"));

    // 锁定后主密钥从内存消失，取值被拒
    assert_eq!(lock(root).unwrap().state, VaultState::Locked);
    assert!(matches!(
        session_master(root),
        Err(AppError::VaultLocked(_))
    ));

    // 错误口令解锁失败且保持锁定
    assert!(matches!(
        unlock(root, "correct horse batterz"),
        Err(AppError::VaultUnlockFailed(_))
    ));
    assert_eq!(status(root).unwrap().state, VaultState::Locked);

    // 正确口令解锁后能取回同一把主密钥
    assert_eq!(unlock(root, passphrase).unwrap().state, VaultState::Unlocked);
    let master = session_master(root).unwrap();

    // 改口令：只换封装与盐，不重写笔记文件
    write_note(root, "secret.md", &format!("{ENVELOPE_MAGIC}\nQUJD\n"));
    let note_before = std::fs::read(root.join("secret.md")).unwrap();
    let salt_before = vault_files::load(root).unwrap().unwrap().kdf.salt;
    let changed = change_passphrase(root, passphrase, "another good passphrase").unwrap();
    assert_eq!(changed.state, VaultState::Unlocked);
    assert_eq!(session_master(root).unwrap().as_ref(), master.as_ref());
    assert!(change_passphrase(root, passphrase, "yet another passphrase").is_err(), "旧口令已失效");
    assert_eq!(
        std::fs::read(root.join("secret.md")).unwrap(),
        note_before,
        "改口令不得重写笔记文件"
    );
    assert_ne!(
        vault_files::load(root).unwrap().unwrap().kdf.salt,
        salt_before,
        "改口令必须换新盐"
    );

    // 新口令可解锁
    lock(root).unwrap();
    assert_eq!(
        unlock(root, "another good passphrase").unwrap().state,
        VaultState::Unlocked
    );
    assert_eq!(session_master(root).unwrap().as_ref(), master.as_ref());
}

#[test]
fn create_rejects_weak_passphrase_and_existing_vault() {
    let _serial = session_lock();
    let tmp = repo();
    let root = tmp.path();
    assert!(matches!(
        create(root, "short"),
        Err(AppError::VaultInvalid(_))
    ));
    assert!(!root.join(vault_files::VAULT_FILE).exists());

    create(root, "correct horse battery").unwrap();
    assert!(
        matches!(create(root, "correct horse battery"), Err(AppError::VaultInvalid(_))),
        "重复建库必须报错，避免覆盖既有密钥"
    );
}

#[test]
fn unlock_without_vault_and_session_is_scoped_to_the_repo() {
    let _serial = session_lock();
    let first = repo();
    let second = repo();
    assert!(matches!(
        unlock(first.path(), "correct horse battery"),
        Err(AppError::VaultInvalid(_))
    ));

    create(first.path(), "correct horse battery").unwrap();
    assert!(is_unlocked(first.path()));
    assert!(
        !is_unlocked(second.path()),
        "会话按仓库绑定：切换仓库后视为锁定"
    );
    assert!(matches!(
        session_master(second.path()),
        Err(AppError::VaultLocked(_))
    ));
    lock(first.path()).unwrap();
}

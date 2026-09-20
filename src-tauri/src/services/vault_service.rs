//! 加密笔记的会话与仓库密钥用例（E2）。
//!
//! 会话只保存「已解锁的仓库路径 + 主密钥」，进程退出即失效——桌面端不提供「记住口令」，
//! 主密钥不写钥匙串、不落盘（见 docs/ENCRYPTED_NOTES_PLAN.md 决策 ⑤）。

use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard, OnceLock};

use zeroize::Zeroizing;

use crate::domain::error::AppError;
use crate::domain::vault::{
    check_passphrase_strength, VaultFile, VaultState, VaultStatus, MASTER_KEY_LEN,
    VAULT_SCHEMA_VERSION,
};
use crate::repositories::{file_storage, vault_files};
use crate::services::vault_crypto;

/// 已解锁会话：仓库路径 + 主密钥（零化封装，drop 即擦除）。
struct UnlockedVault {
    repo: PathBuf,
    master: Zeroizing<[u8; MASTER_KEY_LEN]>,
}

fn session() -> &'static Mutex<Option<UnlockedVault>> {
    static SESSION: OnceLock<Mutex<Option<UnlockedVault>>> = OnceLock::new();
    SESSION.get_or_init(|| Mutex::new(None))
}

/// 锁中毒（持锁线程 panic）时取回内部值：会话只是内存状态，恢复比继续 panic 更合理。
fn session_guard() -> MutexGuard<'static, Option<UnlockedVault>> {
    session().lock().unwrap_or_else(|poison| poison.into_inner())
}

/// 用例：读取仓库加密状态（未建库 / 已锁定 / 已解锁 + 加密笔记数量）。
pub fn status(root: &Path) -> Result<VaultStatus, AppError> {
    let state = match vault_files::load(root)?.is_some() {
        false => VaultState::Absent,
        true if is_unlocked(root) => VaultState::Unlocked,
        true => VaultState::Locked,
    };
    Ok(VaultStatus {
        state,
        encrypted_notes: count_encrypted_notes(root)?,
    })
}

/// 用例：建库（生成主密钥并用口令封装）。已建库直接报错，避免覆盖既有密钥导致笔记永久不可读。
pub fn create(root: &Path, passphrase: &str) -> Result<VaultStatus, AppError> {
    if vault_files::load(root)?.is_some() {
        return Err(AppError::VaultInvalid(
            "该仓库已存在加密配置，请直接解锁".to_string(),
        ));
    }
    check_strength(passphrase, root)?;
    let kdf = vault_crypto::new_kdf_params()?;
    let kek = vault_crypto::derive_kek(passphrase, &kdf)?;
    let master = vault_crypto::new_master_key()?;
    let wrap = vault_crypto::wrap_master_key(&kek, &master)?;
    vault_files::save(
        root,
        &VaultFile {
            schema_version: VAULT_SCHEMA_VERSION,
            kdf,
            wrap,
        },
    )?;
    set_session(root, master);
    status(root)
}

/// 用例：用口令解锁仓库（解封主密钥并放入进程内存会话）。
pub fn unlock(root: &Path, passphrase: &str) -> Result<VaultStatus, AppError> {
    let file = vault_files::load(root)?
        .ok_or_else(|| AppError::VaultInvalid("该仓库尚未建库".to_string()))?;
    let kek = vault_crypto::derive_kek(passphrase, &file.kdf)?;
    let master = vault_crypto::unwrap_master_key(&kek, &file.wrap)?;
    set_session(root, master);
    status(root)
}

/// 用例：锁定（清空内存主密钥）。锁定前的落盘由调用方负责（前端先 flush 保存队列）。
pub fn lock(root: &Path) -> Result<VaultStatus, AppError> {
    clear_session();
    status(root)
}

/// 用例：改口令。只重新封装主密钥（换新盐），**不重写任何笔记文件**。
pub fn change_passphrase(root: &Path, old: &str, new: &str) -> Result<VaultStatus, AppError> {
    let file = vault_files::load(root)?
        .ok_or_else(|| AppError::VaultInvalid("该仓库尚未建库".to_string()))?;
    let old_kek = vault_crypto::derive_kek(old, &file.kdf)?;
    let master = vault_crypto::unwrap_master_key(&old_kek, &file.wrap)?;
    check_strength(new, root)?;

    let kdf = vault_crypto::new_kdf_params()?;
    let kek = vault_crypto::derive_kek(new, &kdf)?;
    let wrap = vault_crypto::wrap_master_key(&kek, &master)?;
    vault_files::save(
        root,
        &VaultFile {
            schema_version: VAULT_SCHEMA_VERSION,
            kdf,
            wrap,
        },
    )?;
    set_session(root, master);
    status(root)
}

/// 取当前仓库的主密钥；未解锁（或会话属于别的仓库）返回 `VAULT_9001`。
/// 内容层（note_content）唯一通过此函数拿密钥，前端永远拿不到密钥与明文口令。
pub fn session_master(root: &Path) -> Result<Zeroizing<[u8; MASTER_KEY_LEN]>, AppError> {
    let guard = session_guard();
    match guard.as_ref() {
        Some(unlocked) if unlocked.repo == root => Ok(Zeroizing::new(*unlocked.master)),
        _ => Err(AppError::VaultLocked(
            "加密笔记需要先解锁仓库密钥".to_string(),
        )),
    }
}

/// 当前仓库是否已解锁（状态查询用）。
pub fn is_unlocked(root: &Path) -> bool {
    session_guard()
        .as_ref()
        .is_some_and(|unlocked| unlocked.repo == root)
}

/// 设备级快速解锁专用：把**已由平台安全存储解封**的主密钥放进会话（不经过口令）。
/// 口令仍是唯一凭证；这里只是把「设备认证通过」这一事实转成会话状态。
pub fn adopt_master(
    root: &Path,
    master: Zeroizing<[u8; MASTER_KEY_LEN]>,
) -> Result<VaultStatus, AppError> {
    set_session(root, master);
    status(root)
}

/// 统计仓库内处于加密态的笔记数量：只看每个笔记文件的首行，不解密、不读全文。
pub fn count_encrypted_notes(root: &Path) -> Result<u32, AppError> {
    let mut total = 0u32;
    for file in file_storage::collect_note_files(root)? {
        if vault_files::is_envelope_file(&file) {
            total += 1;
        }
    }
    Ok(total)
}

/// 口令强度校验的上下文词：仓库目录名不得直接当口令。
fn check_strength(passphrase: &str, root: &Path) -> Result<(), AppError> {
    let repo_name = root
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_default();
    check_passphrase_strength(passphrase, &[repo_name.as_str()])
}

fn set_session(root: &Path, master: Zeroizing<[u8; MASTER_KEY_LEN]>) {
    *session_guard() = Some(UnlockedVault {
        repo: root.to_path_buf(),
        master,
    });
}

fn clear_session() {
    *session_guard() = None;
}

/// 测试辅助：会话是进程级全局状态，跨模块的用例必须共享同一把串行锁。
#[cfg(test)]
pub(crate) fn test_guard() -> MutexGuard<'static, ()> {
    static LOCK: Mutex<()> = Mutex::new(());
    LOCK.lock().unwrap_or_else(|poison| poison.into_inner())
}

#[cfg(test)]
#[path = "vault_service_tests.rs"]
mod vault_service_tests;

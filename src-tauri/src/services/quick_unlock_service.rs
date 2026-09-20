//! 设备级快速解锁用例（P0）：本机开关状态、开启、关闭、用设备认证解锁。
//!
//! 口令是唯一凭证这条不变：快速解锁只是把**同一把主密钥**额外封在平台安全存储里，
//! 并且必须通过设备认证才能取回。平台差异（钥匙串 / Keystore / 不支持）全部收敛在
//! `platform::quick_unlock::DeviceKeyStore` 之后，本文件不感知任何平台 API。

use std::path::{Path, PathBuf};

use sha2::{Digest, Sha256};
use zeroize::Zeroizing;

use crate::domain::error::AppError;
use crate::domain::quick_unlock::{QuickUnlockMarker, QuickUnlockPayload, QuickUnlockStatus};
use crate::domain::vault::MASTER_KEY_LEN;
use crate::platform::quick_unlock::DeviceKeyStore;
use crate::repositories::{quick_unlock_files, vault_files};
use crate::services::{vault_crypto, vault_service};

/// 认证弹窗里的理由文案（由用例层给出，平台层只负责展示）。
pub const UNLOCK_REASON: &str = "解锁加密笔记";

/// 「本机 + 本仓库」的设备条目上下文。
/// 条目名由仓库路径派生，配置目录存设备侧标记；两者都不进仓库、不随 Git 同步。
pub struct QuickUnlockContext {
    config_root: PathBuf,
    repo: PathBuf,
    account: String,
}

impl QuickUnlockContext {
    pub fn new(config_root: PathBuf, repo: &Path) -> Self {
        // 保留调用方给出的仓库路径：会话是按该路径建立的，换一种写法会被当成另一个仓库。
        // 条目名另行规范化（见 account_id），因此同一仓库的不同写法仍共用同一个条目。
        let account = account_id(repo);
        Self {
            config_root,
            repo: repo.to_path_buf(),
            account,
        }
    }
}

/// 设备条目名：仓库路径的 sha256 前 16 位 hex。
/// 用哈希而非明文路径，避免把本机目录结构写进钥匙串条目名。
fn account_id(repo: &Path) -> String {
    let normalized = std::fs::canonicalize(repo).unwrap_or_else(|_| repo.to_path_buf());
    let digest = Sha256::digest(normalized.to_string_lossy().as_bytes());
    let mut suffix = String::with_capacity(16);
    for byte in digest.iter().take(8) {
        suffix.push_str(&format!("{byte:02x}"));
    }
    format!("vault-{suffix}")
}

/// 当前状态：平台能力 + 本机是否为该仓库开启。
/// **只读标记文件与平台能力，绝不触发认证弹窗**（`vault_status` 会被频繁调用）。
pub fn status(ctx: &QuickUnlockContext, store: &dyn DeviceKeyStore) -> QuickUnlockStatus {
    let support = store.support();
    if !support.supported {
        return QuickUnlockStatus::unsupported();
    }
    let enabled = quick_unlock_files::load(&ctx.config_root, &ctx.account).is_some();
    QuickUnlockStatus::new(true, enabled, support.kind)
}

/// 开启（或重新开启）：要求会话已解锁，把当前主密钥封进平台安全存储，再落设备标记。
pub fn enable(
    ctx: &QuickUnlockContext,
    store: &dyn DeviceKeyStore,
) -> Result<QuickUnlockStatus, AppError> {
    let support = store.support();
    let kind = support.kind.filter(|_| support.supported).ok_or_else(|| {
        AppError::VaultQuickUnlockUnavailable(
            "当前系统不支持设备级快速解锁，请使用仓库口令解锁".to_string(),
        )
    })?;
    // 未解锁 → VAULT_9001：主密钥不在内存里，没有可封存的东西。
    let master = vault_service::session_master(&ctx.repo)?;
    let file = load_vault_file(ctx)?;
    let fingerprint = vault_crypto::vault_fingerprint(&file);
    let payload = QuickUnlockPayload::new(fingerprint.clone(), vault_crypto::b64_encode(&master[..]));
    let serialized = serde_json::to_string(&payload)
        .map_err(|error| AppError::Io(format!("序列化设备快速解锁条目失败: {error}")))?;
    store.store(&ctx.account, &serialized)?;
    // 条目已写入但标记写失败时回滚条目，避免留下「没人认领」的密钥副本。
    if let Err(err) = quick_unlock_files::save(
        &ctx.config_root,
        &ctx.account,
        &QuickUnlockMarker::new(fingerprint, kind),
    ) {
        let _ = store.delete(&ctx.account);
        return Err(err);
    }
    Ok(status(ctx, store))
}

/// 关闭：删除设备条目与标记（幂等；底层删除失败也不阻断用户关闭意图）。
pub fn disable(
    ctx: &QuickUnlockContext,
    store: &dyn DeviceKeyStore,
) -> Result<QuickUnlockStatus, AppError> {
    let _ = store.delete(&ctx.account);
    quick_unlock_files::remove(&ctx.config_root, &ctx.account)?;
    Ok(status(ctx, store))
}

/// 用设备级认证解锁：读设备条目 → 校验仓库指纹 → 建立会话。
/// 取消返回 `VAULT_9007`（前端静默）；条目失效返回 `VAULT_9006` 并就地清理。
pub fn unlock(
    ctx: &QuickUnlockContext,
    store: &dyn DeviceKeyStore,
) -> Result<QuickUnlockStatus, AppError> {
    if quick_unlock_files::load(&ctx.config_root, &ctx.account).is_none() {
        return Err(AppError::VaultQuickUnlockUnavailable(
            "本机尚未开启设备级快速解锁，请用仓库口令解锁".to_string(),
        ));
    }
    let file = load_vault_file(ctx)?;
    let fingerprint = vault_crypto::vault_fingerprint(&file);
    let raw = match store.load(&ctx.account, UNLOCK_REASON) {
        Ok(raw) => raw,
        Err(err) => {
            forget_if_stale(ctx, store, &err);
            return Err(err);
        }
    };
    match decode_payload(&raw, &fingerprint) {
        Ok(master) => {
            vault_service::adopt_master(&ctx.repo, master)?;
            Ok(status(ctx, store))
        }
        Err(err) => {
            forget_if_stale(ctx, store, &err);
            Err(err)
        }
    }
}

/// 密钥库被改写（建库 / 改口令）后的收尾：
/// 指纹随 `vault.json` 变化，已开启的快速解锁必须重新封装；失败则关闭并降级为纯口令。
/// 返回收尾后的状态（本函数不对外报错：口令相关操作已经成功）。
pub fn after_vault_rewritten(ctx: &QuickUnlockContext, store: &dyn DeviceKeyStore) -> QuickUnlockStatus {
    if quick_unlock_files::load(&ctx.config_root, &ctx.account).is_none() {
        // 未开启：顺手清掉可能残留的条目（例如建库前遗留）。
        let _ = store.delete(&ctx.account);
        return status(ctx, store);
    }
    match enable(ctx, store) {
        Ok(next) => next,
        Err(_) => {
            let _ = disable(ctx, store);
            status(ctx, store)
        }
    }
}

fn load_vault_file(ctx: &QuickUnlockContext) -> Result<crate::domain::vault::VaultFile, AppError> {
    vault_files::load(&ctx.repo)?
        .ok_or_else(|| AppError::VaultInvalid("该仓库尚未建库".to_string()))
}

/// 条目失效（指纹不符 / 格式损坏 / 平台报 stale）时清干净，避免用户反复撞同一堵墙。
/// 认证取消与瞬时失败**不**清理，用户仍可重试。
fn forget_if_stale(ctx: &QuickUnlockContext, store: &dyn DeviceKeyStore, err: &AppError) {
    if matches!(err, AppError::VaultQuickUnlockUnavailable(_)) {
        let _ = store.delete(&ctx.account);
        let _ = quick_unlock_files::remove(&ctx.config_root, &ctx.account);
    }
}

fn decode_payload(
    raw: &str,
    fingerprint: &str,
) -> Result<Zeroizing<[u8; MASTER_KEY_LEN]>, AppError> {
    let payload = QuickUnlockPayload::parse(raw)?;
    payload.validate_for(fingerprint)?;
    let bytes = vault_crypto::b64_decode(&payload.master, "设备快速解锁主密钥")
        .map_err(|_| stale("设备条目中的主密钥格式无效"))?;
    let master = <[u8; MASTER_KEY_LEN]>::try_from(bytes.as_slice())
        .map_err(|_| stale("设备条目中的主密钥长度非法"))?;
    Ok(Zeroizing::new(master))
}

fn stale(detail: &str) -> AppError {
    AppError::VaultQuickUnlockUnavailable(format!(
        "{detail}，请用仓库口令解锁后重新开启设备级快速解锁"
    ))
}

#[cfg(test)]
#[path = "quick_unlock_service_tests.rs"]
mod quick_unlock_service_tests;

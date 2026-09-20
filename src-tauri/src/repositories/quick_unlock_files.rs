//! 设备级快速解锁的**设备侧标记文件**（位于应用配置目录，永不进仓库、永不同步）。
//!
//! 只记录「本机为哪个仓库开启了快速解锁 + 绑定的仓库密钥指纹 + 认证方式」，
//! 密钥本体在平台安全存储（钥匙串 / Keystore）里。状态查询读这个文件，
//! 因此 `vault_status` 永远不会触发系统认证弹窗。

use std::fs;
use std::io::{ErrorKind, Write};
use std::path::{Path, PathBuf};

use crate::domain::error::AppError;
use crate::domain::quick_unlock::QuickUnlockMarker;

/// 配置目录下的子目录名。
const DIR: &str = "quick-unlock";

/// 读取标记；不存在 / 损坏 / 版本不符都按「未开启」处理。
pub fn load(config_root: &Path, account: &str) -> Option<QuickUnlockMarker> {
    let raw = fs::read_to_string(path(config_root, account)).ok()?;
    QuickUnlockMarker::parse(&raw)
}

/// 写入标记（覆盖写，0600，原子替换）。
pub fn save(config_root: &Path, account: &str, marker: &QuickUnlockMarker) -> Result<(), AppError> {
    let target = path(config_root, account);
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)
            .map_err(|err| AppError::io_context("创建设备快速解锁目录失败", parent, err))?;
    }
    let mut serialized = serde_json::to_vec_pretty(marker)
        .map_err(|error| AppError::Io(format!("序列化设备快速解锁标记失败: {error}")))?;
    serialized.push(b'\n');
    let temporary = target.with_extension("tmp");
    {
        let mut options = fs::OpenOptions::new();
        options.write(true).create(true).truncate(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let mut file = options
            .open(&temporary)
            .map_err(|err| AppError::io_context("写入设备快速解锁标记失败", &temporary, err))?;
        file.write_all(&serialized)
            .and_then(|()| file.sync_all())
            .map_err(|err| AppError::io_context("落盘设备快速解锁标记失败", &temporary, err))?;
    }
    fs::rename(&temporary, &target)
        .map_err(|err| AppError::io_context("替换设备快速解锁标记失败", &target, err))?;
    Ok(())
}

/// 删除标记；不存在视为成功（幂等）。
pub fn remove(config_root: &Path, account: &str) -> Result<(), AppError> {
    match fs::remove_file(path(config_root, account)) {
        Ok(()) => Ok(()),
        Err(err) if err.kind() == ErrorKind::NotFound => Ok(()),
        Err(err) => Err(AppError::io_context(
            "删除设备快速解锁标记失败",
            &path(config_root, account),
            err,
        )),
    }
}

fn path(config_root: &Path, account: &str) -> PathBuf {
    config_root.join(DIR).join(format!("{account}.json"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::quick_unlock::QuickUnlockKind;

    fn marker() -> QuickUnlockMarker {
        QuickUnlockMarker::new("fp-1".into(), QuickUnlockKind::TouchId)
    }

    #[test]
    fn save_then_load_round_trips() {
        let dir = tempfile::tempdir().unwrap();
        assert!(load(dir.path(), "vault-abc").is_none());
        save(dir.path(), "vault-abc", &marker()).unwrap();
        assert_eq!(load(dir.path(), "vault-abc").unwrap(), marker());
        assert!(!dir.path().join("quick-unlock/vault-abc.tmp").exists(), "临时文件不残留");
    }

    #[test]
    fn different_accounts_are_isolated() {
        let dir = tempfile::tempdir().unwrap();
        save(dir.path(), "vault-a", &marker()).unwrap();
        assert!(load(dir.path(), "vault-b").is_none());
        remove(dir.path(), "vault-a").unwrap();
        assert!(load(dir.path(), "vault-a").is_none());
        remove(dir.path(), "vault-a").unwrap();
    }

    #[test]
    fn broken_or_unknown_marker_reads_as_disabled() {
        let dir = tempfile::tempdir().unwrap();
        fs::create_dir_all(dir.path().join(DIR)).unwrap();
        fs::write(dir.path().join("quick-unlock/vault-abc.json"), "{ broken").unwrap();
        assert!(load(dir.path(), "vault-abc").is_none());
        fs::write(
            dir.path().join("quick-unlock/vault-abc.json"),
            r#"{"version":99,"vaultFingerprint":"f","kind":"touchId"}"#,
        )
        .unwrap();
        assert!(load(dir.path(), "vault-abc").is_none());
    }

    #[cfg(unix)]
    #[test]
    fn marker_file_is_owner_only() {
        use std::os::unix::fs::PermissionsExt;
        let dir = tempfile::tempdir().unwrap();
        save(dir.path(), "vault-abc", &marker()).unwrap();
        let mode = fs::metadata(dir.path().join("quick-unlock/vault-abc.json"))
            .unwrap()
            .permissions()
            .mode();
        assert_eq!(mode & 0o777, 0o600);
    }
}

//! 设备级快速解锁用例测试：平台存储用内存 mock，覆盖开启 / 解锁 / 失效 / 取消 / 收尾。
//! 会话是进程级全局状态，凡触碰会话的用例都串行执行（与 vault_service_tests 共用同一把锁）。

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use super::*;
use crate::domain::quick_unlock::QuickUnlockKind;
use crate::domain::vault::VaultState;
use crate::platform::quick_unlock::DeviceSupport;
use crate::services::vault_service::test_guard;

/// 内存版设备存储：可切换能力与读取行为，并记录调用次数。
struct MockStore {
    supported: bool,
    kind: QuickUnlockKind,
    fail_store: Mutex<bool>,
    entry: Mutex<Option<String>>,
    read: Mutex<ReadBehaviour>,
    store_calls: Mutex<u32>,
    delete_calls: Mutex<u32>,
}

#[derive(Debug, Clone)]
enum ReadBehaviour {
    /// 返回当前条目（正常路径）。
    Entry,
    Cancel,
    Stale,
    Fail,
}

impl MockStore {
    fn new(supported: bool) -> Self {
        Self {
            supported,
            kind: QuickUnlockKind::TouchId,
            fail_store: Mutex::new(false),
            entry: Mutex::new(None),
            read: Mutex::new(ReadBehaviour::Entry),
            store_calls: Mutex::new(0),
            delete_calls: Mutex::new(0),
        }
    }

    fn entry(&self) -> Option<String> {
        self.entry.lock().unwrap().clone()
    }

    fn set_read(&self, behaviour: ReadBehaviour) {
        *self.read.lock().unwrap() = behaviour;
    }

    fn set_fail_store(&self, fail: bool) {
        *self.fail_store.lock().unwrap() = fail;
    }

    fn store_calls(&self) -> u32 {
        *self.store_calls.lock().unwrap()
    }

    fn delete_calls(&self) -> u32 {
        *self.delete_calls.lock().unwrap()
    }
}

impl DeviceKeyStore for MockStore {
    fn support(&self) -> DeviceSupport {
        if self.supported {
            DeviceSupport::available(self.kind)
        } else {
            DeviceSupport::unavailable()
        }
    }

    fn store(&self, _account: &str, payload: &str) -> Result<(), AppError> {
        *self.store_calls.lock().unwrap() += 1;
        if *self.fail_store.lock().unwrap() {
            return Err(AppError::VaultDeviceAuthFailed("写入被拒绝".into()));
        }
        *self.entry.lock().unwrap() = Some(payload.to_string());
        Ok(())
    }

    fn load(&self, _account: &str, _reason: &str) -> Result<String, AppError> {
        match self.read.lock().unwrap().clone() {
            ReadBehaviour::Entry => self.entry().ok_or_else(|| stale("设备条目不存在")),
            ReadBehaviour::Cancel => Err(AppError::VaultDeviceAuthCancelled("已取消设备认证".into())),
            ReadBehaviour::Stale => Err(stale("快速解锁密钥已失效")),
            ReadBehaviour::Fail => Err(AppError::VaultDeviceAuthFailed("设备认证失败".into())),
        }
    }

    fn delete(&self, _account: &str) -> Result<(), AppError> {
        *self.delete_calls.lock().unwrap() += 1;
        *self.entry.lock().unwrap() = None;
        Ok(())
    }
}

struct Fixture {
    _dir: tempfile::TempDir,
    repo: PathBuf,
    ctx: QuickUnlockContext,
    store: MockStore,
}

fn fixture(supported: bool) -> Fixture {
    let dir = tempfile::tempdir().unwrap();
    let repo = dir.path().join("repo");
    std::fs::create_dir_all(&repo).unwrap();
    let ctx = QuickUnlockContext::new(dir.path().join("config"), &repo);
    Fixture {
        _dir: dir,
        repo,
        ctx,
        store: MockStore::new(supported),
    }
}

fn marker_path(fixture: &Fixture) -> PathBuf {
    fixture
        .ctx
        .config_root
        .join("quick-unlock")
        .join(format!("{}.json", fixture.ctx.account))
}

#[test]
fn status_reflects_platform_support_and_marker_without_prompting() {
    let _serial = test_guard();
    let unsupported = fixture(false);
    let unsupported_status = status(&unsupported.ctx, &unsupported.store);
    assert!(!unsupported_status.supported);
    assert!(!unsupported_status.enabled);
    assert_eq!(unsupported.store.store_calls(), 0, "只查状态不得写入任何东西");

    let supported = fixture(true);
    let supported_status = status(&supported.ctx, &supported.store);
    assert!(supported_status.supported);
    assert!(!supported_status.enabled);
    assert_eq!(supported_status.kind, Some(QuickUnlockKind::TouchId));

    vault_service::create(&supported.repo, "correct horse battery").unwrap();
    enable(&supported.ctx, &supported.store).unwrap();
    assert!(status(&supported.ctx, &supported.store).enabled);
    assert!(marker_path(&supported).is_file());
}

#[test]
fn enable_requires_an_unlocked_session_and_writes_nothing_when_locked() {
    let _serial = test_guard();
    let fixture = fixture(true);
    vault_service::create(&fixture.repo, "correct horse battery").unwrap();
    vault_service::lock(&fixture.repo).unwrap();

    let err = enable(&fixture.ctx, &fixture.store).unwrap_err();
    assert!(matches!(err, AppError::VaultLocked(_)));
    assert_eq!(fixture.store.store_calls(), 0, "锁定态不得把密钥写进设备存储");
    assert!(!marker_path(&fixture).exists());
}

#[test]
fn enable_then_device_unlock_restores_the_same_master_key() {
    let _serial = test_guard();
    let fixture = fixture(true);
    vault_service::create(&fixture.repo, "correct horse battery").unwrap();
    let master = vault_service::session_master(&fixture.repo).unwrap();
    enable(&fixture.ctx, &fixture.store).unwrap();

    vault_service::lock(&fixture.repo).unwrap();
    assert!(status(&fixture.ctx, &fixture.store).enabled, "锁定不影响设备条目");

    let unlocked = unlock(&fixture.ctx, &fixture.store).unwrap();
    assert!(unlocked.enabled);
    assert_eq!(
        vault_service::session_master(&fixture.repo).unwrap().as_slice(),
        master.as_slice(),
        "设备解锁必须恢复同一把主密钥"
    );
    assert_eq!(
        vault_service::status(&fixture.repo).unwrap().state,
        VaultState::Unlocked
    );
}

#[test]
fn device_unlock_rejects_entries_sealed_for_another_vault_generation() {
    let _serial = test_guard();
    let fixture = fixture(true);
    vault_service::create(&fixture.repo, "correct horse battery").unwrap();
    enable(&fixture.ctx, &fixture.store).unwrap();
    vault_service::lock(&fixture.repo).unwrap();
    // 改口令换代：指纹变化，旧条目必须失效且被就地清理。
    vault_service::change_passphrase(&fixture.repo, "correct horse battery", "another passphrase")
        .unwrap();
    vault_service::lock(&fixture.repo).unwrap();

    let err = unlock(&fixture.ctx, &fixture.store).unwrap_err();
    assert!(matches!(err, AppError::VaultQuickUnlockUnavailable(_)), "应提示重新开启");
    assert!(fixture.store.entry().is_none(), "失效条目必须删除");
    assert!(!marker_path(&fixture).exists(), "失效标记必须删除");
    assert!(!vault_service::is_unlocked(&fixture.repo));
}

#[test]
fn cancelled_authentication_keeps_entry_so_the_user_can_retry() {
    let _serial = test_guard();
    let fixture = fixture(true);
    vault_service::create(&fixture.repo, "correct horse battery").unwrap();
    enable(&fixture.ctx, &fixture.store).unwrap();
    vault_service::lock(&fixture.repo).unwrap();
    fixture.store.set_read(ReadBehaviour::Cancel);

    let err = unlock(&fixture.ctx, &fixture.store).unwrap_err();
    assert!(matches!(err, AppError::VaultDeviceAuthCancelled(_)));
    assert!(fixture.store.entry().is_some(), "取消不是失效，条目要保留");
    assert!(marker_path(&fixture).exists());
    assert!(!vault_service::is_unlocked(&fixture.repo));
}

#[test]
fn platform_declared_stale_entry_is_cleaned_up() {
    let _serial = test_guard();
    let fixture = fixture(true);
    vault_service::create(&fixture.repo, "correct horse battery").unwrap();
    enable(&fixture.ctx, &fixture.store).unwrap();
    vault_service::lock(&fixture.repo).unwrap();
    fixture.store.set_read(ReadBehaviour::Stale);

    assert!(matches!(
        unlock(&fixture.ctx, &fixture.store).unwrap_err(),
        AppError::VaultQuickUnlockUnavailable(_)
    ));
    assert!(!marker_path(&fixture).exists(), "平台说条目失效就要清干净");
}

#[test]
fn transient_platform_failure_keeps_the_entry() {
    let _serial = test_guard();
    let fixture = fixture(true);
    vault_service::create(&fixture.repo, "correct horse battery").unwrap();
    enable(&fixture.ctx, &fixture.store).unwrap();
    vault_service::lock(&fixture.repo).unwrap();
    // 系统忙 / 硬件不可用这类瞬时失败：既不算失效，也不能顺手删掉用户的条目。
    fixture.store.set_read(ReadBehaviour::Fail);

    assert!(matches!(
        unlock(&fixture.ctx, &fixture.store).unwrap_err(),
        AppError::VaultDeviceAuthFailed(_)
    ));
    assert!(fixture.store.entry().is_some(), "瞬时失败必须保留条目供重试");
    assert!(marker_path(&fixture).exists());

    // 重试即可成功（用户手动再点一次）。
    fixture.store.set_read(ReadBehaviour::Entry);
    assert!(unlock(&fixture.ctx, &fixture.store).is_ok());
}

#[test]
fn disable_removes_entry_and_marker_and_unlock_then_reports_unavailable() {
    let _serial = test_guard();
    let fixture = fixture(true);
    vault_service::create(&fixture.repo, "correct horse battery").unwrap();
    enable(&fixture.ctx, &fixture.store).unwrap();

    let after = disable(&fixture.ctx, &fixture.store).unwrap();
    assert!(!after.enabled);
    assert!(fixture.store.entry().is_none());
    assert!(!marker_path(&fixture).exists());
    assert!(fixture.store.delete_calls() >= 1);

    vault_service::lock(&fixture.repo).unwrap();
    assert!(matches!(
        unlock(&fixture.ctx, &fixture.store).unwrap_err(),
        AppError::VaultQuickUnlockUnavailable(_)
    ));
}

#[test]
fn rewritten_vault_reseals_the_entry_or_falls_back_to_passphrase_only() {
    let _serial = test_guard();
    let fixture = fixture(true);
    vault_service::create(&fixture.repo, "correct horse battery").unwrap();
    enable(&fixture.ctx, &fixture.store).unwrap();

    vault_service::change_passphrase(&fixture.repo, "correct horse battery", "another passphrase")
        .unwrap();
    let resealed = after_vault_rewritten(&fixture.ctx, &fixture.store);
    assert!(resealed.enabled, "已开启时改口令后自动重新封装");
    vault_service::lock(&fixture.repo).unwrap();
    assert!(unlock(&fixture.ctx, &fixture.store).is_ok(), "重新封装后仍可设备解锁");

    // 平台写入失败时降级为纯口令，不把用户卡在不可用的开关上。
    fixture.store.set_fail_store(true);
    let degraded = after_vault_rewritten(&fixture.ctx, &fixture.store);
    assert!(!degraded.enabled);
    assert!(!marker_path(&fixture).exists());
}

#[test]
fn account_id_is_stable_and_unique_per_repo_path() {
    let first = account_id(Path::new("/tmp/notes"));
    assert_eq!(first, account_id(Path::new("/tmp/notes")));
    assert_ne!(first, account_id(Path::new("/tmp/notes-2")));
    assert!(first.starts_with("vault-"));
    assert_eq!(first.len(), "vault-".len() + 16);
    assert!(!first.contains("tmp"), "条目名不得泄漏明文路径");
}

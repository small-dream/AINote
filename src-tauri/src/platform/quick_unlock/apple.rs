//! macOS / iOS 设备密钥存储。
//!
//! - **iOS**：钥匙串通用密码 + `kSecAccessControlUserPresence`（`WhenPasscodeSetThisDeviceOnly`）。
//!   系统在读取条目时强制 Face ID / Touch ID / 设备密码，条目本身不可导出。
//! - **macOS**：优先写入带访问控制的数据保护钥匙串条目（需要开发者签名 + `keychain-access-groups` 授权）。
//!   实测 ad-hoc 签名构建会被系统拒绝（`errSecMissingEntitlement`），此时回退为登录钥匙串条目 +
//!   显式 `LAContext.evaluatePolicy(.deviceOwnerAuthentication)` 门禁。
//!   两条路径的数据格式一致，M1.5 落地签名后无需改代码即可自动升级到硬件门禁。
//!   详见 docs/QUICK_UNLOCK_PLAN.md §2。

#[cfg(target_os = "macos")]
use std::sync::mpsc;
#[cfg(target_os = "macos")]
use std::time::Duration;

#[cfg(target_os = "macos")]
use block2::RcBlock;
#[cfg(target_os = "macos")]
use objc2::runtime::Bool;
#[cfg(target_os = "macos")]
use objc2_foundation::{NSError, NSString};
use objc2_local_authentication::{LAContext, LABiometryType, LAPolicy};
#[cfg(target_os = "macos")]
use objc2_local_authentication::LAError;
use security_framework::access_control::{ProtectionMode, SecAccessControl};
use security_framework::base::Error as SecurityError;
use security_framework::passwords::{
    delete_generic_password_options, generic_password, set_generic_password_options,
    AccessControlOptions, PasswordOptions,
};
use security_framework_sys::base::errSecItemNotFound;

use crate::domain::error::AppError;
use crate::domain::quick_unlock::{QuickUnlockKind, QuickUnlockUnsupportedReason};
use crate::platform::quick_unlock::{DeviceKeyStore, DeviceSupport};

/// 设备条目所属的钥匙串服务名：与 Token / API Key 的凭证存储隔离。
const SERVICE: &str = "dev.ainote.app.quickunlock";
/// `errSecMissingEntitlement`：当前构建缺少使用带访问控制条目所需的授权（未签名 / ad-hoc 签名）。
/// security-framework-sys 未导出该常量，这里按 Security 框架的公开错误码硬编码。
const ERR_SEC_MISSING_ENTITLEMENT: i32 = -34_018;
/// 认证等待上限：用户长时间不理会时不能永久占住后台线程。
#[cfg(target_os = "macos")]
const AUTH_TIMEOUT: Duration = Duration::from_secs(120);

pub(super) struct AppleDeviceKeyStore;

impl AppleDeviceKeyStore {
    pub(super) fn new() -> Self {
        Self
    }
}

impl DeviceKeyStore for AppleDeviceKeyStore {
    fn support(&self) -> DeviceSupport {
        // LocalAuthentication 内部会产生 autorelease 对象：后台线程上必须自带池，
        // 否则系统会打印「autoreleased with no pool in place」并泄漏。
        objc2::rc::autoreleasepool(|_pool| {
            let context = unsafe { LAContext::new() };
            let biometrics = unsafe {
                context.canEvaluatePolicy_error(LAPolicy::DeviceOwnerAuthenticationWithBiometrics)
            }
            .is_ok();
            if biometrics {
                if let Some(kind) = biometry_kind(&context) {
                    return DeviceSupport::available(kind);
                }
            }
            // 没有生物识别（或未录入）时退回设备凭证：macOS 是登录密码，iOS 是设备密码。
            let owner =
                unsafe { context.canEvaluatePolicy_error(LAPolicy::DeviceOwnerAuthentication) }.is_ok();
            if owner {
                return DeviceSupport::available(QuickUnlockKind::DeviceCredential);
            }
            DeviceSupport::unavailable(QuickUnlockUnsupportedReason::DeviceAuthUnavailable)
        })
    }

    fn store(&self, account: &str, payload: &str) -> Result<(), AppError> {
        match write_item(account, payload, true) {
            Ok(()) => Ok(()),
            // macOS：带访问控制的条目不可用（未签名构建）时退化为登录钥匙串条目 + 显式认证门禁。
            #[cfg(target_os = "macos")]
            Err(err) if err.code() == ERR_SEC_MISSING_ENTITLEMENT => {
                write_item(account, payload, false).map_err(|err| write_failed(&err))
            }
            Err(err) => Err(write_failed(&err)),
        }
    }

    fn load(&self, account: &str, reason: &str) -> Result<String, AppError> {
        // 先按带访问控制的条目读：iOS 由系统弹窗，macOS 仅签名构建能命中。
        if let Ok(bytes) = read_item(account, true) {
            return decode(bytes);
        }
        #[cfg(target_os = "macos")]
        {
            // 登录钥匙串条目本身没有生物识别门禁，因此必须显式做一次设备认证再取密钥。
            authenticate(reason)?;
            return read_item(account, false)
                .map_err(|_| stale())
                .and_then(decode);
        }
        #[cfg(not(target_os = "macos"))]
        {
            let _ = reason;
            Err(stale())
        }
    }

    fn delete(&self, account: &str) -> Result<(), AppError> {
        let mut first_error: Option<SecurityError> = None;
        for protected in [true, false] {
            if let Err(err) = delete_item(account, protected) {
                if !ignorable_delete(&err) && first_error.is_none() {
                    first_error = Some(err);
                }
            }
        }
        match first_error {
            None => Ok(()),
            Some(err) => Err(AppError::VaultQuickUnlockUnavailable(format!(
                "无法清除设备上的快速解锁条目：{err}"
            ))),
        }
    }
}

/// 条目不存在（另一种存储模式 / 本就没开启过）、或当前构建无权访问数据保护钥匙串，
/// 都表示「这个位置没有需要删的东西」，不算失败。
fn ignorable_delete(err: &SecurityError) -> bool {
    let code = err.code();
    code == errSecItemNotFound || code == ERR_SEC_MISSING_ENTITLEMENT
}

/// 写入条目。`protected = true` 表示带访问控制（可用时优先），false 表示登录钥匙串普通条目。
fn write_item(account: &str, payload: &str, protected: bool) -> Result<(), SecurityError> {
    let mut options = PasswordOptions::new_generic_password(SERVICE, account);
    // 快速解锁是设备本地能力，绝不随 iCloud 钥匙串同步。
    options.set_access_synchronized(Some(false));
    if protected {
        let access = SecAccessControl::create_with_protection(
            Some(ProtectionMode::AccessibleWhenPasscodeSetThisDeviceOnly),
            AccessControlOptions::USER_PRESENCE.bits(),
        )?;
        options.set_access_control(access);
        #[cfg(target_os = "macos")]
        options.use_protected_keychain();
    }
    set_generic_password_options(payload.as_bytes(), options)
}

/// 读取条目。`protected` 只影响 macOS 是否指定数据保护钥匙串；iOS 无需区分。
fn read_item(account: &str, protected: bool) -> Result<Vec<u8>, SecurityError> {
    generic_password(with_protected_keychain(
        PasswordOptions::new_generic_password(SERVICE, account),
        protected,
    ))
}

fn delete_item(account: &str, protected: bool) -> Result<(), SecurityError> {
    let options = with_protected_keychain(
        PasswordOptions::new_generic_password(SERVICE, account),
        protected,
    );
    delete_generic_password_options(options)
}

/// 条目可能落在两种钥匙串里（见文件头说明），查询参数必须与之匹配。
#[cfg(target_os = "macos")]
fn with_protected_keychain(mut options: PasswordOptions, protected: bool) -> PasswordOptions {
    if protected {
        options.use_protected_keychain();
    }
    options
}

#[cfg(not(target_os = "macos"))]
fn with_protected_keychain(options: PasswordOptions, _protected: bool) -> PasswordOptions {
    // iOS 只有数据保护钥匙串，没有需要区分的两种位置。
    options
}

/// 触发一次系统设备认证（Touch ID / Face ID / 登录密码 / 设备密码）。
#[cfg(target_os = "macos")]
fn authenticate(reason: &str) -> Result<(), AppError> {
    objc2::rc::autoreleasepool(|_pool| authenticate_in_pool(reason))
}

#[cfg(target_os = "macos")]
fn authenticate_in_pool(reason: &str) -> Result<(), AppError> {
    let context = unsafe { LAContext::new() };
    if unsafe { context.canEvaluatePolicy_error(LAPolicy::DeviceOwnerAuthentication) }.is_err() {
        return Err(AppError::VaultDeviceAuthFailed(
            "本机未设置可用的设备认证方式".to_string(),
        ));
    }
    let (sender, receiver) = mpsc::channel();
    let reply = RcBlock::new(move |success: Bool, error: *mut NSError| {
        let code = if error.is_null() {
            0
        } else {
            unsafe { (*error).code() }
        };
        let _ = sender.send((success.as_bool(), code));
    });
    let reason = NSString::from_str(reason);
    unsafe {
        context.evaluatePolicy_localizedReason_reply(LAPolicy::DeviceOwnerAuthentication, &reason, &reply);
    }
    match receiver.recv_timeout(AUTH_TIMEOUT) {
        Ok((true, _)) => Ok(()),
        Ok((false, code)) => Err(map_auth_error(code)),
        Err(_) => Err(AppError::VaultDeviceAuthFailed(
            "设备认证超时，请重试或改用仓库口令".to_string(),
        )),
    }
}

/// 把 LocalAuthentication 的错误码翻译成领域错误：取消与其它失败必须区分（取消要静默）。
#[cfg(target_os = "macos")]
fn map_auth_error(code: isize) -> AppError {
    let cancelled = [
        LAError::UserCancel.0,
        LAError::SystemCancel.0,
        LAError::AppCancel.0,
        LAError::UserFallback.0,
    ];
    if cancelled.contains(&code) {
        return AppError::VaultDeviceAuthCancelled("已取消设备认证".to_string());
    }
    let detail = if code == LAError::BiometryNotEnrolled.0 {
        "本机尚未录入生物识别"
    } else if code == LAError::BiometryNotAvailable.0 {
        "本机生物识别不可用"
    } else if code == LAError::BiometryLockout.0 {
        "生物识别已被系统锁定，请先用设备密码解锁系统"
    } else if code == LAError::PasscodeNotSet.0 {
        "本机未设置设备密码"
    } else {
        "设备认证失败"
    };
    AppError::VaultDeviceAuthFailed(format!("{detail}，请重试或改用仓库口令"))
}

fn biometry_kind(context: &LAContext) -> Option<QuickUnlockKind> {
    let kind = unsafe { context.biometryType() };
    if kind == LABiometryType::TouchID {
        Some(QuickUnlockKind::TouchId)
    } else if kind == LABiometryType::FaceID {
        Some(QuickUnlockKind::FaceId)
    } else if kind == LABiometryType::OpticID {
        Some(QuickUnlockKind::OpticId)
    } else {
        None
    }
}

fn decode(bytes: Vec<u8>) -> Result<String, AppError> {
    String::from_utf8(bytes).map_err(|_| stale())
}

fn stale() -> AppError {
    AppError::VaultQuickUnlockUnavailable(
        "本机没有可用的快速解锁条目，请用仓库口令解锁后重新开启".to_string(),
    )
}

fn write_failed(err: &SecurityError) -> AppError {
    AppError::VaultQuickUnlockUnavailable(format!("无法写入系统安全存储：{err}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[cfg(target_os = "macos")]
    fn cancel_codes_stay_separate_from_failures() {
        for code in [
            LAError::UserCancel.0,
            LAError::SystemCancel.0,
            LAError::AppCancel.0,
            LAError::UserFallback.0,
        ] {
            assert!(
                matches!(map_auth_error(code), AppError::VaultDeviceAuthCancelled(_)),
                "{code} 属于用户取消"
            );
        }
    }

    #[test]
    #[cfg(target_os = "macos")]
    fn failure_codes_carry_actionable_reason() {
        let lockout = map_auth_error(LAError::BiometryLockout.0);
        assert!(matches!(lockout, AppError::VaultDeviceAuthFailed(_)));
        assert!(lockout.to_string().contains("锁定"));

        let not_enrolled = map_auth_error(LAError::BiometryNotEnrolled.0);
        assert!(not_enrolled.to_string().contains("尚未录入生物识别"));

        let generic = map_auth_error(LAError::AuthenticationFailed.0);
        assert!(generic.to_string().contains("请重试或改用仓库口令"));
    }

    #[test]
    fn support_probe_reports_a_kind_when_supported() {
        let support = AppleDeviceKeyStore::new().support();
        if support.supported {
            assert!(support.kind.is_some());
        }
    }

    /// 真机钥匙串往返（默认 ignore）：往登录钥匙串写一条测试条目、读回、删除。
    /// 验证的是「带访问控制失败 → 登录钥匙串回退」这条链路；**不含认证弹窗**
    /// （`load()` 会调用 LAContext，需人工确认，见 docs/QUICK_UNLOCK_PLAN.md §7）。
    /// 手动执行：`cd src-tauri && cargo test -- --ignored --nocapture apple_keychain`
    #[test]
    #[ignore = "需要真实 macOS 钥匙串，手动执行"]
    fn apple_keychain_round_trip_without_access_control() {
        let account = "vault-smoke-test";
        let payload = r#"{"version":1,"vaultFingerprint":"smoke","master":"QUJD"}"#;
        let _ = delete_item(account, true);
        let _ = delete_item(account, false);
        // 走真实入口：带访问控制不可用时（未签名构建）必须自动回退，而不是直接报错。
        AppleDeviceKeyStore::new()
            .store(account, payload)
            .expect("设备条目应能写入（必要时回退登录钥匙串）");
        let stored = read_item(account, false).expect("登录钥匙串条目应可读回");
        assert_eq!(String::from_utf8_lossy(&stored), payload);
        AppleDeviceKeyStore::new().delete(account).expect("删除条目");
        assert!(read_item(account, false).is_err(), "删除后不应再读到条目");
    }
}

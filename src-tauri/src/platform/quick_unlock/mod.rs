//! 设备级快速解锁的平台接缝：把仓库主密钥交给平台安全存储，并按需触发系统认证。
//!
//! 服务层只依赖 [`DeviceKeyStore`]，因此可以在单测里注入内存实现；
//! 平台能力探测（[`DeviceKeyStore::support`]）必须**无副作用**：不得弹出认证界面。

use std::sync::OnceLock;

use crate::domain::error::AppError;
use crate::domain::quick_unlock::{QuickUnlockKind, QuickUnlockUnsupportedReason};

#[cfg(any(target_os = "macos", target_os = "ios"))]
mod apple;
#[cfg(any(target_os = "macos", target_os = "ios"))]
use apple::AppleDeviceKeyStore as PlatformStore;

#[cfg(target_os = "android")]
mod android;
#[cfg(target_os = "android")]
use android::AndroidDeviceKeyStore as PlatformStore;

#[cfg(not(any(target_os = "macos", target_os = "ios", target_os = "android")))]
mod unsupported;
#[cfg(not(any(target_os = "macos", target_os = "ios", target_os = "android")))]
use unsupported::UnsupportedDeviceKeyStore as PlatformStore;

/// 平台能力探测结果：`supported = false` 时前端完全不渲染入口。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DeviceSupport {
    pub supported: bool,
    pub kind: Option<QuickUnlockKind>,
    /// 不支持时的原因码：能力探测不能只返回一个 false，否则线上表现就是「入口凭空消失」。
    pub reason: Option<QuickUnlockUnsupportedReason>,
}

impl DeviceSupport {
    /// 支持，且本机实际可用的认证方式已确定。
    pub fn available(kind: QuickUnlockKind) -> Self {
        Self {
            supported: true,
            kind: Some(kind),
            reason: None,
        }
    }

    /// 平台 / 设备不具备条件（含 Android < 9、未设置设备密码等）。
    pub fn unavailable(reason: QuickUnlockUnsupportedReason) -> Self {
        Self {
            supported: false,
            kind: None,
            reason: Some(reason),
        }
    }
}

/// 设备安全存储接缝：条目名由服务层给出（仓库路径哈希），载荷是 [`crate::domain::quick_unlock::QuickUnlockPayload`] 的 JSON。
pub trait DeviceKeyStore: Send + Sync {
    /// 能力探测：不得弹出任何认证界面，也不得写入任何状态。
    fn support(&self) -> DeviceSupport;

    /// 写入 / 覆盖条目；失败必须返回错误（不能静默降级为明文）。
    fn store(&self, account: &str, payload: &str) -> Result<(), AppError>;

    /// 读取条目，必要时由平台弹出认证界面；`reason` 是给用户看的认证理由。
    /// 取消返回 [`AppError::VaultDeviceAuthCancelled`]，其它失败返回 [`AppError::VaultDeviceAuthFailed`]。
    fn load(&self, account: &str, reason: &str) -> Result<String, AppError>;

    /// 删除条目；条目不存在视为成功（幂等）。
    fn delete(&self, account: &str) -> Result<(), AppError>;
}

/// 当前平台的设备密钥存储（进程内单例）。
pub fn store() -> &'static dyn DeviceKeyStore {
    static STORE: OnceLock<PlatformStore> = OnceLock::new();
    STORE.get_or_init(PlatformStore::new)
}

/// Android 原生探测协议的解析：`ok:<kind>` / `unsupported:<原因码>`。
/// 协议放在这里（而不是 Android 专属模块），是为了在任意平台都能单测。
#[cfg_attr(not(target_os = "android"), allow(dead_code))]
pub fn parse_probe(raw: &str) -> DeviceSupport {
    match raw.split_once(':') {
        Some(("ok", "biometric")) => DeviceSupport::available(QuickUnlockKind::Biometric),
        Some(("ok", "deviceCredential")) => {
            DeviceSupport::available(QuickUnlockKind::DeviceCredential)
        }
        Some(("unsupported", code)) => DeviceSupport::unavailable(probe_reason(code)),
        // 协议不认识（含旧版本 Kotlin 只回 true/false）一律按探测失败处理，界面会写明原因。
        _ => DeviceSupport::unavailable(QuickUnlockUnsupportedReason::ProbeFailed),
    }
}

#[cfg_attr(not(target_os = "android"), allow(dead_code))]
fn probe_reason(code: &str) -> QuickUnlockUnsupportedReason {
    match code {
        "platformUnsupported" => QuickUnlockUnsupportedReason::PlatformUnsupported,
        "noDeviceLock" => QuickUnlockUnsupportedReason::NoDeviceLock,
        "noBiometric" => QuickUnlockUnsupportedReason::NoBiometric,
        "deviceAuthUnavailable" => QuickUnlockUnsupportedReason::DeviceAuthUnavailable,
        _ => QuickUnlockUnsupportedReason::ProbeFailed,
    }
}

/// Kotlin 侧返回的协议结果（Android 专用，放在这里是为了能在任意平台单测解析逻辑）。
/// Kotlin 约定：`"ok"` / `"ok:<载荷>"` / `"cancel"` / `"stale:<原因>"` / `"fail:<原因>"`。
#[cfg_attr(not(target_os = "android"), allow(dead_code))]
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PlatformOutcome {
    Ok(String),
    Cancelled,
    /// 条目已不可用（生物识别变更、密钥被系统删除）：必须清理并让用户用口令重新开启。
    Stale(String),
    Failed(String),
}

#[cfg_attr(not(target_os = "android"), allow(dead_code))]
impl PlatformOutcome {
    pub fn parse(raw: &str) -> Self {
        let (tag, detail) = match raw.split_once(':') {
            Some((tag, detail)) => (tag, detail.to_string()),
            None => (raw, String::new()),
        };
        match tag {
            "ok" => Self::Ok(detail),
            "cancel" => Self::Cancelled,
            "stale" => Self::Stale(detail),
            _ if detail.is_empty() => Self::Failed(raw.to_string()),
            _ => Self::Failed(detail),
        }
    }

    /// 把协议结果收敛成领域错误；`Ok` 由调用方取值。
    pub fn into_error(self, action: &str) -> AppError {
        match self {
            Self::Cancelled => AppError::VaultDeviceAuthCancelled("已取消设备认证".to_string()),
            Self::Stale(detail) => AppError::VaultQuickUnlockUnavailable(format!(
                "{detail}，请用仓库口令解锁后重新开启设备级快速解锁"
            )),
            Self::Failed(detail) => {
                AppError::VaultDeviceAuthFailed(format!("{action}失败：{detail}，请重试或用仓库口令解锁"))
            }
            Self::Ok(_) => AppError::VaultDeviceAuthFailed(format!("{action}未返回结果")),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn probe_protocol_maps_to_capability_and_reason() {
        let biometric = parse_probe("ok:biometric");
        assert!(biometric.supported);
        assert_eq!(biometric.kind, Some(QuickUnlockKind::Biometric));
        assert!(biometric.reason.is_none());

        let credential = parse_probe("ok:deviceCredential");
        assert!(credential.supported);
        assert_eq!(credential.kind, Some(QuickUnlockKind::DeviceCredential));

        let no_lock = parse_probe("unsupported:noDeviceLock");
        assert!(!no_lock.supported);
        assert_eq!(
            no_lock.reason,
            Some(QuickUnlockUnsupportedReason::NoDeviceLock)
        );

        // 未知 / 损坏的应答不能静默当成「支持」，也不能丢原因。
        for raw in ["", "true", "unsupported:", "unsupported:???", "boom"] {
            let support = parse_probe(raw);
            assert!(!support.supported, "{raw} 不应被当成支持");
            assert_eq!(
                support.reason,
                Some(QuickUnlockUnsupportedReason::ProbeFailed),
                "{raw} 应归为探测失败"
            );
        }
    }

    #[test]
    fn platform_outcome_parses_android_protocol() {
        assert_eq!(PlatformOutcome::parse("ok"), PlatformOutcome::Ok(String::new()));
        assert_eq!(
            PlatformOutcome::parse("ok:{\"version\":1}"),
            PlatformOutcome::Ok("{\"version\":1}".to_string()),
            "载荷中的冒号不参与切分"
        );
        assert_eq!(PlatformOutcome::parse("cancel"), PlatformOutcome::Cancelled);
        assert_eq!(
            PlatformOutcome::parse("stale:密钥已失效"),
            PlatformOutcome::Stale("密钥已失效".to_string())
        );
        assert_eq!(
            PlatformOutcome::parse("fail:no biometrics"),
            PlatformOutcome::Failed("no biometrics".to_string())
        );
        // 未加前缀的异常文本按失败处理，不丢信息。
        assert_eq!(
            PlatformOutcome::parse("boom"),
            PlatformOutcome::Failed("boom".to_string())
        );
    }

    #[test]
    fn platform_outcome_maps_to_domain_errors() {
        assert!(matches!(
            PlatformOutcome::Cancelled.into_error("读取"),
            AppError::VaultDeviceAuthCancelled(_)
        ));
        assert!(matches!(
            PlatformOutcome::Stale("指纹变更".into()).into_error("读取"),
            AppError::VaultQuickUnlockUnavailable(_)
        ));
        assert!(matches!(
            PlatformOutcome::Failed("系统忙".into()).into_error("读取"),
            AppError::VaultDeviceAuthFailed(_)
        ));
    }

    #[test]
    fn support_probe_never_prompts_and_is_stable() {
        // 能力探测必须无副作用：桌面 / 移动真机上都可反复调用（不弹窗、不写盘）。
        let store = store();
        let first = store.support();
        let second = store.support();
        assert_eq!(first, second);
        if first.supported {
            assert!(first.kind.is_some(), "支持时必须给出认证方式");
        } else {
            assert!(first.kind.is_none());
        }
    }

    #[test]
    fn unsupported_platform_reports_unavailable() {
        // Windows / Linux 明确不支持：其它方法必须在触达任何存储前就报错。
        #[cfg(not(any(target_os = "macos", target_os = "ios", target_os = "android")))]
        {
            let store = store();
            assert!(!store.support().supported);
            assert!(matches!(
                store.store("vault-test", "{}"),
                Err(AppError::VaultQuickUnlockUnavailable(_))
            ));
            assert!(matches!(
                store.load("vault-test", "reason"),
                Err(AppError::VaultQuickUnlockUnavailable(_))
            ));
            assert!(store.delete("vault-test").is_ok(), "删除保持幂等");
        }
    }
}

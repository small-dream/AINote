//! 设备级快速解锁（P0）的领域类型：设备条目载荷、能力状态与纯校验。
//! 只描述结构与规则，无 IO、无平台调用（平台实现见 `platform::quick_unlock`）。

use serde::{Deserialize, Serialize};

use crate::domain::error::AppError;

/// 设备条目载荷版本：格式升级后旧条目一律作废，由服务层清理。
pub const QUICK_UNLOCK_PAYLOAD_VERSION: u32 = 1;
/// 设备侧标记文件版本。
pub const QUICK_UNLOCK_MARKER_VERSION: u32 = 1;

/// 设备侧认证方式（前端据此显示 Touch ID / Face ID / 指纹 / 设备密码）。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum QuickUnlockKind {
    TouchId,
    FaceId,
    OpticId,
    Biometric,
    DeviceCredential,
}

/// 平台不支持设备级快速解锁时的**稳定原因码**（前端本地化，便于用户与支持者定位）。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum QuickUnlockUnsupportedReason {
    /// 平台本身不提供：Windows / Linux，或 Android 9 以下
    PlatformUnsupported,
    /// 设备未设置锁屏 / 设备密码
    NoDeviceLock,
    /// 有锁屏但没有可用生物识别，且该平台不能用设备密码兜底（Android 9）
    NoBiometric,
    /// 系统没有可用的设备认证方式（Apple：LAContext 判定）
    DeviceAuthUnavailable,
    /// 能力探测本身失败（平台桥异常，日志里有明细）
    ProbeFailed,
}

/// 平台能力 + 本机开关状态（随 `vault_status` 一起下发）。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuickUnlockStatus {
    /// 平台是否具备设备级认证能力（false 时前端不渲染入口）。
    pub supported: bool,
    /// 本机是否为该仓库开启了快速解锁。
    pub enabled: bool,
    /// 本机使用的认证方式；不支持时为 null。
    pub kind: Option<QuickUnlockKind>,
    /// 不支持时的原因码；支持时为 null。
    pub reason: Option<QuickUnlockUnsupportedReason>,
}

impl QuickUnlockStatus {
    pub fn new(supported: bool, enabled: bool, kind: Option<QuickUnlockKind>) -> Self {
        Self {
            supported,
            enabled,
            kind,
            reason: None,
        }
    }

    /// 平台 / 设备不支持：带上原因码，让「入口消失」变成可解释的状态。
    pub fn unsupported(reason: QuickUnlockUnsupportedReason) -> Self {
        Self {
            supported: false,
            enabled: false,
            kind: None,
            reason: Some(reason),
        }
    }
}

/// 设备安全存储中的条目载荷：主密钥 + 它绑定的仓库密钥指纹。
/// 主密钥以 base64 承载（编解码在服务层，领域层不引入加密依赖）。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuickUnlockPayload {
    pub version: u32,
    pub vault_fingerprint: String,
    pub master: String,
}

impl QuickUnlockPayload {
    pub fn new(vault_fingerprint: String, master: String) -> Self {
        Self {
            version: QUICK_UNLOCK_PAYLOAD_VERSION,
            vault_fingerprint,
            master,
        }
    }

    /// 解析设备条目。任何格式问题都视为「条目已失效」，要求用户用口令重新开启。
    pub fn parse(raw: &str) -> Result<Self, AppError> {
        let payload: Self = serde_json::from_str(raw).map_err(|_| stale("设备条目已损坏"))?;
        if payload.version != QUICK_UNLOCK_PAYLOAD_VERSION {
            return Err(stale("设备条目版本已过期"));
        }
        if payload.master.is_empty() || payload.vault_fingerprint.is_empty() {
            return Err(stale("设备条目缺少必要字段"));
        }
        Ok(payload)
    }

    /// 校验条目绑定的仓库密钥指纹：改口令 / 重建密钥库后必然不一致。
    pub fn validate_for(&self, fingerprint: &str) -> Result<(), AppError> {
        if self.vault_fingerprint != fingerprint {
            return Err(stale("仓库密钥已变更"));
        }
        Ok(())
    }
}

/// 设备侧标记文件：只记录「本机已开启」与指纹，密钥本体在平台安全存储里。
/// 状态查询读它即可，因此**不会触发系统认证弹窗**。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuickUnlockMarker {
    pub version: u32,
    pub vault_fingerprint: String,
    pub kind: QuickUnlockKind,
}

impl QuickUnlockMarker {
    pub fn new(vault_fingerprint: String, kind: QuickUnlockKind) -> Self {
        Self {
            version: QUICK_UNLOCK_MARKER_VERSION,
            vault_fingerprint,
            kind,
        }
    }

    /// 解析标记文件；损坏或版本不符视为「未开启」（下一次开启会覆盖）。
    pub fn parse(raw: &str) -> Option<Self> {
        let marker: Self = serde_json::from_str(raw).ok()?;
        (marker.version == QUICK_UNLOCK_MARKER_VERSION).then_some(marker)
    }
}

fn stale(detail: &str) -> AppError {
    AppError::VaultQuickUnlockUnavailable(format!("{detail}，请用口令解锁后重新开启设备级快速解锁"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn kind_serializes_to_the_frontend_contract() {
        for (kind, expected) in [
            (QuickUnlockKind::TouchId, "touchId"),
            (QuickUnlockKind::FaceId, "faceId"),
            (QuickUnlockKind::OpticId, "opticId"),
            (QuickUnlockKind::Biometric, "biometric"),
            (QuickUnlockKind::DeviceCredential, "deviceCredential"),
        ] {
            assert_eq!(serde_json::to_value(kind).unwrap(), expected);
        }
    }

    #[test]
    fn payload_round_trips_and_rejects_tampering() {
        let payload = QuickUnlockPayload::new("fp-1".into(), "QUJD".into());
        let raw = serde_json::to_string(&payload).unwrap();
        assert_eq!(QuickUnlockPayload::parse(&raw).unwrap(), payload);

        assert!(QuickUnlockPayload::parse("{ not json").is_err());
        let empty = serde_json::json!({ "version": 1, "vaultFingerprint": "fp", "master": "" });
        assert!(QuickUnlockPayload::parse(&empty.to_string()).is_err());
        let old = serde_json::json!({ "version": 99, "vaultFingerprint": "fp", "master": "QUJD" });
        assert!(QuickUnlockPayload::parse(&old.to_string()).is_err());
    }

    #[test]
    fn payload_only_matches_its_own_vault_fingerprint() {
        let payload = QuickUnlockPayload::new("fp-1".into(), "QUJD".into());
        assert!(payload.validate_for("fp-1").is_ok());
        let err = payload.validate_for("fp-2").unwrap_err();
        assert!(matches!(err, AppError::VaultQuickUnlockUnavailable(_)));
        assert!(err.to_string().contains("请用口令解锁"));
    }

    #[test]
    fn marker_parse_ignores_unknown_or_broken_files() {
        let marker = QuickUnlockMarker::new("fp-1".into(), QuickUnlockKind::FaceId);
        let raw = serde_json::to_string(&marker).unwrap();
        assert_eq!(QuickUnlockMarker::parse(&raw).unwrap(), marker);
        assert!(QuickUnlockMarker::parse("{}").is_none());
        assert!(QuickUnlockMarker::parse(r#"{"version":9,"vaultFingerprint":"f","kind":"faceId"}"#).is_none());
    }

    #[test]
    fn status_serializes_camel_case_with_null_kind() {
        let json = serde_json::to_value(QuickUnlockStatus::new(true, false, None)).unwrap();
        assert_eq!(json["supported"], true);
        assert_eq!(json["enabled"], false);
        assert!(json["kind"].is_null(), "kind 恒下发，前端无需处理 undefined");
        assert!(json["reason"].is_null());

        let supported = serde_json::to_value(QuickUnlockStatus::new(true, true, Some(QuickUnlockKind::TouchId))).unwrap();
        assert_eq!(supported["kind"], "touchId");
        let unsupported = serde_json::to_value(QuickUnlockStatus::unsupported(
            QuickUnlockUnsupportedReason::NoDeviceLock,
        ))
        .unwrap();
        assert_eq!(unsupported["supported"], false);
        assert_eq!(unsupported["reason"], "noDeviceLock");
        assert!(unsupported["kind"].is_null());
    }
}

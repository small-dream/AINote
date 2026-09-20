//! Android 设备密钥存储：AndroidKeystore 用户认证密钥 + 系统 BiometricPrompt。
//! 原生实现见 `src-tauri/gen/android/app/src/main/java/dev/ainote/app/QuickUnlock.kt`
//! （能力探测、认证弹窗、密钥生成都在 Kotlin 侧，本文件只做 JNI 编解码与错误映射）。

use jni::objects::{JString, JValue};

use crate::domain::error::AppError;
use crate::domain::quick_unlock::QuickUnlockKind;
use crate::platform::android_jni::with_application_context;
use crate::platform::quick_unlock::{DeviceKeyStore, DeviceSupport, PlatformOutcome};

const QUICK_UNLOCK_CLASS: &str = "dev/ainote/app/QuickUnlock";
const SUPPORT_SIG: &str = "(Landroid/content/Context;)Z";
const KIND_SIG: &str = "(Landroid/content/Context;)Ljava/lang/String;";
const STORE_SIG: &str =
    "(Landroid/content/Context;Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;";
const READ_SIG: &str =
    "(Landroid/content/Context;Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;";
const REMOVE_SIG: &str = "(Landroid/content/Context;Ljava/lang/String;)Ljava/lang/String;";

pub(super) struct AndroidDeviceKeyStore;

impl AndroidDeviceKeyStore {
    pub(super) fn new() -> Self {
        Self
    }
}

impl DeviceKeyStore for AndroidDeviceKeyStore {
    fn support(&self) -> DeviceSupport {
        // 能力探测失败（JNI 不可用、类被混淆裁掉等）一律按「不支持」处理，绝不因此阻断口令解锁；
        // 但必须留下日志，否则线上表现只是「入口凭空消失」，无法定位。
        let supported = match call_bool("isSupported", SUPPORT_SIG, "检查设备级快速解锁可用性") {
            Ok(value) => value,
            Err(err) => {
                log::warn!(target: "ainote::vault", "设备快速解锁能力探测失败，按不支持处理: {err}");
                false
            }
        };
        if !supported {
            return DeviceSupport::unavailable();
        }
        let kind = match call_text("kind", KIND_SIG, "读取设备认证方式", &[]) {
            Ok(value) if value == "deviceCredential" => QuickUnlockKind::DeviceCredential,
            _ => QuickUnlockKind::Biometric,
        };
        DeviceSupport::available(kind)
    }

    fn store(&self, account: &str, payload: &str) -> Result<(), AppError> {
        let raw = call_text("store", STORE_SIG, "开启设备级快速解锁", &[account, payload])?;
        match PlatformOutcome::parse(&raw) {
            PlatformOutcome::Ok(_) => Ok(()),
            other => Err(other.into_error("开启设备级快速解锁")),
        }
    }

    fn load(&self, account: &str, reason: &str) -> Result<String, AppError> {
        let raw = call_text("read", READ_SIG, "设备认证", &[account, reason])?;
        match PlatformOutcome::parse(&raw) {
            PlatformOutcome::Ok(payload) if payload.is_empty() => Err(AppError::VaultQuickUnlockUnavailable(
                "设备上没有可用的快速解锁条目，请用仓库口令解锁后重新开启".to_string(),
            )),
            PlatformOutcome::Ok(payload) => Ok(payload),
            other => Err(other.into_error("设备认证")),
        }
    }

    fn delete(&self, account: &str) -> Result<(), AppError> {
        // 关闭动作必须能做到底：即使底层报错，服务层也会清掉标记，条目从此不再被使用。
        call_text("remove", REMOVE_SIG, "关闭设备级快速解锁", &[account]).map(|_| ())
    }
}

fn call_bool(method: &str, signature: &str, action: &str) -> Result<bool, AppError> {
    with_application_context(action, &AppError::VaultQuickUnlockUnavailable, |env, context| {
        env.call_static_method(QUICK_UNLOCK_CLASS, method, signature, &[JValue::Object(context)])
            .and_then(|value| value.z())
            .map_err(|err| AppError::VaultQuickUnlockUnavailable(format!("{action}: {err}")))
    })
}

fn call_text(method: &str, signature: &str, action: &str, strings: &[&str]) -> Result<String, AppError> {
    with_application_context(action, &AppError::VaultQuickUnlockUnavailable, |env, context| {
        let mut args: Vec<JValue> = Vec::with_capacity(strings.len() + 1);
        args.push(JValue::Object(context));
        let owned: Vec<JString> = strings
            .iter()
            .map(|value| {
                env.new_string(value)
                    .map_err(|err| AppError::VaultQuickUnlockUnavailable(format!("{action}: {err}")))
            })
            .collect::<Result<_, _>>()?;
        args.extend(owned.iter().map(|value| JValue::Object(value)));
        let value = env
            .call_static_method(QUICK_UNLOCK_CLASS, method, signature, &args)
            .map_err(|err| AppError::VaultQuickUnlockUnavailable(format!("{action}: {err}")))?;
        let text = JString::from(
            value
                .l()
                .map_err(|err| AppError::VaultQuickUnlockUnavailable(format!("{action}: {err}")))?,
        );
        env.get_string(&text)
            .map(|value| value.into())
            .map_err(|err| AppError::VaultQuickUnlockUnavailable(format!("{action}: {err}")))
    })
}

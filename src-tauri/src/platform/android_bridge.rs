//! Android 原生桥：经 ndk-context + JNI 调用 Kotlin `dev.ainote.app.ApkInstaller`
//! （应用内更新安装、外部链接打开、未知来源安装权限）。
//! ndk-context 由 MainActivity 在启动时经 `Keyring.initializeNdkContext` 初始化，进程内全局有效。

use jni::objects::JValue;

use crate::domain::error::AppError;
use crate::platform::android_jni::with_application_context;

const INSTALLER_CLASS: &str = "dev/ainote/app/ApkInstaller";

/// 是否已具备「安装未知来源应用」权限。
pub fn can_request_installs() -> Result<bool, AppError> {
    with_application_context("检查安装权限", &AppError::UpdateInstall, |env, context| {
        env.call_static_method(
            INSTALLER_CLASS,
            "canRequestInstalls",
            "(Landroid/content/Context;)Z",
            &[JValue::Object(context)],
        )
        .and_then(|value| value.z())
        .map_err(|err| AppError::UpdateInstall(format!("检查安装权限: {err}")))
    })
}

/// 打开系统「允许安装未知应用」设置页（针对本应用）。
pub fn open_install_settings() -> Result<(), AppError> {
    with_application_context("打开安装权限设置", &AppError::UpdateInstall, |env, context| {
        env.call_static_method(
            INSTALLER_CLASS,
            "openInstallPermissionSettings",
            "(Landroid/content/Context;)V",
            &[JValue::Object(context)],
        )
        .map(|_| ())
        .map_err(|err| AppError::UpdateInstall(format!("打开安装权限设置: {err}")))
    })
}

/// 调起系统安装器安装指定 APK（系统会弹确认框，由用户完成安装）。
pub fn install_apk(path: &str) -> Result<(), AppError> {
    with_application_context("调起安装器", &AppError::UpdateInstall, |env, context| {
        let jpath = env
            .new_string(path)
            .map_err(|err| AppError::UpdateInstall(format!("调起安装器: {err}")))?;
        env.call_static_method(
            INSTALLER_CLASS,
            "installApk",
            "(Landroid/content/Context;Ljava/lang/String;)V",
            &[JValue::Object(context), JValue::Object(&jpath)],
        )
        .map(|_| ())
        .map_err(|err| AppError::UpdateInstall(format!("调起安装器: {err}")))
    })
}

/// 用系统浏览器打开外部链接（opener 不支持 Android，见 commands/app.rs）。
pub fn open_url(url: &str) -> Result<(), AppError> {
    with_application_context("打开外部链接", &AppError::UpdateInstall, |env, context| {
        let jurl = env
            .new_string(url)
            .map_err(|err| AppError::UpdateInstall(format!("打开外部链接: {err}")))?;
        env.call_static_method(
            INSTALLER_CLASS,
            "openUrl",
            "(Landroid/content/Context;Ljava/lang/String;)V",
            &[JValue::Object(context), JValue::Object(&jurl)],
        )
        .map(|_| ())
        .map_err(|err| AppError::UpdateInstall(format!("打开外部链接: {err}")))
    })
}

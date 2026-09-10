//! Android 原生桥：经 ndk-context + JNI 调用 Kotlin `dev.ainote.app.ApkInstaller`。
//! ndk-context 由 MainActivity 在启动时经 `Keyring.initializeNdkContext` 初始化，进程内全局有效。

use jni::objects::{JObject, JValue};
use jni::{JNIEnv, JavaVM};

use crate::domain::error::AppError;

const INSTALLER_CLASS: &str = "dev/ainote/app/ApkInstaller";

fn with_jni<T>(
    action: &str,
    f: impl FnOnce(&mut JNIEnv, &JObject) -> Result<T, AppError>,
) -> Result<T, AppError> {
    let context = ndk_context::android_context();
    // SAFETY: VM 与 Context 指针由应用启动时的 NDK 初始化保证有效且进程级常驻；
    // jni 0.21 的 JavaVM 仅为指针包装，Drop 不会销毁共享 VM。
    let vm = unsafe { JavaVM::from_raw(context.vm().cast::<jni::sys::JavaVM>()) }
        .map_err(|err| AppError::UpdateInstall(format!("{action}: JVM 不可用: {err}")))?;
    let mut guard = vm
        .attach_current_thread()
        .map_err(|err| AppError::UpdateInstall(format!("{action}: 线程附着失败: {err}")))?;
    // SAFETY: 同上，context 为应用 Application Context 的全局引用（jobject 本身即指针）。
    let app_context = unsafe { JObject::from_raw(context.context() as jni::sys::jobject) };
    let result = f(&mut guard, &app_context)?;
    check_exception(&mut guard, action)?;
    Ok(result)
}

fn check_exception(env: &mut JNIEnv, action: &str) -> Result<(), AppError> {
    if env.exception_check().unwrap_or(false) {
        let _ = env.exception_describe();
        let _ = env.exception_clear();
        return Err(AppError::UpdateInstall(format!("{action}: Kotlin 侧抛出异常")));
    }
    Ok(())
}

/// 是否已具备「安装未知来源应用」权限。
pub fn can_request_installs() -> Result<bool, AppError> {
    with_jni("检查安装权限", |env, context| {
        let value = env.call_static_method(
            INSTALLER_CLASS,
            "canRequestInstalls",
            "(Landroid/content/Context;)Z",
            &[JValue::Object(context)],
        );
        value
            .and_then(|v| v.z())
            .map_err(|err| AppError::UpdateInstall(format!("检查安装权限: {err}")))
    })
}

/// 打开系统「允许安装未知应用」设置页（针对本应用）。
pub fn open_install_settings() -> Result<(), AppError> {
    with_jni("打开安装权限设置", |env, context| {
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
    with_jni("调起安装器", |env, context| {
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
    with_jni("打开外部链接", |env, context| {
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

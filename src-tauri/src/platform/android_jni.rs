//! Android JNI 桥的公共部分：附着线程、取 Application Context、清理 Java 异常。
//! 由 `android_bridge`（安装器 / 外部链接）与 `quick_unlock`（设备认证）共用。

use jni::objects::{JClass, JObject, JValue};
use jni::{JNIEnv, JavaVM};

use crate::domain::error::AppError;

/// 解析应用内类（JNI 名 `dev/ainote/app/QuickUnlock`）为 `jclass`。
///
/// **不能直接用类名调 `call_static_method`**：JNI 在 attach 上来的原生线程里用系统 ClassLoader
/// 查找类，看不到应用自己的类。实测（Pixel 7 / Android 16）报：
/// `ClassNotFoundException: Didn't find class "dev.ainote.app.QuickUnlock"`。
/// 正确做法是经 Application Context 的 `ClassLoader.loadClass()` 加载。
pub(super) fn app_class<'local>(
    env: &mut JNIEnv<'local>,
    context: &JObject,
    class: &str,
    action: &str,
    error: &dyn Fn(String) -> AppError,
) -> Result<JClass<'local>, AppError> {
    let loader = env
        .call_method(context, "getClassLoader", "()Ljava/lang/ClassLoader;", &[])
        .and_then(|value| value.l())
        .map_err(|err| error(format!("{action}: 取应用 ClassLoader 失败: {err}")))?;
    let name = env
        .new_string(class.replace('/', "."))
        .map_err(|err| error(format!("{action}: 构造类名失败: {err}")))?;
    let loaded = env
        .call_method(
            &loader,
            "loadClass",
            "(Ljava/lang/String;)Ljava/lang/Class;",
            &[JValue::Object(&name)],
        )
        .and_then(|value| value.l())
        .map_err(|err| error(format!("{action}: 加载类 {class} 失败: {err}")))?;
    Ok(JClass::from(loaded))
}

/// 在 JNI 线程上执行一次 Kotlin 静态方法调用。
/// `error` 负责把桥接层失败信息包装成对应能力域的领域错误（错误码按域区分）。
pub(super) fn with_application_context<T>(
    action: &str,
    error: &dyn Fn(String) -> AppError,
    f: impl FnOnce(&mut JNIEnv, &JObject) -> Result<T, AppError>,
) -> Result<T, AppError> {
    let context = ndk_context::android_context();
    // SAFETY: VM 与 Context 指针由应用启动时的 NDK 初始化保证有效且进程级常驻；
    // jni 0.21 的 JavaVM 仅为指针包装，Drop 不会销毁共享 VM。
    let vm = unsafe { JavaVM::from_raw(context.vm().cast::<jni::sys::JavaVM>()) }
        .map_err(|err| error(format!("{action}: JVM 不可用: {err}")))?;
    let mut guard = vm
        .attach_current_thread()
        .map_err(|err| error(format!("{action}: 线程附着失败: {err}")))?;
    // SAFETY: 同上，context 为应用 Application Context 的全局引用（jobject 本身即指针）。
    let app_context = unsafe { JObject::from_raw(context.context() as jni::sys::jobject) };
    let result = f(&mut guard, &app_context);
    // f 提前返回错误时同样检查并清理未捕获的 Java 异常，
    // 否则挂起的异常会泄漏到本线程后续任意 JNI 调用。
    let check = check_exception(&mut guard, action, error);
    match (result, check) {
        (Ok(value), Ok(())) => Ok(value),
        (Err(err), _) => Err(err),
        (Ok(_), Err(err)) => Err(err),
    }
}

fn check_exception(
    env: &mut JNIEnv,
    action: &str,
    error: &dyn Fn(String) -> AppError,
) -> Result<(), AppError> {
    if env.exception_check().unwrap_or(false) {
        let _ = env.exception_describe();
        let _ = env.exception_clear();
        return Err(error(format!("{action}: Kotlin 侧抛出异常")));
    }
    Ok(())
}

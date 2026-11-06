//! 平台差异收敛点：
//! - Android 原生能力（安装 APK、打开外部链接）经 JNI 桥接 Kotlin 实现；
//! - 桌面托盘与窗口生命周期（关闭即隐藏到托盘、真正退出前的守卫）见 `tray`。

#[cfg(target_os = "android")]
mod android_bridge;
#[cfg(target_os = "android")]
pub use android_bridge::*;

#[cfg(target_os = "android")]
mod android_jni;

/// 启动期 panic 可观测性：`.so` 加载时安装 hook，把 panic 文案直接写进 logcat 与 tombstone。
/// 非 Android 平台也会编译（纯格式化 / 切块逻辑的单测在这里跑），但只在 Android 上安装。
#[cfg_attr(not(target_os = "android"), allow(dead_code))]
pub(crate) mod android_panic;

#[cfg(not(target_os = "android"))]
mod fallback;
#[cfg(not(target_os = "android"))]
pub use fallback::*;

/// 设备级快速解锁的平台接缝（macOS / iOS / Android，其余平台明确不支持）。
pub mod quick_unlock;

#[cfg(desktop)]
pub mod tray;

#[cfg(desktop)]
pub mod capture_shortcut;

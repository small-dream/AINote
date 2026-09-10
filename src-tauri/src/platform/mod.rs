//! 平台差异收敛点：Android 原生能力（安装 APK、打开外部链接）经 JNI 桥接 Kotlin 实现。

#[cfg(target_os = "android")]
mod android_bridge;
#[cfg(target_os = "android")]
pub use android_bridge::*;

#[cfg(not(target_os = "android"))]
mod fallback;
#[cfg(not(target_os = "android"))]
pub use fallback::*;

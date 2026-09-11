# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Rust 侧经 JNI 按字符串类名/方法名调用（platform/android_bridge.rs、keyring crate），
# R8 看不到这些引用，release 混淆时必须完整保留，否则调用安装器/钥匙串会抛 NoSuchMethodError。
-keep class dev.ainote.app.ApkInstaller { *; }
-keep class io.crates.keyring.Keyring { *; }

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile
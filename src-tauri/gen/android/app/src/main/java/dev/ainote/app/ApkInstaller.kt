package dev.ainote.app

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import java.io.File

/**
 * 应用内更新的系统桥：安装 APK、安装权限检查/跳转、打开外部链接。
 * 由 Rust 侧 platform/android_bridge.rs 经 JNI 调用（@JvmStatic 签名不可改动）。
 */
object ApkInstaller {

    /** 安装未知来源权限是 Android 8.0（API 26）引入的；更早版本无此概念，直接视为已授权。 */
    @JvmStatic
    fun canRequestInstalls(context: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.O ||
            context.packageManager.canRequestPackageInstalls()

    /** 打开系统「允许安装未知应用」设置页（仅针对本应用）。 */
    @JvmStatic
    fun openInstallPermissionSettings(context: Context) {
        val intent = Intent(
            Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
            Uri.parse("package:${context.packageName}"),
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }

    /** 调起系统安装器；安装确认由系统弹窗完成，应用无法也无需代办。 */
    @JvmStatic
    fun installApk(context: Context, apkPath: String) {
        val uri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            File(apkPath),
        )
        val intent = Intent(Intent.ACTION_VIEW)
            .setDataAndType(uri, "application/vnd.android.package-archive")
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }

    /** 用系统浏览器打开外部链接（Rust opener crate 无 Android 实现）。 */
    @JvmStatic
    fun openUrl(context: Context, url: String) {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }
}

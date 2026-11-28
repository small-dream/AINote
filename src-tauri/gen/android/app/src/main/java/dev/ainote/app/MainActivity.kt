package dev.ainote.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // ndk-context 只能初始化一次（initialize_android_context 内部是 assert!(previous.is_none())）：
    // Tauri 2.12 起 tao 在 Rust::onCreate 里用 applicationContext 初始化，这里再调一次会 panic 后
    // SIGABRT，表现为「一打开就闪退」（v0.59.0–v0.60.0）。tao 传的是同一个 Application Context，
    // credentials / ApkInstaller 等 JNI 桥接照常可用。
    // 设备级快速解锁的认证弹窗需要一个前台 Activity，所以这里保留 attach。
    QuickUnlock.attach(this)
    // 语音输入的运行时麦克风权限弹窗同样需要前台 Activity。
    VoiceInput.attach(this)
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    ShareIntake.accept(this, intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    ShareIntake.accept(this, intent)
  }

  override fun onRequestPermissionsResult(
    requestCode: Int,
    permissions: Array<out String>,
    grantResults: IntArray,
  ) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults)
    if (requestCode == VoiceInput.PERMISSION_REQUEST_CODE) {
      VoiceInput.onPermissionResult(permissions, grantResults)
    }
  }

  override fun onStop() {
    VoiceInput.onHostBackgrounded()
    super.onStop()
  }

  override fun onDestroy() {
    QuickUnlock.detach(this)
    VoiceInput.detach(this)
    super.onDestroy()
  }
}

package dev.ainote.app

import android.os.Bundle
import androidx.activity.enableEdgeToEdge
import io.crates.keyring.Keyring

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    Keyring.initializeNdkContext(applicationContext)
    // 设备级快速解锁的认证弹窗需要一个前台 Activity（Keyring 的 ndk-context 只带 Application）。
    QuickUnlock.attach(this)
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  override fun onDestroy() {
    QuickUnlock.detach(this)
    super.onDestroy()
  }
}

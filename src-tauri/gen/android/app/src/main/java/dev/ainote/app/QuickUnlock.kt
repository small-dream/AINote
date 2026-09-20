package dev.ainote.app

import android.app.Activity
import android.app.KeyguardManager
import android.content.Context
import android.hardware.biometrics.BiometricManager
import android.hardware.biometrics.BiometricPrompt
import android.hardware.fingerprint.FingerprintManager
import android.os.Build
import android.os.CancellationSignal
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * 设备级快速解锁的 Android 原生实现，由 Rust `platform/quick_unlock/android.rs` 经 JNI 调用。
 *
 * 主密钥载荷（`QuickUnlockPayload` 的 JSON）用 AndroidKeystore 里的 AES 密钥加密后写入应用私有
 * SharedPreferences：密钥要求用户认证（`setUserAuthenticationRequired`，认证窗口 30 秒），
 * 并在新增生物识别时自动失效（`setInvalidatedByBiometricEnrollment`）。密钥材料不出 TEE。
 *
 * 返回值约定（禁止把异常抛给 JNI，未捕获的 Java 异常会污染后续所有 JNI 调用）：
 * `"ok"` / `"ok:<载荷>"` / `"cancel"` / `"stale:<原因>"` / `"fail:<原因>"`。
 * `stale` 表示条目已不可用（生物识别变更、密钥被系统删除），Rust 侧会清理并提示重新用口令开启。
 */
object QuickUnlock {
    private const val KEYSTORE = "AndroidKeyStore"
    private const val PREFS = "ainote_quick_unlock"
    private const val ALIAS_PREFIX = "ainote_quick_unlock_"
    private const val TRANSFORMATION = "AES/GCM/NoPadding"
    private const val GCM_TAG_BITS = 128
    private const val AUTH_WINDOW_SECONDS = 30
    private const val AUTH_TIMEOUT_SECONDS = 120L

    /** Android 9（API 28）起才有平台 BiometricPrompt。 */
    private const val MIN_SDK = Build.VERSION_CODES.P

    @Volatile
    private var current: Activity? = null

    /** MainActivity 在 onCreate / onDestroy 里登记与解绑，供认证弹窗使用。 */
    fun attach(activity: Activity) {
        current = activity
    }

    fun detach(activity: Activity) {
        if (current === activity) current = null
    }

    /** 能力探测：不弹窗、不写盘，只查系统条件。 */
    fun isSupported(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < MIN_SDK) return false
        val keyguard = context.getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager ?: return false
        if (!keyguard.isDeviceSecure) return false
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val manager = context.getSystemService(BiometricManager::class.java) ?: return false
            val allowed = BiometricManager.Authenticators.BIOMETRIC_STRONG or
                BiometricManager.Authenticators.DEVICE_CREDENTIAL
            return manager.canAuthenticate(allowed) == BiometricManager.BIOMETRIC_SUCCESS
        }
        // Android 9：只有指纹提示可用，且密钥不接受设备凭证，因此必须有已录入的指纹。
        @Suppress("DEPRECATION")
        val fingerprint = context.getSystemService(FingerprintManager::class.java) ?: return false
        @Suppress("DEPRECATION")
        return fingerprint.hasEnrolledFingerprints()
    }

    /** 本机实际可用的认证方式：生物识别，或仅有设备凭证（PIN / 图案 / 密码）。 */
    fun kind(context: Context): String {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val manager = context.getSystemService(BiometricManager::class.java)
            if (manager != null &&
                manager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG) ==
                BiometricManager.BIOMETRIC_SUCCESS
            ) {
                return "biometric"
            }
            return "deviceCredential"
        }
        return "biometric"
    }

    /** 开启（或重新开启）：先生成新密钥，再要求一次系统认证，最后写入口令载荷。 */
    fun store(context: Context, account: String, payload: String): String = runCatching {
        val key = generateKey(account)
        val authenticated = authenticate(context, "开启加密笔记的设备级快速解锁")
        if (authenticated != "ok") return authenticated
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, key)
        val encrypted = cipher.doFinal(payload.toByteArray(Charsets.UTF_8))
        val record = encode(cipher.iv) + ":" + encode(encrypted)
        prefs(context).edit().putString(account, record).commit()
        "ok"
    }.getOrElse { describe(it) }

    /** 读取载荷：认证通过后解密条目。 */
    fun read(context: Context, account: String, reason: String): String = runCatching {
        val record = prefs(context).getString(account, null)
            ?: return "stale:本机未保存快速解锁条目"
        val parts = record.split(":")
        if (parts.size != 2) return "stale:快速解锁条目已损坏"
        val iv = decode(parts[0])
        val encrypted = decode(parts[1])
        val key = existingKey(account) ?: return "stale:快速解锁密钥已失效"
        val authenticated = authenticate(context, reason)
        if (authenticated != "ok") return authenticated
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(GCM_TAG_BITS, iv))
        "ok:" + String(cipher.doFinal(encrypted), Charsets.UTF_8)
    }.getOrElse { describe(it) }

    /** 关闭：删除条目与密钥（幂等）。 */
    fun remove(context: Context, account: String): String = runCatching {
        prefs(context).edit().remove(account).commit()
        val store = keyStore()
        if (store.containsAlias(alias(account))) store.deleteEntry(alias(account))
        "ok"
    }.getOrElse { describe(it) }

    /** 展示系统认证并等待结果；返回 `"ok"` / `"cancel"` / `"fail:<原因>"`。 */
    private fun authenticate(context: Context, reason: String): String {
        val activity = current ?: return "fail:应用界面不可用，请重试"
        val latch = CountDownLatch(1)
        // 写入发生在 latch.countDown() 之前，等待方在 await() 之后可见（CountDownLatch 自带 happens-before）。
        var outcome = "fail:认证未完成"
        activity.runOnUiThread {
            try {
                val callback = object : BiometricPrompt.AuthenticationCallback() {
                    override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                        outcome = "ok"
                        latch.countDown()
                    }

                    override fun onAuthenticationError(code: Int, message: CharSequence) {
                        outcome = when (code) {
                            // 平台把「取消」按钮也归到 USER_CANCELED（androidx 才另有 NEGATIVE_BUTTON）。
                            BiometricPrompt.BIOMETRIC_ERROR_USER_CANCELED,
                            BiometricPrompt.BIOMETRIC_ERROR_CANCELED -> "cancel"
                            BiometricPrompt.BIOMETRIC_ERROR_LOCKOUT,
                            BiometricPrompt.BIOMETRIC_ERROR_LOCKOUT_PERMANENT ->
                                "fail:生物识别已被系统锁定，请用设备密码解锁系统后重试"
                            BiometricPrompt.BIOMETRIC_ERROR_NO_BIOMETRICS ->
                                "fail:本机尚未录入生物识别"
                            else -> "fail:" + message
                        }
                        latch.countDown()
                    }

                    // 单次识别失败：保持弹窗，交给系统重试，不结束等待。
                    override fun onAuthenticationFailed() = Unit
                }
                val executor = activity.mainExecutor
                val builder = BiometricPrompt.Builder(activity)
                    .setTitle("解锁加密笔记")
                    .setSubtitle(reason)
                when {
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.R -> builder.setAllowedAuthenticators(
                        BiometricManager.Authenticators.BIOMETRIC_STRONG or
                            BiometricManager.Authenticators.DEVICE_CREDENTIAL
                    )
                    Build.VERSION.SDK_INT == Build.VERSION_CODES.Q ->
                        @Suppress("DEPRECATION") builder.setDeviceCredentialAllowed(true)
                    else -> @Suppress("DEPRECATION") builder.setNegativeButton(
                        "取消",
                        executor
                    ) { _, _ ->
                        outcome = "cancel"
                        latch.countDown()
                    }
                }
                builder.build().authenticate(CancellationSignal(), executor, callback)
            } catch (error: Exception) {
                outcome = describe(error)
                latch.countDown()
            }
        }
        if (!latch.await(AUTH_TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
            return "fail:设备认证超时，请重试或用仓库口令解锁"
        }
        return outcome
    }

    private fun generateKey(account: String): SecretKey {
        val store = keyStore()
        if (store.containsAlias(alias(account))) store.deleteEntry(alias(account))
        val builder = KeyGenParameterSpec.Builder(
            alias(account),
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setUserAuthenticationRequired(true)
            .setInvalidatedByBiometricEnrollment(true)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            @Suppress("DEPRECATION")
            builder.setUserAuthenticationValidityDurationSeconds(AUTH_WINDOW_SECONDS)
        }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE)
        generator.init(builder.build())
        return generator.generateKey()
    }

    private fun existingKey(account: String): SecretKey? = runCatching {
        val store = keyStore()
        if (!store.containsAlias(alias(account))) return null
        store.getKey(alias(account), null) as? SecretKey
    }.getOrNull()

    private fun keyStore(): KeyStore = KeyStore.getInstance(KEYSTORE).apply { load(null) }

    private fun prefs(context: Context) =
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private fun alias(account: String) = ALIAS_PREFIX + account

    private fun encode(bytes: ByteArray) = Base64.encodeToString(bytes, Base64.NO_WRAP)

    private fun decode(text: String) = Base64.decode(text, Base64.NO_WRAP)

    /** 把异常翻译成协议字符串：密钥失效单独归为 `stale`，避免用户被卡在「重试」死循环里。 */
    private fun describe(error: Throwable): String {
        val name = error.javaClass.simpleName
        val message = error.message ?: name
        return if (name.contains("Invalidated") || name.contains("UserNotAuthenticated")) {
            "stale:快速解锁密钥已失效（生物识别变更或认证窗口过期）"
        } else {
            "fail:$message"
        }
    }
}

package dev.ainote.app

import android.app.KeyguardManager
import android.content.Context
import android.hardware.biometrics.BiometricManager
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.shadow.api.Shadow
import org.robolectric.shadows.ShadowBiometricManager
import org.robolectric.Shadows.shadowOf

/** 在最低支持的 Android 12 上区分设备锁、设备凭证与强生物识别能力。 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [31])
class QuickUnlockTest {
    private val context: Context get() = RuntimeEnvironment.getApplication()

    @Before
    fun configureDevice() {
        val keyguard = context.getSystemService(KeyguardManager::class.java)
        shadowOf(keyguard).setIsDeviceSecure(true)
        val biometric = Shadow.extract<ShadowBiometricManager>(
            context.getSystemService(BiometricManager::class.java)
        )
        biometric.setCanAuthenticate(false)
        biometric.setAuthenticatorType(0)
    }

    @Test
    fun requiresDeviceLock() {
        val keyguard = context.getSystemService(KeyguardManager::class.java)
        shadowOf(keyguard).setIsDeviceSecure(false)
        assertEquals("unsupported:noDeviceLock", QuickUnlock.probe(context))
    }

    @Test
    fun supportsDeviceCredentialWithoutBiometrics() {
        assertEquals("ok:deviceCredential", QuickUnlock.probe(context))
    }

    @Test
    fun supportsStrongBiometrics() {
        val biometric = Shadow.extract<ShadowBiometricManager>(
            context.getSystemService(BiometricManager::class.java)
        )
        biometric.setAuthenticatorType(BiometricManager.Authenticators.BIOMETRIC_STRONG)
        biometric.setCanAuthenticate(true)
        assertEquals("ok:biometric", QuickUnlock.probe(context))
    }
}

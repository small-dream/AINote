package dev.ainote.app

import android.app.Activity
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.speech.RecognitionService
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import java.util.ArrayDeque
import java.util.Locale
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

/**
 * Android voice-input bridge used by Rust through JNI.
 *
 * SpeechRecognizer creation and calls stay on the Android main thread. Native events carry the
 * session id so Rust can discard callbacks from a cancelled or replaced session.
 */
object VoiceInput {
    const val PERMISSION_REQUEST_CODE = 41021
    private const val EVENT_SEPARATOR = "\u001E"
    private const val FIELD_SEPARATOR = "\u001F"
    private const val MAIN_CALL_TIMEOUT_MS = 5_000L
    private const val STOP_WAIT_MS = 1_500L
    private const val VOICE_RECOGNITION_SERVICE = "voice_recognition_service"

    @Volatile
    private var current: Activity? = null

    private val lock = Any()
    private val events = ArrayDeque<String>()
    private val mainHandler = Handler(Looper.getMainLooper())
    private var activeSessionId: String? = null
    private var pendingStart: PendingStart? = null
    private var activeSession: VoiceInputSession? = null

    private data class PendingStart(
        val sessionId: String,
        val locale: String,
        val onDevice: Boolean,
    )

    fun attach(activity: Activity) {
        current = activity
    }

    fun detach(activity: Activity) {
        if (current === activity) current = null
    }

    /** Foreground-only ASR: stop the active native session when Android backgrounds the activity. */
    fun onHostBackgrounded() {
        val context = current?.applicationContext ?: return
        val sessionId = synchronized(lock) { activeSessionId } ?: return
        Thread({ stop(context, sessionId) }, "ainote-voice-background-stop").start()
    }

    /** Capability probe: no permission prompt and no recognition session. */
    @JvmStatic
    fun probe(context: Context): String = runCatching {
        when {
            SpeechRecognizer.isOnDeviceRecognitionAvailable(context) -> "ok:onDevice"
            selectedRecognitionService(context) != null -> "ok:network"
            else -> "unsupported:noService"
        }
    }.getOrElse { "unsupported:probeFailed" }

    /** Start one session. `onDevice=true` never falls back to the network recognizer. */
    @JvmStatic
    fun start(context: Context, sessionId: String, locale: String, onDevice: Boolean): String =
        runCatching {
            onMain {
                beginSession(context.applicationContext, sessionId, locale, onDevice)
            }
        }.getOrElse { "fail:startError" }

    /** Stop gracefully and wait briefly for the final result before releasing the recognizer. */
    @JvmStatic
    fun stop(context: Context, sessionId: String): String = runCatching {
        val session = synchronized(lock) {
            if (activeSessionId != sessionId) return@synchronized null
            pendingStart = null
            activeSession.also { activeSession = null }
        }
        if (session == null) {
            emit(sessionId, "stopped")
        } else {
            onMain { session.requestStop() }
            if (!session.awaitFinished(STOP_WAIT_MS)) onMain { session.forceStop() }
        }
        synchronized(lock) {
            if (activeSessionId == sessionId) activeSessionId = null
        }
        "ok"
    }.getOrElse { "fail:stopError" }

    /** Drain queued events for Rust. Events from other sessions remain present for their parser to ignore. */
    @JvmStatic
    fun poll(@Suppress("unused") context: Context): String = synchronized(lock) {
        val drained = events.joinToString(EVENT_SEPARATOR)
        events.clear()
        drained
    }

    fun onPermissionResult(permissions: Array<out String>, grantResults: IntArray) {
        if (permissions.firstOrNull() != android.Manifest.permission.RECORD_AUDIO) return
        val pending = synchronized(lock) { pendingStart.also { pendingStart = null } } ?: return
        if (synchronized(lock) { activeSessionId } != pending.sessionId) return
        val granted = grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED
        if (!granted) {
            emit(pending.sessionId, "permission", "denied")
            emit(pending.sessionId, "stopped")
            clearActive(pending.sessionId)
            return
        }
        val activity = current ?: run {
            emit(pending.sessionId, "error", "service", "")
            emit(pending.sessionId, "stopped")
            clearActive(pending.sessionId)
            return
        }
        startRecognition(activity.applicationContext, pending)
    }

    private fun beginSession(context: Context, sessionId: String, locale: String, onDevice: Boolean): String {
        synchronized(lock) {
            if (activeSessionId != null) return "fail:busy"
            activeSessionId = sessionId
            events.clear()
        }
        if (!onDevice && selectedRecognitionService(context) == null) {
            clearActive(sessionId)
            return "fail:noService"
        }
        if (onDevice && !SpeechRecognizer.isOnDeviceRecognitionAvailable(context)) {
            clearActive(sessionId)
            return "fail:onDeviceUnavailable"
        }
        if (context.checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            val activity = current ?: run {
                clearActive(sessionId)
                return "fail:uiUnavailable"
            }
            synchronized(lock) { pendingStart = PendingStart(sessionId, locale, onDevice) }
            activity.requestPermissions(
                arrayOf(android.Manifest.permission.RECORD_AUDIO),
                PERMISSION_REQUEST_CODE,
            )
            return "pending:permission"
        }
        return startRecognition(context, PendingStart(sessionId, locale, onDevice))
    }

    private fun startRecognition(context: Context, pending: PendingStart): String {
        val recognizer = runCatching {
            when {
                !pending.onDevice -> {
                    val service = selectedRecognitionService(context)
                        ?: return failStart(pending.sessionId, "noService")
                    SpeechRecognizer.createSpeechRecognizer(context, service)
                }
                SpeechRecognizer.isOnDeviceRecognitionAvailable(context) ->
                    SpeechRecognizer.createOnDeviceSpeechRecognizer(context)
                else -> return failStart(pending.sessionId, "onDeviceUnavailable")
            }
        }.getOrElse {
            return failStart(pending.sessionId, "serviceError")
        }
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, pending.locale.ifEmpty { Locale.getDefault().toLanguageTag() })
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
        }
        val session = VoiceInputSession(pending.sessionId, recognizer, intent, ::emit)
        synchronized(lock) { activeSession = session }
        return runCatching {
            session.start()
            "ok"
        }.getOrElse {
            session.forceStop()
            "fail:startError"
        }
    }

    /**
     * Android keeps the user-selected network recognizer in Secure settings. Merely finding a
     * RecognitionService package is insufficient: without this setting SpeechRecognizer reports
     * "no selected voice recognition service" and never starts a usable session.
     */
    private fun selectedRecognitionService(context: Context): ComponentName? {
        val raw = Settings.Secure.getString(context.contentResolver, VOICE_RECOGNITION_SERVICE)
            ?.trim()
            .orEmpty()
        if (raw.isEmpty()) return null
        val selected = ComponentName.unflattenFromString(raw) ?: return null
        val expectedClass = if (selected.className.startsWith(".")) {
            selected.packageName + selected.className
        } else {
            selected.className
        }
        val available = context.packageManager
            .queryIntentServices(Intent(RecognitionService.SERVICE_INTERFACE), 0)
            .any { info ->
                info.serviceInfo.packageName == selected.packageName &&
                    info.serviceInfo.name == expectedClass
            }
        return selected.takeIf { available }
    }

    private fun failStart(sessionId: String, code: String): String {
        emit(sessionId, "error", code, "")
        emit(sessionId, "stopped")
        clearActive(sessionId)
        return "fail:$code"
    }

    private fun clearActive(sessionId: String) {
        synchronized(lock) {
            if (activeSessionId == sessionId) activeSessionId = null
            if (pendingStart?.sessionId == sessionId) pendingStart = null
            if (activeSession?.sessionId == sessionId) activeSession = null
        }
    }

    private fun emit(sessionId: String, kind: String, first: String = "", second: String = "") {
        val event = buildString {
            append(sessionId).append(FIELD_SEPARATOR).append(kind)
            if (first.isNotEmpty() || kind == "partial" || kind == "final" || kind == "permission") {
                append(FIELD_SEPARATOR).append(first)
            }
            if (second.isNotEmpty() || kind == "error") append(FIELD_SEPARATOR).append(second)
        }
        synchronized(lock) { events.addLast(event) }
    }

    private fun <T> onMain(block: () -> T): T {
        if (Looper.myLooper() == Looper.getMainLooper()) return block()
        val latch = CountDownLatch(1)
        val result = AtomicReference<Result<T>?>()
        mainHandler.post {
            result.set(runCatching(block))
            latch.countDown()
        }
        check(latch.await(MAIN_CALL_TIMEOUT_MS, TimeUnit.MILLISECONDS)) { "main thread timeout" }
        return result.get()?.getOrThrow() ?: error("main thread returned no result")
    }
}

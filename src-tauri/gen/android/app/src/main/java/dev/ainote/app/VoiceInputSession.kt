package dev.ainote.app

import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.SpeechRecognizer
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** One SpeechRecognizer lifetime. All methods except awaitFinished run on the Android main thread. */
internal class VoiceInputSession(
    val sessionId: String,
    private val recognizer: SpeechRecognizer,
    private val intent: Intent,
    private val emit: (String, String, String, String) -> Unit,
) : RecognitionListener {
    private val finished = CountDownLatch(1)
    @Volatile
    private var stopping = false
    @Volatile
    private var released = false

    fun start() {
        recognizer.setRecognitionListener(this)
        recognizer.startListening(intent)
    }

    fun requestStop() {
        if (released) {
            finished.countDown()
            return
        }
        stopping = true
        runCatching { recognizer.stopListening() }
    }

    fun awaitFinished(timeoutMs: Long): Boolean = finished.await(timeoutMs, TimeUnit.MILLISECONDS)

    fun forceStop() {
        if (released) return
        emit(sessionId, "stopped", "", "")
        release()
    }

    override fun onPartialResults(partialResults: Bundle?) {
        if (!released && !stopping) transcribe(partialResults, "partial")
    }

    override fun onResults(results: Bundle?) {
        if (released) return
        transcribe(results, "final")
        if (stopping) {
            emit(sessionId, "stopped", "", "")
            release()
        } else {
            runCatching { recognizer.startListening(intent) }.onFailure { fail("service") }
        }
    }

    override fun onError(error: Int) {
        if (released) return
        if (!stopping) emit(sessionId, "error", errorCode(error), "")
        emit(sessionId, "stopped", "", "")
        release()
    }

    override fun onReadyForSpeech(params: Bundle?) = Unit
    override fun onBeginningOfSpeech() = Unit
    override fun onRmsChanged(rmsdB: Float) = Unit
    override fun onBufferReceived(buffer: ByteArray?) = Unit
    override fun onEndOfSpeech() = Unit
    override fun onEvent(eventType: Int, params: Bundle?) = Unit

    private fun transcribe(bundle: Bundle?, kind: String) {
        val text = bundle?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
            ?.firstOrNull()
            ?.trim()
            .orEmpty()
        if (text.isNotEmpty()) emit(sessionId, kind, text, "")
    }

    private fun fail(code: String) {
        emit(sessionId, "error", code, "")
        emit(sessionId, "stopped", "", "")
        release()
    }

    private fun release() {
        if (released) return
        released = true
        runCatching { recognizer.destroy() }
        finished.countDown()
    }
}

private fun errorCode(error: Int): String = when (error) {
    SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "networkTimeout"
    SpeechRecognizer.ERROR_NETWORK -> "network"
    SpeechRecognizer.ERROR_AUDIO -> "audio"
    SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "permission"
    SpeechRecognizer.ERROR_NO_MATCH -> "noMatch"
    SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "busy"
    SpeechRecognizer.ERROR_SERVER -> "service"
    SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "speechTimeout"
    else -> "generic"
}

package dev.ainote.app

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

/** Android ACTION_SEND → app cache 原子暂存；Rust 侧用户确认后才创建笔记。 */
object ShareIntake {
  private const val DIR_NAME = "ainote-share"
  private const val MAX_IMAGE_BYTES = 20L * 1024L * 1024L
  private const val EXTRA_HANDLED = "dev.ainote.app.share_handled"

  fun accept(context: Context, intent: Intent?): Boolean {
    if (intent == null || intent.action != Intent.ACTION_SEND || intent.getBooleanExtra(EXTRA_HANDLED, false)) return false
    val text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString()?.trim().orEmpty()
    val subject = intent.getCharSequenceExtra(Intent.EXTRA_SUBJECT)?.toString()?.trim()?.takeIf { it.isNotEmpty() }
    val stream = singleStream(intent)
    if (text.isEmpty() && stream == null) return false

    val dir = File(context.cacheDir, DIR_NAME).apply { mkdirs() }
    val id = "${System.currentTimeMillis()}-${UUID.randomUUID()}"
    var image: File? = null
    var imageName: String? = null
    try {
      if (stream != null) {
        imageName = displayName(context, stream)
        image = copyImage(context, stream, dir, id, imageName)
      }
      writeManifest(dir, id, text, subject, image, imageName)
      intent.putExtra(EXTRA_HANDLED, true)
      return true
    } catch (error: Exception) {
      image?.delete()
      return false
    }
  }

  @Suppress("DEPRECATION")
  private fun singleStream(intent: Intent): Uri? = intent.getParcelableExtra(Intent.EXTRA_STREAM)

  private fun copyImage(context: Context, uri: Uri, dir: File, id: String, name: String): File {
    val suffix = name.substringAfterLast('.', "").takeIf { it.matches(Regex("[A-Za-z0-9]{1,8}")) }
      ?: extensionFor(context.contentResolver.getType(uri))
    val target = File(dir, "$id.$suffix")
    val temp = File(dir, "$id.image.tmp")
    var copied = 0L
    try {
      context.contentResolver.openInputStream(uri).use { input ->
        if (input == null) throw IllegalStateException("empty image stream")
        FileOutputStream(temp).use { output ->
          val buffer = ByteArray(64 * 1024)
          while (true) {
            val read = input.read(buffer)
            if (read < 0) break
            copied += read
            if (copied > MAX_IMAGE_BYTES) throw IllegalArgumentException("image exceeds 20MB")
            output.write(buffer, 0, read)
          }
          output.flush()
          output.fd.sync()
        }
      }
      if (!temp.renameTo(target)) throw IllegalStateException("cannot finalize image")
      return target
    } finally {
      temp.delete()
    }
  }

  private fun displayName(context: Context, uri: Uri): String {
    context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
      if (cursor.moveToFirst()) {
        val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
        if (index >= 0) cursor.getString(index)?.takeIf { it.isNotBlank() }?.let { return it }
      }
    }
    return "shared-image"
  }

  private fun extensionFor(mime: String?): String = when (mime) {
    "image/png" -> "png"
    "image/webp" -> "webp"
    "image/gif" -> "gif"
    "image/heic", "image/heif" -> "heic"
    else -> "jpg"
  }

  private fun writeManifest(dir: File, id: String, text: String, subject: String?, image: File?, imageName: String?) {
    val json = JSONObject().apply {
      put("id", id)
      put("text", text)
      put("subject", subject ?: JSONObject.NULL)
      put("imagePath", image?.absolutePath ?: JSONObject.NULL)
      put("imageName", imageName ?: JSONObject.NULL)
    }
    val target = File(dir, "$id.json")
    val temp = File(dir, "$id.json.tmp")
    FileOutputStream(temp).use { output ->
      output.write(json.toString().toByteArray(Charsets.UTF_8))
      output.flush()
      output.fd.sync()
    }
    if (!temp.renameTo(target)) {
      temp.delete()
      throw IllegalStateException("cannot finalize share manifest")
    }
  }
}

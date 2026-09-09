package io.crates.keyring

import android.content.Context

/** Initializes the NDK application context required by android-native-keyring-store. */
class Keyring {
  companion object {
    init {
      System.loadLibrary("ainote_core_lib")
    }

    external fun initializeNdkContext(context: Context)
  }
}

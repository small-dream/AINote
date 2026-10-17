import { call } from "./client";
import type { CaptureInput, CaptureSettings, NoteMeta, SharedCapture } from "./types";

/** 快速捕捉（桌面快捷键 / Android 系统分享）。 */
export const captureApi = {
  getSettings: () => call<CaptureSettings>("capture_get_settings"),
  setShortcut: (shortcut: string) => call<CaptureSettings>("capture_set_shortcut", { shortcut }),
  resetShortcut: () => call<CaptureSettings>("capture_reset_shortcut"),
  create: (input: CaptureInput) => call<NoteMeta>("capture_create", { input }),
  pendingShare: () => call<SharedCapture | null>("capture_pending_share"),
  ackShare: (intakeId: string) => call<null>("capture_ack_share", { intakeId }),
};

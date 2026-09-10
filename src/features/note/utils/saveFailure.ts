import type { TranslationKey } from "@/i18n/messages";

/**
 * 保存失败的可操作建议（E3-T5）：IO 类错误指向磁盘与权限，其余指向重试与诊断包。
 * 未知错误码同样给出通用建议，保证界面不会只出现错误码。
 */
export function saveFailureHintKey(code: string | null | undefined): TranslationKey {
  if (code && code.startsWith("IO_")) return "note.saveFailedHintIo";
  return "note.saveFailedHint";
}

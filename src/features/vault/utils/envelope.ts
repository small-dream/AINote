/** 加密笔记信封首行（与 Rust `domain/vault.rs` 的 ENVELOPE_MAGIC 一致）。 */
export const ENVELOPE_MAGIC = "AINOTE-ENC-v1";

/** 判断一段文本是否已是加密信封：只看首行，避免对整块密文做无意义处理。 */
export function isEnvelopeText(text: string | null | undefined): boolean {
  if (!text) return false;
  const firstLine = text.split("\n", 1)[0] ?? "";
  return firstLine.trimEnd() === ENVELOPE_MAGIC;
}

/** E2E mock 信封：与 Rust `domain/vault.rs` 同一 magic 行，正文只做 base64 占位（不加密），拟真的是状态机而非密码学。 */
import { ENVELOPE_MAGIC, isEnvelopeText } from "@/features/vault/utils/envelope";

function toBase64(text: string): string {
  let binary = "";
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(payload: string): string {
  const binary = atob(payload);
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

export { isEnvelopeText };

/** 明文 → 信封文本（magic 行 + base64 折行 + 结尾换行，与 Rust encode_envelope 同构）。 */
export function wrapEnvelope(plain: string): string {
  const base64 = toBase64(plain);
  const lines: string[] = [];
  for (let index = 0; index < base64.length; index += 76) lines.push(base64.slice(index, index + 76));
  return `${ENVELOPE_MAGIC}\n${lines.join("\n")}\n`;
}

/** 信封文本 → 明文（剔除折行空白后解码）；非信封原样返回，与后端容错口径一致。 */
export function unwrapEnvelope(text: string): string {
  if (!isEnvelopeText(text)) return text;
  const payload = text.split("\n").slice(1).join("").replace(/\s/g, "");
  return payload === "" ? "" : fromBase64(payload);
}

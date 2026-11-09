import { convertDocxToHtml, type DocxConversion } from "./docxCore";
import { throwIfAborted } from "./abort";
import { DocumentImportError, type DocxWorkerRequest, type DocxWorkerResponse } from "../types";

const OLE_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] as const;
const ENCRYPTED_MARKERS = ["EncryptedPackage", "EncryptionInfo"];

function containsUtf16Le(bytes: Uint8Array, text: string): boolean {
  const width = text.length * 2;
  for (let start = 0; start + width <= bytes.length; start += 1) {
    let matched = true;
    for (let index = 0; index < text.length; index += 1) {
      if (bytes[start + index * 2] !== text.charCodeAt(index) || bytes[start + index * 2 + 1] !== 0) {
        matched = false;
        break;
      }
    }
    if (matched) return true;
  }
  return false;
}

/** 加密的 Office 文件会退化为 OLE 容器；旧 .doc 也使用同一签名，需再检查加密目录项。 */
export function detectOleWordProblem(buffer: ArrayBuffer): "passwordProtected" | "unsupported" | null {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < OLE_SIGNATURE.length || OLE_SIGNATURE.some((value, index) => bytes[index] !== value)) return null;
  return ENCRYPTED_MARKERS.some((marker) => containsUtf16Le(bytes, marker)) ? "passwordProtected" : "unsupported";
}

function runWorker(arrayBuffer: ArrayBuffer, signal: AbortSignal): Promise<DocxConversion> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../workers/docx.worker.ts", import.meta.url), { type: "module" });
    const cleanup = () => {
      signal.removeEventListener("abort", abort);
      worker.terminate();
    };
    const abort = () => {
      cleanup();
      reject(new DOMException("document import cancelled", "AbortError"));
    };
    signal.addEventListener("abort", abort, { once: true });
    worker.onmessage = (event: MessageEvent<DocxWorkerResponse>) => {
      cleanup();
      if (event.data.ok) resolve({ html: event.data.html, assets: event.data.assets, warnings: event.data.warnings });
      else reject(new DocumentImportError("parseFailed", event.data.message));
    };
    worker.onerror = (event) => {
      cleanup();
      reject(new Error(event.message || "docx worker failed"));
    };
    const workerBuffer = arrayBuffer.slice(0);
    const request: DocxWorkerRequest = { arrayBuffer: workerBuffer };
    worker.postMessage(request, [workerBuffer]);
  });
}

export async function convertDocx(file: File, signal: AbortSignal): Promise<DocxConversion> {
  const arrayBuffer = await file.arrayBuffer();
  throwIfAborted(signal);
  const problem = detectOleWordProblem(arrayBuffer);
  if (problem) {
    throw new DocumentImportError(problem, problem === "passwordProtected" ? "word document is encrypted" : "legacy word document");
  }
  if (typeof Worker === "undefined") return convertDocxToHtml(arrayBuffer);
  try {
    return await runWorker(arrayBuffer, signal);
  } catch (error) {
    throwIfAborted(signal);
    if (error instanceof DocumentImportError) throw error;
    return convertDocxToHtml(arrayBuffer);
  }
}

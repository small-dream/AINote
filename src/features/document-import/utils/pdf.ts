import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { throwIfAborted } from "./abort";
import {
  assemblePdfMarkdown,
  dedupeRepeatedMargins,
  isProbablyScanned,
  pageTextFromItems,
  toPdfTextItem,
} from "./pdfText";
import {
  DocumentImportError,
  type ConversionProgress,
  type DocumentImportWarning,
} from "../types";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface PdfConversion {
  markdown: string;
  pages: number;
  warnings: DocumentImportWarning[];
}

function isPasswordError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && (error as { name?: unknown }).name === "PasswordException";
}

async function loadDocument(loadingTask: ReturnType<typeof pdfjs.getDocument>): Promise<pdfjs.PDFDocumentProxy> {
  try {
    return await loadingTask.promise;
  } catch (error) {
    if (isPasswordError(error)) throw new DocumentImportError("passwordProtected", "pdf is password protected");
    throw new DocumentImportError("parseFailed", "pdf could not be parsed", { cause: error });
  }
}

export async function convertPdf(
  file: File,
  signal: AbortSignal,
  onProgress: (progress: ConversionProgress) => void,
): Promise<PdfConversion> {
  const data = new Uint8Array(await file.arrayBuffer());
  throwIfAborted(signal);
  const loadingTask = pdfjs.getDocument({
    data,
    useWorkerFetch: false,
    cMapUrl: "/pdfjs/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "/pdfjs/standard_fonts/",
  });
  const abort = () => { void loadingTask.destroy().catch(() => undefined); };
  signal.addEventListener("abort", abort, { once: true });
  try {
    const document = await loadDocument(loadingTask);
    const total = document.numPages;
    onProgress({ current: 0, total });
    const pages: string[] = [];
    for (let index = 1; index <= total; index += 1) {
      throwIfAborted(signal);
      const page = await document.getPage(index);
      try {
        const content = await page.getTextContent();
        const items = content.items.map(toPdfTextItem).filter((item) => item !== null);
        pages.push(pageTextFromItems(items));
      } finally {
        page.cleanup();
      }
      onProgress({ current: index, total });
    }
    const cleaned = dedupeRepeatedMargins(pages);
    const markdown = assemblePdfMarkdown(cleaned);
    if (!markdown) throw new DocumentImportError("empty", "pdf has no extractable text");
    return { markdown, pages: total, warnings: isProbablyScanned(cleaned) ? ["scannedPdf"] : [] };
  } catch (error) {
    if (signal.aborted) throw new DOMException("document import cancelled", "AbortError");
    throw error;
  } finally {
    signal.removeEventListener("abort", abort);
    await loadingTask.destroy().catch(() => undefined);
  }
}

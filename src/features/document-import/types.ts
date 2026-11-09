/** 桌面端 PDF / Word 导入的共享类型与上限（仅桌面壳开放）。 */

export type DocumentFormat = "docx" | "pdf";

export type DocumentImportWarning = "formatSimplified" | "scannedPdf" | "imageLimit";

export type DocumentImportErrorCode =
  | "desktopOnly"
  | "unsupported"
  | "oneAtATime"
  | "tooLarge"
  | "empty"
  | "passwordProtected"
  | "parseFailed"
  | "saveFailed";

export interface DocumentAsset {
  fileName: string;
  bytes: Uint8Array;
}

export interface DocumentImportResult {
  format: DocumentFormat;
  sourceName: string;
  markdown: string;
  assets: DocumentAsset[];
  warnings: DocumentImportWarning[];
  characters: number;
  pages?: number;
}

export interface ConversionProgress {
  current: number;
  total: number;
}

export interface DocxWorkerRequest {
  arrayBuffer: ArrayBuffer;
}

export type DocxWorkerResponse =
  | { ok: true; html: string; assets: DocumentAsset[]; warnings: DocumentImportWarning[] }
  | { ok: false; message: string };

export const DOCUMENT_ASSET_PROTOCOL = "ainote-asset://";
export const MAX_DOCUMENT_BYTES = 30 * 1024 * 1024;
export const MAX_DOCUMENT_IMAGES = 100;
export const MAX_TOTAL_IMAGE_BYTES = 80 * 1024 * 1024;

export class DocumentImportError extends Error {
  readonly code: DocumentImportErrorCode;

  constructor(code: DocumentImportErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "DocumentImportError";
    this.code = code;
  }
}

export function documentFormatOf(fileName: string): DocumentFormat | null {
  const lower = fileName.toLocaleLowerCase();
  if (lower.endsWith(".docx")) return "docx";
  if (lower.endsWith(".pdf")) return "pdf";
  return null;
}

export function isMarkdownFile(fileName: string): boolean {
  const lower = fileName.toLocaleLowerCase();
  return lower.endsWith(".md") || lower.endsWith(".markdown");
}

export function isUnsupportedWordFile(fileName: string): boolean {
  const lower = fileName.toLocaleLowerCase();
  return lower.endsWith(".doc") || lower.endsWith(".docm");
}

export function toDocumentImportError(error: unknown): DocumentImportError {
  if (error instanceof DocumentImportError) return error;
  return new DocumentImportError("parseFailed", "document import failed", { cause: error });
}

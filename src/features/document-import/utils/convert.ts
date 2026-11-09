import { throwIfAborted } from "./abort";
import { htmlToMarkdown } from "./markdown";
import {
  DOCUMENT_ASSET_PROTOCOL,
  DocumentImportError,
  MAX_DOCUMENT_BYTES,
  documentFormatOf,
  isUnsupportedWordFile,
  type ConversionProgress,
  type DocumentAsset,
  type DocumentFormat,
  type DocumentImportResult,
  type DocumentImportWarning,
} from "../types";

type ProgressListener = (progress: ConversionProgress) => void;

function validateFile(file: File): DocumentFormat {
  if (isUnsupportedWordFile(file.name)) throw new DocumentImportError("unsupported", "legacy word files are unsupported");
  const format = documentFormatOf(file.name);
  if (!format) throw new DocumentImportError("unsupported", "unsupported document format");
  if (file.size > MAX_DOCUMENT_BYTES) throw new DocumentImportError("tooLarge", "document is too large");
  return format;
}

export function assetIndexesIn(markdown: string): Set<number> {
  const indexes = new Set<number>();
  const pattern = new RegExp(`${DOCUMENT_ASSET_PROTOCOL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\d+)`, "g");
  for (const match of markdown.matchAll(pattern)) indexes.add(Number(match[1]));
  return indexes;
}

interface FilteredDocument {
  markdown: string;
  assets: DocumentAsset[];
}

/** 只保留 Markdown 实际引用的图片，并把占位符压缩成连续索引供 Rust 侧替换。 */
export function filterUsedAssets(markdown: string, assets: readonly DocumentAsset[]): FilteredDocument {
  const indexes = assetIndexesIn(markdown);
  for (const index of indexes) {
    if (!assets[index]) throw new DocumentImportError("parseFailed", "document asset marker is missing");
  }
  const used = [...indexes].sort((a, b) => a - b);
  const remap = new Map(used.map((oldIndex, newIndex) => [oldIndex, newIndex]));
  const pattern = new RegExp(`${DOCUMENT_ASSET_PROTOCOL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\d+)`, "g");
  const rewritten = markdown.replace(pattern, (match, digits: string) => {
    const next = remap.get(Number(digits));
    return next === undefined ? match : `${DOCUMENT_ASSET_PROTOCOL}${next}`;
  });
  const selected = used.map((index) => {
    const asset = assets[index];
    if (!asset) throw new DocumentImportError("parseFailed", "document asset marker is missing");
    return asset;
  });
  return { markdown: rewritten, assets: selected };
}

function dedupeWarnings(warnings: readonly DocumentImportWarning[]): DocumentImportWarning[] {
  return [...new Set(warnings)];
}

async function convertWord(file: File, signal: AbortSignal): Promise<DocumentImportResult> {
  const { convertDocx } = await import("./docx");
  throwIfAborted(signal);
  const result = await convertDocx(file, signal);
  throwIfAborted(signal);
  const markdown = htmlToMarkdown(result.html);
  if (!markdown) throw new DocumentImportError("empty", "word document has no content");
  const filtered = filterUsedAssets(markdown, result.assets);
  return {
    format: "docx",
    sourceName: file.name,
    markdown: filtered.markdown,
    assets: filtered.assets,
    warnings: dedupeWarnings(result.warnings),
    characters: filtered.markdown.length,
  };
}

async function convertPdfFile(file: File, signal: AbortSignal, onProgress: ProgressListener): Promise<DocumentImportResult> {
  const { convertPdf } = await import("./pdf");
  const result = await convertPdf(file, signal, onProgress);
  return {
    format: "pdf",
    sourceName: file.name,
    markdown: result.markdown,
    assets: [],
    warnings: result.warnings,
    characters: result.markdown.length,
    pages: result.pages,
  };
}

export async function convertDocumentFile(
  file: File,
  signal: AbortSignal,
  onProgress: ProgressListener = () => {},
): Promise<DocumentImportResult> {
  const format = validateFile(file);
  onProgress({ current: 0, total: 1 });
  throwIfAborted(signal);
  const result = format === "docx" ? await convertWord(file, signal) : await convertPdfFile(file, signal, onProgress);
  throwIfAborted(signal);
  onProgress({ current: 1, total: 1 });
  return result;
}

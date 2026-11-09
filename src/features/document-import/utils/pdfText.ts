export interface PdfTextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfLine {
  text: string;
  y: number;
  height: number;
}

interface TextItemLike {
  str: string;
  transform: number[];
  width?: number;
  height?: number;
}

const CJK = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uac00-\ud7af]/;
const NO_SPACE_AFTER = /[([{“‘（【《]/;
const NO_SPACE_BEFORE = /[)\]}”’）】》，。；：！？、,.;:!?]/;

export function toPdfTextItem(item: unknown): PdfTextItem | null {
  if (!item || typeof item !== "object") return null;
  const value = item as Partial<TextItemLike>;
  if (typeof value.str !== "string" || !Array.isArray(value.transform) || value.transform.length < 6) return null;
  return {
    text: value.str,
    x: Number(value.transform[4] ?? 0),
    y: Number(value.transform[5] ?? 0),
    width: Number(value.width ?? 0),
    height: Number(value.height ?? 10),
  };
}

export function needsSpace(previous: string, next: string): boolean {
  if (!previous || !next) return false;
  if (/\s/.test(previous) || /\s/.test(next)) return false;
  if (NO_SPACE_AFTER.test(previous) || NO_SPACE_BEFORE.test(next)) return false;
  return !(CJK.test(previous) && CJK.test(next));
}

function buildLine(items: PdfTextItem[]): PdfLine {
  const sorted = [...items].sort((a, b) => a.x - b.x);
  let text = "";
  let previousEnd = sorted[0]?.x ?? 0;
  let previousHeight = sorted[0]?.height ?? 10;
  for (const item of sorted) {
    if (item.text.length === 0) continue;
    const gap = item.x - previousEnd;
    text += gapSeparator(text, item.text, gap, previousHeight) + item.text;
    previousEnd = item.x + item.width;
    previousHeight = Math.max(previousHeight, item.height);
  }
  return {
    text: text.replace(/\s+/g, " ").trim(),
    y: sorted[0]?.y ?? 0,
    height: sorted.reduce((max, item) => Math.max(max, item.height), 10),
  };
}

function gapSeparator(text: string, next: string, gap: number, height: number): string {
  if (!text || gap <= Math.max(1.5, height * 0.18)) return "";
  return needsSpace(text.at(-1) ?? "", next[0] ?? "") ? " " : "";
}

export function linesFromItems(items: readonly PdfTextItem[]): PdfLine[] {
  const sorted = [...items].filter((item) => item.text.length > 0).sort((a, b) => b.y - a.y || a.x - b.x);
  const groups: PdfTextItem[][] = [];
  for (const item of sorted) {
    const current = groups.at(-1);
    const tolerance = Math.max(2, item.height * 0.4);
    const anchorY = current?.[0]?.y ?? item.y;
    if (!current || Math.abs(anchorY - item.y) > tolerance) groups.push([item]);
    else current.push(item);
  }
  return groups.map(buildLine).filter((line) => line.text.length > 0);
}

function median(values: number[]): number {
  if (values.length === 0) return 10;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 10;
}

function appendLine(previous: string, next: string): string {
  if (previous.endsWith("-") && /^[a-z]/.test(next)) return `${previous.slice(0, -1)}${next}`;
  return needsSpace(previous.at(-1) ?? "", next[0] ?? "") ? `${previous} ${next}` : `${previous}${next}`;
}

export function pageTextFromItems(items: readonly PdfTextItem[]): string {
  const lines = linesFromItems(items);
  const averageHeight = median(lines.map((line) => line.height));
  let text = "";
  let previous: PdfLine | null = null;
  for (const line of lines) {
    if (!text) {
      text = line.text;
    } else if (previous && previous.y - line.y > averageHeight * 1.9) {
      text += `\n\n${line.text}`;
    } else {
      text = appendLine(text, line.text);
    }
    previous = line;
  }
  return text.trim();
}

const CHINESE_PAGE_NUMBER = /^第\s*\d+\s*页(?:\s*(?:[/,，·]\s*)?(?:共\s*)?\d+\s*页)?$/u;
const ENGLISH_PAGE_NUMBER = /^(?:page|p\.?)\s*\d+(?:\s*(?:of|\/)\s*\d+)?$/iu;
const NUMERIC_PAGE_NUMBER = /^[-–—]?\s*\d+(?:\s*(?:\/|of)\s*\d+)?\s*[-–—]?$/i;

function marginKey(line: string): string {
  const value = line.replace(/\s+/g, " ").trim();
  if (CHINESE_PAGE_NUMBER.test(value)) return "#zh-page";
  if (ENGLISH_PAGE_NUMBER.test(value)) return "#en-page";
  if (NUMERIC_PAGE_NUMBER.test(value)) return "#page";
  return value;
}

export function dedupeRepeatedMargins(pages: string[]): string[] {
  if (pages.length < 2) return pages;
  // 保留空行：页面文本里的 "\n\n" 是段落分隔，按非空行过滤会把整页压成一段。
  const pageLines = pages.map((page) => page.split("\n").map((line) => line.trim()));
  const contentIndexes = pageLines.map((lines) => lines.reduce<number[]>((indexes, line, index) => {
    if (line) indexes.push(index);
    return indexes;
  }, []));
  const counts = new Map<string, number>();
  contentIndexes.forEach((indexes, page) => {
    if (indexes.length <= 2) return;
    const lines = pageLines[page] ?? [];
    const candidates = new Set([...indexes.slice(0, 2), ...indexes.slice(-2)].map((index) => marginKey(lines[index] ?? "")));
    for (const key of candidates) {
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  });
  const threshold = Math.max(2, Math.ceil(pages.length * 0.6));
  const repeated = new Set([...counts].filter(([, count]) => count >= threshold).map(([key]) => key));
  if (repeated.size === 0) return pages;
  return pageLines.map((lines, page) => {
    const indexes = contentIndexes[page] ?? [];
    if (indexes.length <= 2) return lines.join("\n");
    const margins = new Set([...indexes.slice(0, 2), ...indexes.slice(-2)]);
    const cleaned = lines.filter((line, index) => !(margins.has(index) && repeated.has(marginKey(line))));
    // 候选行全被删掉时回退原文，避免整页消失。
    const kept = cleaned.some((line) => line) ? cleaned : lines;
    return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  });
}

export function isProbablyScanned(pages: string[]): boolean {
  if (pages.length === 0) return false;
  const emptyPages = pages.filter((page) => page.trim().length < 10).length;
  return emptyPages >= Math.max(1, Math.ceil(pages.length / 2));
}

export function assemblePdfMarkdown(pages: string[]): string {
  return pages.map((page) => page.trim()).filter(Boolean).join("\n\n---\n\n").trim();
}

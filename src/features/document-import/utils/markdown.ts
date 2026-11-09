import TurndownService from "turndown";
import { gfm } from "@joplin/turndown-plugin-gfm";
import { DOCUMENT_ASSET_PROTOCOL } from "../types";

const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);
const BLOCKED_TAGS = ["script", "style", "iframe", "object", "embed", "head", "meta", "link"] as const;

export function isSafeHref(href: string): boolean {
  const value = href.trim();
  if (!value || value.startsWith("#") || value.startsWith("/") || value.startsWith("./") || value.startsWith("../")) return true;
  if (value.startsWith(DOCUMENT_ASSET_PROTOCOL)) return true;
  try {
    return SAFE_PROTOCOLS.has(new URL(value).protocol);
  } catch {
    return false;
  }
}

function markdownDestination(raw: string): string {
  const encoded = raw.trim().replace(/[\s<>]/g, (char) => encodeURIComponent(char));
  return /[()]/.test(encoded) ? `<${encoded}>` : encoded;
}

function markdownAlt(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/\]/g, "\\]").replace(/\r?\n/g, " ");
}

function imageRule(service: TurndownService): void {
  service.addRule("documentImage", {
    filter: "img",
    replacement: (_content, node) => {
      const src = node.getAttribute("src") ?? "";
      if (!src || !isSafeHref(src)) return "";
      return `![${markdownAlt(node.getAttribute("alt") ?? "")}](${markdownDestination(src)})`;
    },
  });
}

function linkRule(service: TurndownService): void {
  service.addRule("documentLink", {
    filter: "a",
    replacement: (content, node) => {
      const href = node.getAttribute("href") ?? "";
      if (!href || !isSafeHref(href)) return content;
      return `[${content}](${markdownDestination(href)})`;
    },
  });
}

function flattenCell(markdown: string): string {
  const text = markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("```"))
    .map((line) => line.replace(/^(?:[-*+]\s+|\d+\.\s+)/, ""))
    .join("；")
    .replace(/\s+/g, " ")
    .trim();
  return text.replace(/\\?\|/g, "\\|");
}

function tableRule(service: TurndownService): void {
  service.addRule("documentTable", {
    filter: "table",
    replacement: (_content, node) => {
      const rows = Array.from((node as HTMLTableElement).rows).map((row) => Array.from(row.cells)
        .map((cell) => flattenCell(service.turndown(cell.innerHTML))));
      if (rows.length === 0) return "";
      const header = rows[0] ?? [];
      const separator = header.map(() => "---");
      const line = (cells: readonly string[]) => `| ${cells.join(" | ")} |`;
      return `\n\n${[line(header), line(separator), ...rows.slice(1).map(line)].join("\n")}\n\n`;
    },
  });
}

/** 源码里出现 ``` 时必须加长围栏，否则代码块会在自己的内容处提前闭合。 */
function fencedBlock(code: string, language: string): string {
  const longest = (code.match(/`{3,}/g) ?? []).reduce((max, run) => Math.max(max, run.length), 0);
  const fence = "`".repeat(Math.max(3, longest + 1));
  return `\n\n${fence}${language}\n${code}\n${fence}\n\n`;
}

function codeBlockRule(service: TurndownService): void {
  service.addRule("documentCodeBlock", {
    filter: "pre",
    replacement: (_content, node) => {
      const code = node.textContent?.replace(/\n$/, "") ?? "";
      const codeNode = node.querySelector("code");
      const className = codeNode?.getAttribute("class") ?? "";
      const language = /(?:language-|lang-)([\w-]+)/.exec(className)?.[1] ?? "";
      return fencedBlock(code, language);
    },
  });
}

function createService(): TurndownService {
  const service = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
    strongDelimiter: "**",
    hr: "---",
  });
  service.use(gfm);
  BLOCKED_TAGS.forEach((tag) => service.remove(tag));
  imageRule(service);
  linkRule(service);
  codeBlockRule(service);
  tableRule(service);
  return service;
}

/** 围栏行：最多 3 个前导空格 + 3 个以上反引号或波浪号（CommonMark）。 */
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;

interface MarkdownSegment {
  /** true 表示这一段是围栏代码块（含开闭围栏行），必须原样保留 */
  code: boolean;
  lines: string[];
}

function closesFence(line: string, fence: { char: string; size: number }): boolean {
  const trimmed = line.trimStart();
  let run = 0;
  while (trimmed[run] === fence.char) run += 1;
  // 闭合围栏必须由同种字符组成、不短于开围栏，其后只能有空白。
  return run >= fence.size && trimmed.slice(run).trim().length === 0;
}

/**
 * 按围栏把 Markdown 切成「代码块内 / 代码块外」片段。
 * 每一行只归属一个片段，按 `\n` 拼回可无损还原原文。
 */
function splitFencedSegments(markdown: string): MarkdownSegment[] {
  const segments: MarkdownSegment[] = [];
  let lines: string[] = [];
  let fence: { char: string; size: number } | null = null;
  const flush = (code: boolean) => {
    if (lines.length > 0) segments.push({ code, lines });
    lines = [];
  };
  for (const line of markdown.split("\n")) {
    if (fence) {
      lines.push(line);
      if (closesFence(line, fence)) {
        flush(true);
        fence = null;
      }
      continue;
    }
    const open = FENCE_OPEN.exec(line);
    if (open) {
      flush(false);
      const marker = open[1] ?? "```";
      fence = { char: marker[0] ?? "`", size: marker.length };
      lines.push(line);
      continue;
    }
    lines.push(line);
  }
  flush(fence !== null);
  return segments;
}

/** 只清洗正文片段：代码块内的 `<script>`、连续空行、行尾空格都属于源码，必须原样保留。 */
function cleanProseSegment(segment: string): string {
  return segment
    .replace(/\u00a0/g, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

function trailingNewlines(value: string): number {
  let count = 0;
  while (value[value.length - 1 - count] === "\n") count += 1;
  return count;
}

function leadingNewlines(value: string): number {
  let count = 0;
  while (value[count] === "\n") count += 1;
  return count;
}

/**
 * 拼接片段并收紧片段接缝：围栏外已经清洗过，接缝处的空行只保留最多一个，
 * 与旧实现 `/\n{3,}/ → "\n\n"` 的口径一致，不会因为多段拼接冒出三连换行。
 */
function joinSegments(parts: readonly string[]): string {
  let output = parts[0] ?? "";
  for (const part of parts.slice(1)) {
    const gap = Math.min(2, trailingNewlines(output) + 1 + leadingNewlines(part));
    output = `${output.replace(/\n+$/, "")}${"\n".repeat(gap)}${part.replace(/^\n+/, "")}`;
  }
  return output;
}

export function htmlToMarkdown(html: string): string {
  // CRLF 统一放在切分之前：代码块内容同样需要规范换行，否则会在正文里留下 \r。
  const raw = createService().turndown(html).replace(/\r\n?/g, "\n");
  const parts = splitFencedSegments(raw).map((segment) =>
    segment.code ? segment.lines.join("\n") : cleanProseSegment(segment.lines.join("\n")),
  );
  return joinSegments(parts).trim();
}

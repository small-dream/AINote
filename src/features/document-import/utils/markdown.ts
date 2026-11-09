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

function codeBlockRule(service: TurndownService): void {
  service.addRule("documentCodeBlock", {
    filter: "pre",
    replacement: (_content, node) => {
      const code = node.textContent?.replace(/\n$/, "") ?? "";
      const codeNode = node.querySelector("code");
      const className = codeNode?.getAttribute("class") ?? "";
      const language = /(?:language-|lang-)([\w-]+)/.exec(className)?.[1] ?? "";
      return `\n\n\`\`\`${language}\n${code}\n\`\`\`\n\n`;
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

export function cleanMarkdown(markdown: string): string {
  return markdown
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function htmlToMarkdown(html: string): string {
  return cleanMarkdown(createService().turndown(html));
}

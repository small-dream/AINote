import { parse as parseYaml } from "yaml";
import { parseMarkdownTable, splitTableRow } from "@/features/note/softRender/utils/table";

export type DiagnosticSeverity = "error" | "warning";
export type DiagnosticSource = "codeblock" | "table" | "frontmatter" | "image";

export interface DiagnosticIssue {
  code: string;
  severity: DiagnosticSeverity;
  source: DiagnosticSource;
  /** 1 起行号 */
  line: number;
  message: string;
}

export interface ImageRef {
  src: string;
  line: number;
  /** 是否为仓库内相对路径（可做存在性检查） */
  local: boolean;
}

const FENCE_RE = /^(`{3,}|~{3,})/;
const IMAGE_REF_RE = /!\[([^\]]*)\]\(([^)]*)\)/g;

function splitLines(content: string): string[] {
  return content.split(/\r?\n/);
}

/** 运行全部同步诊断（图片断链需结合 asset_exists 异步校验）。 */
export function diagnoseMarkdown(content: string): DiagnosticIssue[] {
  return [
    ...diagnoseCodeBlocks(content),
    ...diagnoseTables(content),
    ...diagnoseFrontmatter(content),
    ...diagnoseImageRefs(content),
  ];
}

/** 围栏代码块未闭合检测：同字符开闭，闭合围栏长度不低于开启围栏。 */
export function diagnoseCodeBlocks(content: string): DiagnosticIssue[] {
  const result = scanFences(splitLines(content));
  if (!result.open) return [];
  return [{ code: "DIAG_CODEBLOCK_1", severity: "error", source: "codeblock", line: result.openLine, message: "未闭合的代码块" }];
}

interface FenceScan {
  open: boolean;
  openLine: number;
  openChar: string;
  openLen: number;
}

/** 扫描围栏状态机：遇到合法围栏行翻转开闭状态。 */
function scanFences(lines: string[]): FenceScan {
  const scan: FenceScan = { open: false, openLine: 0, openChar: "", openLen: 0 };
  lines.forEach((line, index) => {
    const marker = fenceMarker(line);
    if (marker === null) return;
    if (!scan.open) {
      scan.open = true;
      scan.openLine = index + 1;
      scan.openChar = marker[0] ?? "";
      scan.openLen = marker.length;
      return;
    }
    if (scan.openChar === marker[0] && marker.length >= scan.openLen) scan.open = false;
  });
  return scan;
}

function fenceMarker(line: string): string | null {
  return FENCE_RE.exec(line)?.[1] ?? null;
}

/** 逐行标记围栏内代码内容（跳过表格/图片误报）。 */
function codeLineMask(lines: string[]): boolean[] {
  const inCode = new Array<boolean>(lines.length).fill(false);
  let active = false;
  let activeChar = "";
  let activeLen = 0;
  lines.forEach((line, index) => {
    const marker = fenceMarker(line);
    if (marker !== null) {
      if (!active) {
        active = true;
        activeChar = marker[0] ?? "";
        activeLen = marker.length;
        return;
      }
      if (activeChar === marker[0] && marker.length >= activeLen) active = false;
      return;
    }
    inCode[index] = active;
  });
  return inCode;
}

/** 无效表格诊断：以 `|` 开头的连续行视为表格块，校验分隔行与列数一致性。 */
export function diagnoseTables(content: string): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = [];
  const lines = splitLines(content);
  const inCode = codeLineMask(lines);
  let start = -1;
  const isPipeRow = (index: number) => index < lines.length && !inCode[index] && /^\s*\|/.test(lines[index] ?? "");
  for (let i = 0; i <= lines.length; i += 1) {
    if (start >= 0 && (i === lines.length || !isPipeRow(i))) {
      issues.push(...diagnoseTableBlock(lines, start, i - 1));
      start = -1;
    }
    if (i < lines.length && start < 0 && isPipeRow(i)) start = i;
  }
  return issues;
}

function diagnoseTableBlock(lines: string[], start: number, end: number): DiagnosticIssue[] {
  const block = lines.slice(start, end + 1);
  const parsed = parseMarkdownTable(block.join("\n"));
  if (!parsed) {
    const separator = block[1]?.includes("-") ?? false;
    return [{
      code: "DIAG_TABLE_1",
      severity: separator ? "error" : "warning",
      source: "table",
      line: start + 1,
      message: separator ? "表格语法不完整或列数与表头不一致" : "表格缺少分隔行（表头下应有 --- 行）",
    }];
  }
  const issues: DiagnosticIssue[] = [];
  const headerCount = parsed.header.length;
  block.forEach((line, index) => {
    if (index === 0 || index === 1) return;
    const cells = splitTableRow(line);
    if (cells.length > 0 && cells.length !== headerCount) {
      issues.push({
        code: "DIAG_TABLE_2",
        severity: "warning",
        source: "table",
        line: start + index + 1,
        message: `第 ${index + 1} 行有 ${cells.length} 列，表头为 ${headerCount} 列`,
      });
    }
  });
  return issues;
}

/** frontmatter 校验：未闭合、YAML 解析失败、非键值对。 */
export function diagnoseFrontmatter(content: string): DiagnosticIssue[] {
  const lines = splitLines(content);
  if ((lines[0] ?? "").trim() !== "---") return [];
  const close = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (close < 0) {
    return [{ code: "DIAG_FRONTMATTER_1", severity: "error", source: "frontmatter", line: 1, message: "frontmatter 未闭合（缺少结束 ---）" }];
  }
  return validateYamlBody(lines.slice(1, close).join("\n"));
}

function validateYamlBody(yamlText: string): DiagnosticIssue[] {
  let parsed: unknown;
  try {
    parsed = parseYaml(yamlText);
  } catch (error) {
    return [{ code: "DIAG_FRONTMATTER_3", severity: "error", source: "frontmatter", line: 1, message: `frontmatter YAML 解析失败：${error instanceof Error ? error.message : String(error)}` }];
  }
  const isMapping = parsed !== null && typeof parsed === "object" && !Array.isArray(parsed);
  if (isMapping) return [];
  return [{ code: "DIAG_FRONTMATTER_2", severity: "warning", source: "frontmatter", line: 1, message: "frontmatter 应为键值对（YAML 映射）" }];
}

/** 图片引用语法诊断：缺地址。 */
export function diagnoseImageRefs(content: string): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = [];
  const lines = splitLines(content);
  const inCode = codeLineMask(lines);
  lines.forEach((line, i) => {
    if (inCode[i]) return;
    for (const match of line.matchAll(IMAGE_REF_RE)) {
      if (imageSrcOf(match[2] ?? "")) continue;
      issues.push({ code: "DIAG_IMAGE_1", severity: "warning", source: "image", line: i + 1, message: "图片缺少地址" });
    }
  });
  return issues;
}

/** 提取文档中全部图片引用（供异步断链校验）。 */
export function findImageRefs(content: string): ImageRef[] {
  const refs: ImageRef[] = [];
  const lines = splitLines(content);
  const inCode = codeLineMask(lines);
  lines.forEach((line, i) => {
    if (inCode[i]) return;
    for (const match of line.matchAll(IMAGE_REF_RE)) {
      const src = imageSrcOf(match[2] ?? "");
      if (src) refs.push({ src, line: i + 1, local: isLocalSrc(src) });
    }
  });
  return refs;
}

function imageSrcOf(raw: string): string {
  return raw.trim().split(/\s+/)[0] ?? "";
}

function isLocalSrc(src: string): boolean {
  return !/^(?:[a-z][a-z0-9+.-]*:|data:|#)/i.test(src);
}

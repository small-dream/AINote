/** 富文本转换「内容损失」静态检测的纯函数：转换确认对话框据此逐项列出将丢失的内容。 */

export type ConversionLoss = "frontmatter" | "callout" | "footnote" | "wikiLink" | "tag";

export const CONVERSION_LOSSES: readonly ConversionLoss[] = ["frontmatter", "callout", "footnote", "wikiLink", "tag"];

/** YAML frontmatter 块（文件头 --- ... ---） */
const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/;

/** Callout / 标注块：`> [!note]` / `> [!warning] 标题` */
const CALLOUT_RE = /^[ \t]*>\s*\[![A-Za-z]+\][^\n]*$/m;

/** 脚注引用 `[^id]` 或脚注定义 `[^id]: ...` */
const FOOTNOTE_RE = /\[\^[^\]\n]+\]/;

/** 双链 `[[目标]]` / `[[目标|别名]]`（与 Rust wiki_service 的扫描约定一致） */
const WIKI_LINK_RE = /\[\[[^\]\n]+\]\]/;

/** `#标签`：# 前为行首或空白，字符集与 Rust wiki_service::is_tag_char 对齐（CJK/字母数字/_/-/） */
function hasTag(content: string): boolean {
  const bytes = content;
  for (let i = 0; i < bytes.length; i += 1) {
    if (bytes.charCodeAt(i) !== 0x23 /* # */) continue;
    if (i > 0 && !isWhitespaceCode(bytes.charCodeAt(i - 1))) continue;
    let end = i + 1;
    while (end < bytes.length && isTagCharCode(bytes.charCodeAt(end))) end += 1;
    if (end > i + 1) return true;
    i = end;
  }
  return false;
}

function isWhitespaceCode(code: number): boolean {
  return code === 0x20 || code === 0x09 || code === 0x0a || code === 0x0d || code === 0x0b || code === 0x0c;
}

function isTagCharCode(code: number): boolean {
  return code >= 0x80 || (code >= 0x30 && code <= 0x39) || (code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a) || code === 0x5f || code === 0x2d || code === 0x2f;
}

/** 静态检测 Markdown 源码转换为富文本后将丢失的内容种类（按固定顺序返回，供 UI 稳定展示）。 */
export function detectConversionLosses(markdown: string): ConversionLoss[] {
  const losses: ConversionLoss[] = [];
  if (FRONTMATTER_RE.test(markdown)) losses.push("frontmatter");
  if (CALLOUT_RE.test(markdown)) losses.push("callout");
  if (FOOTNOTE_RE.test(markdown)) losses.push("footnote");
  if (WIKI_LINK_RE.test(markdown)) losses.push("wikiLink");
  if (hasTag(markdown)) losses.push("tag");
  return losses;
}

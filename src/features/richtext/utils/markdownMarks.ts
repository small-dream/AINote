import { parseWikiLink } from "./wikiLink";

/** markdown-it 内联规则接入的最小结构类型：tiptap-markdown 内部持有 markdown-it 实例，
 *  该包未作为直接依赖暴露类型，故按实际用到的 API 做结构化类型约束。 */

export interface MarkdownToken {
  attrs: [string, string][] | null;
  content: string;
  markup: string;
  info: string;
  attrGet(name: string): string | null;
}

export interface MarkdownInlineState {
  src: string;
  pos: number;
  posMax: number;
  push(type: string, tag: string, nesting: number): MarkdownToken;
}

export type MarkdownInlineRule = (state: MarkdownInlineState, silent: boolean) => boolean;

export type MarkdownRendererRule = (tokens: MarkdownToken[], index: number) => string;

export interface MarkdownItLike {
  inline: { ruler: { before(beforeName: string, ruleName: string, rule: MarkdownInlineRule): void } };
  renderer: { rules: Record<string, MarkdownRendererRule | undefined> };
}

export interface WikiLinkMatch {
  raw: string;
  target: string;
  alias: string | null;
}

export interface TagMatch {
  raw: string;
  tag: string;
}

/** 匹配 `[[目标]]` / `[[目标|别名]]`；内部不允许换行与方括号（与 Rust wiki_service 扫描一致）。 */
export function matchWikiLink(src: string, pos: number): WikiLinkMatch | null {
  if (src.charCodeAt(pos) !== 0x5b /* [ */ || src.charCodeAt(pos + 1) !== 0x5b) return null;
  const close = src.indexOf("]]", pos + 2);
  if (close === -1) return null;
  const inner = src.slice(pos + 2, close);
  if (inner.length === 0 || /[[\]\n\r]/.test(inner)) return null;
  const { target, alias } = parseWikiLink(inner);
  if (!target) return null;
  return { raw: src.slice(pos, close + 2), target, alias };
}

/** 匹配 `#标签`：# 前须为行首或空白（与 Rust wiki_service::tag_prefix_ok 一致），
 *  字符集对齐 is_tag_char（CJK/字母数字/_/-/），保证索引可见的标签转换后同样带 mark。 */
export function matchTag(src: string, pos: number): TagMatch | null {
  if (src.charCodeAt(pos) !== 0x23 /* # */) return null;
  if (pos > 0 && !isWhitespaceCode(src.charCodeAt(pos - 1))) return null;
  let end = pos + 1;
  while (end < src.length && isTagCharCode(src.charCodeAt(end))) end += 1;
  if (end === pos + 1) return null;
  return { raw: src.slice(pos, end), tag: src.slice(pos + 1, end) };
}

function isWhitespaceCode(code: number): boolean {
  return code === 0x20 || code === 0x09 || code === 0x0a || code === 0x0d || code === 0x0b || code === 0x0c;
}

function isTagCharCode(code: number): boolean {
  return code >= 0x80 || (code >= 0x30 && code <= 0x39) || (code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a) || code === 0x5f || code === 0x2d || code === 0x2f;
}

/** HTML 转义（渲染 token 时替代 markdown-it 默认转义，保证属性与文本安全）。 */
export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** 注册 `[[双链]]` 内联规则：渲染为 `<span data-wiki-target ...>`，由 WikiLink.parseHTML 接收为 mark。 */
export function registerWikiLinkMarkdown(markdownit: MarkdownItLike): void {
  markdownit.inline.ruler.before("emphasis", "ainote_wiki_link", (state, silent) => {
    const match = matchWikiLink(state.src, state.pos);
    if (!match || state.pos + match.raw.length > state.posMax) return false;
    if (silent) return true;
    const token = state.push("ainote_wiki_link", "span", 0);
    token.markup = "[[";
    token.content = match.raw;
    token.info = "";
    token.attrs = [["data-wiki-target", match.target]];
    if (match.alias) token.attrs.push(["data-wiki-alias", match.alias]);
    state.pos += match.raw.length;
    return true;
  });
  markdownit.renderer.rules.ainote_wiki_link = (tokens, index) => {
    const token = tokens[index];
    if (!token) return "";
    const target = escapeHtml(token.attrGet("data-wiki-target") ?? "");
    const alias = token.attrGet("data-wiki-alias");
    const aliasAttr = alias ? ` data-wiki-alias="${escapeHtml(alias)}"` : "";
    return `<span data-wiki-target="${target}"${aliasAttr}>${escapeHtml(token.content)}</span>`;
  };
}

/** 注册 `#标签` 内联规则：渲染为 `<span data-tag>`，由 TagMark.parseHTML 接收为 mark。 */
export function registerTagMarkdown(markdownit: MarkdownItLike): void {
  markdownit.inline.ruler.before("emphasis", "ainote_tag", (state, silent) => {
    const match = matchTag(state.src, state.pos);
    if (!match || state.pos + match.raw.length > state.posMax) return false;
    if (silent) return true;
    const token = state.push("ainote_tag", "span", 0);
    token.markup = "#";
    token.content = match.raw;
    token.info = "";
    token.attrs = [["data-tag", match.tag]];
    state.pos += match.raw.length;
    return true;
  });
  markdownit.renderer.rules.ainote_tag = (tokens, index) => {
    const token = tokens[index];
    if (!token) return "";
    const tag = escapeHtml(token.attrGet("data-tag") ?? "");
    return `<span data-tag="${tag}">${escapeHtml(token.content)}</span>`;
  };
}

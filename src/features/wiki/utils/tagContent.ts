import type { NoteKind } from "@/api/types";

/** 从输入中解析标签：去掉 `#`，按空白 / 逗号拆分，去重并小写归一化。 */
export function parseTagInput(value: string): string[] {
  return [...new Set(value
    .split(/[\s,，#]+/u)
    .map((tag) => tag.trim().toLocaleLowerCase())
    .filter(Boolean))];
}

/** 从 Markdown 或富文本 JSON 中提取标签（已去重、小写归一化）。 */
export function extractTagsFromContent(content: string, kind: NoteKind): string[] {
  return kind === "markdown" ? extractMarkdownTags(content) : extractTagsFromRichText(content);
}

/** 判断 Markdown 文本是否已包含某个标签（按 `#tag` 边界匹配）。 */
export function contentHasTag(content: string, tag: string): boolean {
  return new RegExp(`(^|[\\s，。、；])#${escapeRegExp(tag)}(?=$|[\\s，。、；])`, "u").test(content);
}

/** 在笔记末尾追加一个 `#标签`（重复时原样返回）。 */
export function appendTagToContent(content: string, tag: string, kind: NoteKind): string {
  return kind === "markdown" ? appendTagToMarkdown(content, tag) : appendTagToRichText(content, tag);
}

/** 从 Markdown 或富文本 JSON 中移除一个标签；没有匹配时原样返回。 */
export function removeTagFromContent(content: string, tag: string, kind: NoteKind): string {
  return kind === "markdown" ? removeTagFromMarkdown(content, tag) : removeTagFromRichText(content, tag);
}

/** 从 Markdown 中移除一个标签（保留其余正文）。 */
function removeTagFromMarkdown(content: string, tag: string): string {
  const pattern = new RegExp(`[\\t ]?#${escapeRegExp(tag)}(?=$|[\\s，。、；])`, "gu");
  return content.replace(pattern, "");
}

function appendTagToMarkdown(content: string, tag: string): string {
  if (contentHasTag(content, tag)) return content;
  const separator = content.trim().length === 0 ? "" : content.endsWith("\n") ? "\n" : "\n\n";
  return `${content}${separator}#${tag}`;
}

/** 在 TipTap JSON 末尾追加一个标签段落；结构异常时返回原文。 */
function appendTagToRichText(content: string, tag: string): string {
  try {
    const doc = JSON.parse(content) as RichTextDoc;
    const nodes = doc.content ?? [];
    if (richTextHasTag(nodes, tag)) return content;
    return JSON.stringify({
      ...doc,
      content: [...nodes, { type: "paragraph", content: [{ type: "text", text: `#${tag}` }] }],
    });
  } catch {
    return content;
  }
}

function extractMarkdownTags(content: string): string[] {
  return [...extractInlineTags(content)];
}

function extractTagsFromRichText(content: string): string[] {
  try {
    const doc = JSON.parse(content) as RichTextDoc;
    const tags = new Set<string>();
    collectTags(doc.content ?? [], tags);
    return [...tags];
  } catch {
    return [];
  }
}

function extractInlineTags(value: string): Set<string> {
  const matches = value.matchAll(/(?:^|[\s，。、；])#([^\s#，。、；]+)/gu);
  return new Set([...matches].map((match) => (match[1] ?? "").toLocaleLowerCase()));
}

function collectTags(nodes: RichTextNode[], tags: Set<string>): void {
  for (const node of nodes) {
    if (node.type === "text" && typeof node.text === "string") {
      for (const tag of extractInlineTags(node.text)) tags.add(tag);
      continue;
    }
    if (node.content) collectTags(node.content, tags);
  }
}

function richTextHasTag(nodes: RichTextNode[], tag: string): boolean {
  return nodes.some((node) =>
    node.type === "text" && typeof node.text === "string"
      ? node.text.toLocaleLowerCase().includes(`#${tag}`)
      : richTextHasTag(node.content ?? [], tag),
  );
}

function removeTagFromRichText(content: string, tag: string): string {
  try {
    const doc = JSON.parse(content) as RichTextDoc;
    return JSON.stringify({ ...doc, content: removeTagNodes(doc.content ?? [], tag) });
  } catch {
    return content;
  }
}

function removeTagNodes(nodes: RichTextNode[], tag: string): RichTextNode[] {
  return nodes.flatMap((node) => {
    if (node.type === "text" && typeof node.text === "string" && node.text.toLocaleLowerCase().includes(`#${tag}`)) {
      const next = node.text.replace(new RegExp(`[\\t ]?#${escapeRegExp(tag)}(?=$|[\\s，。、；])`, "igu"), "");
      return next.trim().length === 0 ? [] : [{ ...node, text: next }];
    }
    if (!node.content) return [node];
    if (!node.content) return [node];
    return [{ ...node, content: removeTagNodes(node.content, tag) }];
  }).filter((node) => node.type !== "paragraph" || (node.content?.length ?? 0) > 0);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface RichTextDoc {
  type?: string;
  content?: RichTextNode[];
}

interface RichTextNode {
  type?: string;
  text?: string;
  content?: RichTextNode[];
}

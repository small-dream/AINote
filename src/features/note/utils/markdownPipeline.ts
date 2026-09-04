import type { Root, Paragraph, Text } from "mdast";
import { parse as parseYaml } from "yaml";

export type CalloutKind = "note" | "tip" | "important" | "warning" | "caution" | "danger";

export interface FrontmatterField {
  key: string;
  value: string;
}

export interface MarkdownDocument {
  frontmatter: FrontmatterField[];
}

/** 提取文档开头的 YAML frontmatter；解析失败时保留正文并忽略属性展示。 */
export function parseMarkdownDocument(source: string): MarkdownDocument {
  const match = /^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/.exec(source);
  if (!match) return { frontmatter: [] };
  try {
    const parsed: unknown = parseYaml(match[1] ?? "");
    return { frontmatter: toFields(parsed) };
  } catch {
    return { frontmatter: [] };
  }
}

function toFields(value: unknown): FrontmatterField[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => {
    if (item === null || ["string", "number", "boolean"].includes(typeof item)) {
      return [{ key, value: String(item ?? "") }];
    }
    if (Array.isArray(item) && item.every((entry) => ["string", "number", "boolean"].includes(typeof entry))) {
      return [{ key, value: item.join(", ") }];
    }
    return [];
  });
}

/** 将标准 Markdown callout blockquote 标记转换为可识别的节点数据。 */
export const remarkCallouts = () => (tree: Root): void => {
  for (const node of tree.children) markCallout(node);
};

/** Frontmatter 只作为 Properties 展示，不进入正文渲染，且保留其余节点行号。 */
export const remarkRemoveFrontmatter = () => (tree: Root): void => {
  tree.children = tree.children.filter((node) => node.type !== "yaml");
};

function markCallout(node: Root["children"][number]): void {
  if (node.type !== "blockquote") return;
  const first = node.children[0];
  if (!first || first.type !== "paragraph") return;
  const marker = getMarker(first);
  if (!marker) return;
  const data = (node.data ??= {}) as Record<string, unknown>;
  data.hProperties = { "data-callout": marker.kind };
  first.children = removeMarker(first.children);
}

function getMarker(paragraph: Paragraph): { kind: CalloutKind } | null {
  const first = paragraph.children[0];
  if (!first || first.type !== "text") return null;
  const match = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|DANGER)\]\s*/i.exec(first.value);
  if (!match) return null;
  return { kind: (match[1] ?? "note").toLocaleLowerCase() as CalloutKind };
}

function removeMarker(children: Paragraph["children"]): Paragraph["children"] {
  const first = children[0];
  if (!first || first.type !== "text") return children;
  const value = first.value.replace(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|DANGER)\]\s*/i, "");
  if (!value) return children.slice(1);
  return [{ ...(first as Text), value }, ...children.slice(1)];
}

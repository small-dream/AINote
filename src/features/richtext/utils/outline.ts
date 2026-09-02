import type { JSONContent } from "@tiptap/core";
import type { OutlineItem } from "@/features/note/utils/outline";
import { slugifyHeading } from "@/features/note/utils/preview";

/** 从 TipTap 文档 JSON 提取标题大纲；line 为标题在文档中的序号，用于 DOM 定位。 */
export function extractRichTextOutline(doc: JSONContent): OutlineItem[] {
  const items: OutlineItem[] = [];
  const ids = new Map<string, number>();
  let index = 0;
  const visit = (node: JSONContent): void => {
    if (node.type === "heading") {
      const text = nodeText(node);
      if (text) {
        const base = slugifyHeading(text);
        const count = ids.get(base) ?? 0;
        ids.set(base, count + 1);
        items.push({ id: count === 0 ? base : `${base}-${count + 1}`, text, level: headingLevel(node), line: index });
        index += 1;
      }
    }
    for (const child of node.content ?? []) visit(child);
  };
  visit(doc);
  return items;
}

function headingLevel(node: JSONContent): number {
  const level = node.attrs?.level;
  return typeof level === "number" && level >= 1 && level <= 6 ? level : 1;
}

function nodeText(node: JSONContent): string {
  if (node.text) return node.text;
  return (node.content ?? []).map(nodeText).join("");
}

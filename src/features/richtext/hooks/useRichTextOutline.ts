import { useMemo } from "react";
import type { OutlineItem } from "@/features/note/utils/outline";
import { parseRichTextContent } from "../utils/richText";
import { extractRichTextOutline } from "../utils/outline";

/** 富文本大纲：从序列化文档派生标题树。
 * 编辑器内编辑经 onUpdate → onChange 同步回 content；首次加载、标题同步与历史恢复
 * 走 setContent(emitUpdate:false) 时 content 也已是新值，因此统一以 content 为准。 */
export function useRichTextOutline(content: string): OutlineItem[] {
  return useMemo(() => extractRichTextOutline(parseRichTextContent(content)), [content]);
}

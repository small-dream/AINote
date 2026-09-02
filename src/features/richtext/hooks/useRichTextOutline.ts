import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/core";
import type { OutlineItem } from "@/features/note/utils/outline";
import { extractRichTextOutline } from "../utils/outline";

/** 富文本大纲：监听 TipTap 更新事件，实时提取标题目录。 */
export function useRichTextOutline(editor: Editor | null): OutlineItem[] {
  const [outline, setOutline] = useState<OutlineItem[]>(() => (editor ? extractRichTextOutline(editor.getJSON()) : []));
  useEffect(() => {
    if (!editor) return;
    const refresh = () => setOutline(extractRichTextOutline(editor.getJSON()));
    refresh();
    editor.on("update", refresh);
    return () => { editor.off("update", refresh); };
  }, [editor]);
  return outline;
}

import type { JSONContent } from "@tiptap/core";

/** 语音结果必须是纯文本：只生成 text/hardBreak 节点，禁止把转录内容按 HTML 解析。 */
export function voiceTextContent(text: string): JSONContent[] {
  if (text.length === 0) return [];
  const lines = text.split("\n");
  return lines.flatMap((line, index) => {
    const nodes: JSONContent[] = line ? [{ type: "text", text: line }] : [];
    if (index < lines.length - 1) nodes.push({ type: "hardBreak" });
    return nodes;
  });
}

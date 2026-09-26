import type { ChainedCommands, Editor } from "@tiptap/core";
import type { Mark } from "@tiptap/pm/model";
import type { EditorState } from "@tiptap/pm/state";

/** 格式刷可复制的行内 mark 白名单：链接 / 双链 / 标签是内容语义，复制过去会改变含义，不参与复制。 */
export const COPYABLE_MARKS = ["bold", "italic", "strike", "code", "fontStyle", "sizeStyle", "fgStyle", "markStyle"] as const;

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface CopiedMark {
  type: string;
  attrs: Record<string, unknown>;
}

/** 块级格式只复制「正文 / 标题级别」：列表、引用、代码块是结构而非格式，不参与复制。 */
export type CopiedBlockFormat = { type: "heading"; level: HeadingLevel } | { type: "paragraph" };

export interface CopiedFormat {
  marks: CopiedMark[];
  block: CopiedBlockFormat;
}

/** 采集当前光标 / 选区的格式，供之后刷到目标选区。 */
export function captureFormat(state: EditorState): CopiedFormat {
  return { marks: captureMarks(state), block: captureBlockFormat(state) };
}

/** 把采集到的格式套用到当前选区：只清掉白名单内的 mark，链接 / 双链 / 标签保持原样。 */
export function applyFormat(editor: Editor, format: CopiedFormat): void {
  const chain = editor.chain().focus();
  for (const name of COPYABLE_MARKS) chain.unsetMark(name);
  for (const mark of format.marks) chain.setMark(mark.type, mark.attrs);
  applyBlockFormat(chain, format.block);
  void chain.run();
}

function captureMarks(state: EditorState): CopiedMark[] {
  return selectionMarks(state)
    .filter((mark) => (COPYABLE_MARKS as readonly string[]).includes(mark.type.name))
    .map((mark) => ({ type: mark.type.name, attrs: { ...mark.attrs } }));
}

function selectionMarks(state: EditorState): readonly Mark[] {
  const { from, to, $from } = state.selection;
  if (from === to) return state.storedMarks ?? $from.marks();
  return firstTextMarks(state, from, to) ?? $from.marks();
}

/** 取选区起点第一个文字节点的 mark：选区起点落在文字边界上时 `$from.marks()` 会回落到
 *  前一个字符，与用户看到的起点不一致（选中粗体开头却复制到「无格式」）。 */
function firstTextMarks(state: EditorState, from: number, to: number): readonly Mark[] | null {
  let marks: readonly Mark[] | null = null;
  state.doc.nodesBetween(from, to, (node) => {
    if (marks !== null) return false;
    if (!node.isText) return true;
    marks = node.marks;
    return false;
  });
  return marks;
}

function captureBlockFormat(state: EditorState): CopiedBlockFormat {
  const parent = state.selection.$from.parent;
  if (parent.type.name !== "heading") return { type: "paragraph" };
  const level = parent.attrs.level;
  return { type: "heading", level: isHeadingLevel(level) ? level : 1 };
}

function isHeadingLevel(value: unknown): value is HeadingLevel {
  return typeof value === "number" && value >= 1 && value <= 6;
}

function applyBlockFormat(chain: ChainedCommands, block: CopiedBlockFormat): void {
  if (block.type === "heading") chain.setHeading({ level: block.level });
  else chain.setParagraph();
}

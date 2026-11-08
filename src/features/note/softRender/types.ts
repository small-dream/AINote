export type WidgetKind =
  | "checkbox" | "image" | "hr" | "table" | "bullet" | "number"
  | "codeblock" | "codeblock-edit-header" | "codeblock-edit-scrollbar" | "mermaid" | "math";

export interface MarkRange {
  from: number;
  to: number;
  cls: string;
  /** 附加到标记 DOM 的属性（如链接 href、双链目标） */
  attrs?: Record<string, string>;
}

export interface HideRange {
  from: number;
  to: number;
  /** true = 光标位于元素内，显示原始标记（淡显）；false = 隐藏 */
  reveal: boolean;
}

export interface WidgetRange {
  kind: WidgetKind;
  from: number;
  to: number;
  /** checkbox: 勾选状态；image/table: 源内容 */
  value?: string;
  checked?: boolean;
  /** 图片 alt 文本 */
  alt?: string;
  /** 点击 widget 进入编辑时首选的光标落点（代码块落到正文首行） */
  caret?: number;
  /** 编辑态顶栏收起代码块时应落到源码区间末尾之后。 */
  blockTo?: number;
  /** 围栏语言节点的可替换范围；无 CodeInfo 时只在 languageInsertAt 插入。 */
  languageFrom?: number;
  languageTo?: number;
  languageInsertAt?: number;
  /** ordered 列表序号 */
  index?: number;
  /** math 模式：inline / block */
  mode?: "inline" | "block";
}

export interface BlockRange {
  from: number;
  to: number;
  cls: string;
}

/** 块级间距：把源码空行收窄到预览的块边距高度，避免 softRender 间距被放大。 */
export interface GapRange {
  /** 空行起始偏移（源码坐标） */
  pos: number;
  /** 应用到所在 .cm-line 的类名 */
  cls: string;
}

export interface TextRange {
  from: number;
  to: number;
}

export interface SoftRenderPlan {
  marks: MarkRange[];
  hides: HideRange[];
  widgets: WidgetRange[];
  blocks: BlockRange[];
  gaps: GapRange[];
  wikiRanges: TextRange[];
  mathRanges: TextRange[];
}

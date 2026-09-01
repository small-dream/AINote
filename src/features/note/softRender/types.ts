export type WidgetKind = "checkbox" | "image" | "hr" | "table" | "bullet" | "number" | "codeblock" | "mermaid" | "math";

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

export interface TextRange {
  from: number;
  to: number;
}

export interface SoftRenderPlan {
  marks: MarkRange[];
  hides: HideRange[];
  widgets: WidgetRange[];
  blocks: BlockRange[];
  wikiRanges: TextRange[];
  mathRanges: TextRange[];
}

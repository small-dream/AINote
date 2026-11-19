import { WidgetType } from "@codemirror/view";
import { markRange } from "./block";

/** 圆点字形 → 嵌套层级（与 blocks.ts 的 • / ◦ / ▪ 对应）。 */
const BULLET_LEVEL: Record<string, number> = { "•": 0, "◦": 1, "▪": 2 };

/** 无序列表圆点 */
export class BulletWidget extends WidgetType {
  constructor(readonly from: number, readonly to: number, readonly glyph = "•") {
    super();
  }

  eq(other: BulletWidget): boolean {
    return other instanceof BulletWidget && other.from === this.from && other.to === this.to && other.glyph === this.glyph;
  }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-sr-bullet";
    // 放大圆点的 transform 必须落在内层 dot 上：CodeMirror 取 widget 根节点的
    // getBoundingClientRect 作为「光标停在列表标记处」的几何，根节点一旦被 scale
    // 撑高到行高的 1.7 倍，光标就会比行盒高一截并压到相邻行。
    const dot = document.createElement("span");
    // 只有实心圆点需要放大到浏览器 disc 的视觉大小；空心圈/方块放大后会糊成实心。
    dot.className = `cm-sr-bullet-dot cm-sr-bullet-dot-${BULLET_LEVEL[this.glyph] ?? 0}`;
    dot.textContent = this.glyph;
    span.appendChild(dot);
    markRange(span, this.from, this.to);
    return span;
  }
}

type NumberFormat = "decimal" | "lower-roman" | "lower-alpha";

/** 有序列表序号 */
export class NumberWidget extends WidgetType {
  constructor(
    readonly from: number,
    readonly to: number,
    readonly index: number,
    readonly format: NumberFormat = "decimal",
  ) {
    super();
  }

  eq(other: NumberWidget): boolean {
    return (
      other instanceof NumberWidget &&
      other.from === this.from &&
      other.to === this.to &&
      other.index === this.index &&
      other.format === this.format
    );
  }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-sr-number";
    span.textContent = `${formatIndex(this.index, this.format)}.`;
    markRange(span, this.from, this.to);
    return span;
  }
}

/** 与浏览器 / GitHub 的 lower-roman、lower-alpha 标记一致。 */
function formatIndex(index: number, format: NumberFormat): string {
  if (format === "lower-alpha") return toAlpha(index);
  if (format === "lower-roman") return toRoman(index);
  return String(index);
}

function toAlpha(index: number): string {
  let value = Math.max(1, index);
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(97 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function toRoman(index: number): string {
  let value = Math.max(1, Math.min(3999, index));
  const table: ReadonlyArray<[number, string]> = [
    [1000, "m"], [900, "cm"], [500, "d"], [400, "cd"],
    [100, "c"], [90, "xc"], [50, "l"], [40, "xl"],
    [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"],
  ];
  let result = "";
  for (const [amount, glyph] of table) {
    while (value >= amount) {
      result += glyph;
      value -= amount;
    }
  }
  return result;
}

/** 脚注引用：整段 `[^label]` 替换为按首次引用顺序编号的 `[n]`。 */
export class FootnoteRefWidget extends WidgetType {
  constructor(readonly from: number, readonly to: number, readonly index: number) {
    super();
  }

  eq(other: FootnoteRefWidget): boolean {
    return other instanceof FootnoteRefWidget && other.from === this.from && other.to === this.to && other.index === this.index;
  }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-sr-footnote-ref";
    span.textContent = `[${this.index}]`;
    markRange(span, this.from, this.to);
    return span;
  }
}

/** 脚注定义标记：`[^label]: ` 替换为与引用一致的序号（无引用时退回原标签）。 */
export class FootnoteDefWidget extends WidgetType {
  constructor(readonly from: number, readonly to: number, readonly label: string) {
    super();
  }

  eq(other: FootnoteDefWidget): boolean {
    return other instanceof FootnoteDefWidget && other.from === this.from && other.to === this.to && other.label === this.label;
  }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-sr-footnote-label";
    span.textContent = `${this.label}.`;
    markRange(span, this.from, this.to);
    return span;
  }
}

/** 任务勾选框：点击经 data-sr-from 反查源码并切换 [ ]/[x] */
export class CheckboxWidget extends WidgetType {
  constructor(readonly from: number, readonly checked: boolean) {
    super();
  }

  eq(other: CheckboxWidget): boolean {
    return other instanceof CheckboxWidget && other.from === this.from && other.checked === this.checked;
  }

  ignoreEvent(): boolean {
    return false;
  }

  toDOM(): HTMLElement {
    const input = document.createElement("input");
    input.type = "checkbox";
    // note-task-check：与富文本编辑器、只读预览共用的勾选框绘制
    input.className = "cm-sr-checkbox note-task-check";
    input.checked = this.checked;
    input.tabIndex = -1;
    input.dataset.srFrom = String(this.from);
    return input;
  }
}

/** 图片：仓库相对路径已在插件层解析为本地可访问 URL；加载失败时回退显示源码。 */
export class ImageWidget extends WidgetType {
  constructor(readonly src: string, readonly alt: string, readonly from: number, readonly to: number) {
    super();
  }

  eq(other: ImageWidget): boolean {
    return (
      other instanceof ImageWidget &&
      other.src === this.src &&
      other.alt === this.alt &&
      other.from === this.from &&
      other.to === this.to
    );
  }

  ignoreEvent(): boolean {
    return false;
  }

  toDOM(): HTMLElement {
    const wrapper = document.createElement("span");
    wrapper.className = "cm-sr-image";
    const img = document.createElement("img");
    img.src = this.src;
    img.alt = this.alt;
    img.loading = "lazy";
    img.addEventListener("error", () => showImageFallback(wrapper, this.alt, this.src));
    wrapper.appendChild(img);
    markRange(wrapper, this.from, this.to);
    return wrapper;
  }
}

function showImageFallback(wrapper: HTMLElement, alt: string, src: string): void {
  wrapper.replaceChildren();
  const fallback = document.createElement("code");
  fallback.className = "cm-sr-image-fallback";
  fallback.textContent = `![${alt}](${src})`;
  wrapper.appendChild(fallback);
}

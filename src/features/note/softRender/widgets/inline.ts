import { WidgetType } from "@codemirror/view";
import { markRange } from "./block";

/** 无序列表圆点 */
export class BulletWidget extends WidgetType {
  constructor(readonly from: number, readonly to: number) {
    super();
  }

  eq(other: BulletWidget): boolean {
    return other instanceof BulletWidget && other.from === this.from && other.to === this.to;
  }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-sr-bullet";
    span.textContent = "•";
    markRange(span, this.from, this.to);
    return span;
  }
}

/** 有序列表序号 */
export class NumberWidget extends WidgetType {
  constructor(readonly from: number, readonly to: number, readonly index: number) {
    super();
  }

  eq(other: NumberWidget): boolean {
    return (
      other instanceof NumberWidget &&
      other.from === this.from &&
      other.to === this.to &&
      other.index === this.index
    );
  }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-sr-number";
    span.textContent = `${this.index}.`;
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
    input.className = "cm-sr-checkbox";
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

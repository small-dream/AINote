import { EditorView, WidgetType } from "@codemirror/view";
import { createRoot, type Root } from "react-dom/client";
import { CodeBlockToolbar } from "@/features/code-block/components/CodeBlockToolbar";
import { translate } from "@/i18n";
import { useUiStore } from "@/stores/ui.store";
import { attachEditCodeBlockScrollbar } from "../utils/editCodeBlockScrollbar";

const headerRoots = new WeakMap<HTMLElement, Root>();
const scrollbarCleanups = new WeakMap<HTMLElement, () => void>();

interface HeaderOptions {
  source: string;
  language: string;
  blockTo: number;
  languageFrom?: number | undefined;
  languageTo?: number | undefined;
  languageInsertAt?: number | undefined;
}

/** 编辑态顶部工具栏：语言、复制与收起按钮不进入文档内容。 */
export class CodeBlockEditHeaderWidget extends WidgetType {
  constructor(readonly options: HeaderOptions) {
    super();
  }

  eq(other: CodeBlockEditHeaderWidget): boolean {
    return other instanceof CodeBlockEditHeaderWidget &&
      other.options.source === this.options.source &&
      other.options.language === this.options.language &&
      other.options.blockTo === this.options.blockTo &&
      other.options.languageFrom === this.options.languageFrom &&
      other.options.languageTo === this.options.languageTo &&
      other.options.languageInsertAt === this.options.languageInsertAt;
  }

  override get estimatedHeight(): number {
    return 41;
  }

  ignoreEvent(): boolean {
    return true;
  }

  toDOM(view: EditorView): HTMLElement {
    const host = document.createElement("div");
    host.className = "cm-sr-codeblock-header";
    host.dataset.codeControl = "";
    host.setAttribute("contenteditable", "false");
    const root = createRoot(host);
    headerRoots.set(host, root);
    queueMicrotask(() => root.render(
      <CodeBlockToolbar language={this.options.language} source={this.options.source} toggleKind="collapse"
        onLanguageChange={(language) => changeLanguage(view, this.options, language)}
        onToggle={() => collapseCodeBlock(view, this.options.blockTo)} />,
    ));
    return host;
  }

  destroy(dom: HTMLElement): void {
    const root = headerRoots.get(dom);
    headerRoots.delete(dom);
    queueMicrotask(() => root?.unmount());
  }
}

function changeLanguage(view: EditorView, options: HeaderOptions, language: string): void {
  const from = options.languageFrom ?? options.languageInsertAt;
  if (from === undefined) return;
  const to = options.languageTo ?? from;
  view.dispatch({ changes: { from, to, insert: language } });
}

function collapseCodeBlock(view: EditorView, blockTo: number): void {
  const anchor = Math.min(view.state.doc.length, blockTo + 1);
  // 等按钮的 pointer/click 事件走完再移出代码块；否则 CodeMirror 的点击定位
  // 会在同一次事件里把光标放回 widget 内部，块看起来收不起来。
  setTimeout(() => {
    if (view.dom.isConnected) view.dispatch({ selection: { anchor } });
  }, 0);
}

/** 编辑态底部横向滚动条：所有代码行共用同一滚动位置。 */
export class CodeBlockEditScrollbarWidget extends WidgetType {
  constructor(readonly from: number, readonly to: number) {
    super();
  }

  eq(other: CodeBlockEditScrollbarWidget): boolean {
    return other instanceof CodeBlockEditScrollbarWidget && other.from === this.from && other.to === this.to;
  }

  override get estimatedHeight(): number {
    return 30;
  }

  ignoreEvent(): boolean {
    return true;
  }

  toDOM(view: EditorView): HTMLElement {
    const host = document.createElement("div");
    host.className = "cm-sr-codeblock-footer";
    host.dataset.codeControl = "";
    host.setAttribute("contenteditable", "false");
    const track = document.createElement("div");
    track.className = "note-code-scrollbar cm-sr-codeblock-footer-track";
    track.tabIndex = 0;
    track.setAttribute("role", "scrollbar");
    track.setAttribute("aria-orientation", "horizontal");
    track.setAttribute("aria-label", translate(useUiStore.getState().locale, "note.codeBlock"));
    const thumb = document.createElement("div");
    thumb.className = "note-code-scrollbar-thumb";
    track.append(thumb);
    host.append(track);
    scrollbarCleanups.set(host, attachEditCodeBlockScrollbar(track, thumb, view));
    return host;
  }

  destroy(dom: HTMLElement): void {
    scrollbarCleanups.get(dom)?.();
    scrollbarCleanups.delete(dom);
  }
}

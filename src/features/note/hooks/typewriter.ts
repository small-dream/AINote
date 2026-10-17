import type { Extension } from "@codemirror/state";
import { EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";

/** 打字机滚动：只在文档内容变化且无选区时把新光标行保持在视口中央。 */
export function typewriterScroll(): Extension {
  return ViewPlugin.fromClass(class {
    private frame: number | null = null;

    update(update: ViewUpdate): void {
      if (!update.docChanged || !update.state.selection.main.empty) return;
      const head = update.state.selection.main.head;
      this.cancel();
      this.frame = requestAnimationFrame(() => {
        this.frame = null;
        if (!update.view.dom.isConnected) return;
        update.view.dispatch({ effects: EditorView.scrollIntoView(head, { y: "center" }) });
      });
    }

    destroy(): void {
      this.cancel();
    }

    private cancel(): void {
      if (this.frame !== null) cancelAnimationFrame(this.frame);
      this.frame = null;
    }
  });
}

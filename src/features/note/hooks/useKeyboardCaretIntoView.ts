import { useEffect } from "react";
import { EditorView } from "@codemirror/view";
import { observeKeyboardInset } from "@/platform/keyboard-inset";

/**
 * 键盘弹起后把光标滚回可视区。
 *
 * 移动壳把可视高度收到键盘上方，CodeMirror 的滚动容器随之变矮；此时需要重新测量，
 * 并在同一帧内把当前光标滚进可视区，否则在文章底部编辑时仍会停在键盘后面。
 * 桌面端（`enabled=false`）不订阅，行为不变。
 */
export function useKeyboardCaretIntoView(view: EditorView | null, enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !view) return undefined;
    let frame = 0;
    const stop = observeKeyboardInset((inset) => {
      if (inset <= 0 || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        view.requestMeasure();
        view.dispatch({ effects: EditorView.scrollIntoView(view.state.selection.main.head, { y: "nearest" }) });
      });
    });
    return () => {
      stop();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [enabled, view]);
}

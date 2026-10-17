import { useEffect, type RefObject } from "react";
import { EditorView } from "@codemirror/view";
import { useTranslation } from "@/i18n";
import { useSessionStore, type NoteNavigationTarget } from "@/stores/session.store";
import { useToastStore } from "@/stores/toast.store";
import { markdownNavigationLine } from "../utils/navigation";

interface Options {
  kind: "markdown" | "richText";
  loaded: boolean;
  navigationTarget: NoteNavigationTarget | null;
  navigationNonce: number;
  notePath: string | null;
  readyView: EditorView | null;
  viewRef: RefObject<EditorView | null>;
  draft: string;
}

/** Markdown 跨笔记定位：显式行号优先、标题兜底，找不到标题时提示并留在顶部。 */
export function useMarkdownNavigation(options: Options): void {
  const { kind, loaded, navigationTarget, navigationNonce, notePath, readyView, viewRef, draft } = options;
  const { t } = useTranslation();
  useEffect(() => {
    if (kind !== "markdown" || !loaded || !navigationTarget || navigationTarget.path !== notePath) return;
    const view = readyView ?? viewRef.current;
    if (!view) return;
    const lineNumber = markdownNavigationLine(draft, navigationTarget);
    if (lineNumber) {
      const line = view.state.doc.line(Math.min(Math.max(lineNumber, 1), view.state.doc.lines));
      view.dispatch({ selection: { anchor: line.from }, effects: EditorView.scrollIntoView(line.from, { y: "center" }) });
      view.focus();
    } else if (navigationTarget.heading) {
      useToastStore.getState().push(t("wiki.headingMissing", { heading: navigationTarget.heading }), "info");
    }
    useSessionStore.getState().clearNavigation(navigationNonce);
  }, [kind, loaded, navigationTarget, navigationNonce, notePath, readyView, viewRef, draft, t]);
}

import { useCallback, useEffect } from "react";
import { useSessionStore } from "@/stores/session.store";

/** 笔记导航历史：返回/前进前先保存草稿，并监听 Mod-[ / Mod-]。 */
export function useNoteNavigationHistory(flush: () => Promise<void>, enabled = true) {
  const canGoBack = useSessionStore((state) => state.noteHistoryIndex > 0);
  const canGoForward = useSessionStore((state) => state.noteHistoryIndex < state.noteHistory.length - 1);

  const go = useCallback(async (direction: "back" | "forward") => {
    if (direction === "back" ? !canGoBack : !canGoForward) return;
    await flush().catch(() => undefined);
    const store = useSessionStore.getState();
    if (direction === "back") store.goBackNote();
    else store.goForwardNote();
  }, [canGoBack, canGoForward, flush]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!enabled) return;
      if (event.defaultPrevented || (!event.metaKey && !event.ctrlKey) || event.shiftKey || event.altKey) return;
      if (event.key !== "[" && event.key !== "]") return;
      event.preventDefault();
      void go(event.key === "[" ? "back" : "forward");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, go]);

  return {
    canGoBack,
    canGoForward,
    goBack: useCallback(() => void go("back"), [go]),
    goForward: useCallback(() => void go("forward"), [go]),
  };
}

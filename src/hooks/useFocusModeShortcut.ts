import { useEffect } from "react";
import { useUiStore } from "@/stores/ui.store";

/** 全局 Mod-Shift-F：切换专注模式（编辑器内外一致）。 */
export function useFocusModeShortcut(): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || (!event.metaKey && !event.ctrlKey) || !event.shiftKey || event.altKey) return;
      if (event.key.toLowerCase() !== "f") return;
      event.preventDefault();
      useUiStore.getState().toggleFocusMode();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

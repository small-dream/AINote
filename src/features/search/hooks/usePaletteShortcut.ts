import { useEffect } from "react";
import { useCommandPaletteStore } from "@/stores/command-palette.store";

/** 全局 Cmd+K / Ctrl+K 快捷键：打开/关闭命令面板 */
export function usePaletteShortcut() {
  const togglePalette = useCommandPaletteStore((state) => state.togglePalette);
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        togglePalette();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [togglePalette]);
}

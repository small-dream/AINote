import { useEffect } from "react";
import { applyKeyboardInset } from "@/platform/keyboard-inset";

/**
 * 移动壳挂载期间把软键盘遮挡高度同步到 `--kb-inset`。
 *
 * Android 壳在 edge-to-edge 下不会因键盘缩小窗口（见 `platform/keyboard-inset`），
 * 壳高度必须自己收缩到键盘上方，编辑器滚动容器和光标跟随才有正确的可视高度。
 */
export function useMobileKeyboardInsets(): void {
  useEffect(() => applyKeyboardInset(), []);
}

import type { ViewMode } from "../components/EditorToolbar";

/**
 * 把偏好中的视图模式映射到当前布局真正可用的模式：
 * 窄屏（移动端单栏）用「源码」替代「分栏」，宽屏反之，避免出现无法高亮的模式。
 */
export function resolveViewMode(mode: ViewMode, compact: boolean): ViewMode {
  if (compact) return mode === "split" ? "source" : mode;
  return mode === "source" ? "split" : mode;
}

/** 源码编辑（含分栏左侧）不启用软渲染。 */
export function usesSoftRender(mode: ViewMode): boolean {
  return mode !== "split" && mode !== "source";
}

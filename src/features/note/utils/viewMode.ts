import type { ViewMode } from "../components/EditorToolbar";

/**
 * 把偏好中的视图模式映射到当前布局真正可用的模式：
 * 窄屏（移动端单栏）没有分栏空间，用「源码」替代「分栏」；
 * 宽屏保留全部四种模式，「源码」是纯源码单栏（与 Typora/Obsidian 一致），不再强制映射为分栏。
 */
export function resolveViewMode(mode: ViewMode, compact: boolean): ViewMode {
  if (compact) return mode === "split" ? "source" : mode;
  return mode;
}

/** 源码编辑（含分栏左侧）不启用软渲染。 */
export function usesSoftRender(mode: ViewMode): boolean {
  return mode !== "split" && mode !== "source";
}

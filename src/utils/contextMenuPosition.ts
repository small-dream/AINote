import type { ContextMenuPoint } from "@/components/molecules/EditorContextMenu";

const VIEWPORT_MARGIN = 8;
const ITEM_HEIGHT = 33;
const ITEM_SEPARATOR_HEIGHT = 15;
const MENU_PADDING = 8;

/** 右键菜单贴边时不溢出：优先跟随点击点，越界时向视口内收敛 */
export function clampContextMenuPosition(point: ContextMenuPoint, width: number, height: number): ContextMenuPoint {
  const maxWidth = Math.max(globalThis.innerWidth - VIEWPORT_MARGIN, VIEWPORT_MARGIN);
  const maxHeight = Math.max(globalThis.innerHeight - VIEWPORT_MARGIN, VIEWPORT_MARGIN);
  return {
    x: Math.min(Math.max(point.x, VIEWPORT_MARGIN), Math.max(VIEWPORT_MARGIN, maxWidth - width)),
    y: Math.min(Math.max(point.y, VIEWPORT_MARGIN), Math.max(VIEWPORT_MARGIN, maxHeight - height)),
  };
}

/** 用稳定的估算高度先 clamp，避免菜单先在越界位置闪现 */
export function estimateContextMenuHeight(items: readonly unknown[]): number {
  const separatorCount = items.filter((item) => typeof item === "object" && item !== null && "kind" in item).length;
  return MENU_PADDING + (items.length - separatorCount) * ITEM_HEIGHT + separatorCount * ITEM_SEPARATOR_HEIGHT;
}

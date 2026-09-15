import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { useBackHandler } from "@/platform/back-navigation";
import { markFloatingLayerOpen } from "./floatingLayer";

interface UseAnchoredLayerOptions {
  /** 触发按钮的包裹元素，菜单以它为锚点 */
  triggerRef: RefObject<HTMLElement | null>;
  open: boolean;
  close: () => void;
  /** 菜单宽度（px），用于水平翻转与视口钳制 */
  width: number;
  /** 首选对齐：end 让菜单右缘对齐按钮右缘，start 让左缘对齐 */
  align?: "start" | "end";
  /** 菜单与视口的留白 */
  margin?: number;
}

/** 弹窗内限高下限：再矮就难以操作，交由内部滚动兜底 */
const MIN_MENU_HEIGHT = 132;

/** 浮层所在的模态容器；无弹窗时返回 null，退化为视口边界 */
function dialogBounds(trigger: HTMLElement): DOMRect | null {
  return trigger.closest('[role="dialog"]')?.getBoundingClientRect() ?? null;
}

export interface LayerPlacementInput {
  /** 锚点（触发元素）在视口中的位置 */
  trigger: { left: number; right: number; top: number; bottom: number };
  /** 模态容器边界（仅用于水平收边）；null 表示按视口 */
  boundary: { left: number; right: number } | null;
  viewport: { width: number; height: number };
  menuWidth: number;
  /** 菜单自然高度（scrollHeight）；0 表示尚未测量 */
  naturalHeight: number;
  align: "start" | "end";
  margin: number;
}

export interface LayerPlacement {
  position: CSSProperties;
  /** 弹窗内空间不足时的可用高度；null 表示不限高 */
  maxHeight: number | null;
}

/**
 * 纯函数：把锚点、边界与视口换算成浮层的 fixed 定位与限高。
 * 规则：水平方向在边界内收边；纵向优先完整显示（下方不够就向上展开，
 * 这样弹窗里的浮层不会压住弹窗底部操作区），两侧都放不下时才限高并内部滚动。
 */
export function resolveLayerPlacement({ trigger, boundary, viewport, menuWidth, naturalHeight, align, margin }: LayerPlacementInput): LayerPlacement {
  const leftBound = (boundary?.left ?? 0) + margin;
  const rightBound = (boundary?.right ?? viewport.width) - margin;
  const preferredLeft = align === "end" ? trigger.right - menuWidth : trigger.left;
  const left = Math.min(Math.max(preferredLeft, leftBound), Math.max(leftBound, rightBound - menuWidth));
  const below = { left, top: trigger.bottom + margin };
  const above = { left, bottom: viewport.height - trigger.top + margin };
  const spaceBelow = viewport.height - margin - below.top;
  const spaceAbove = trigger.top - margin;

  if (naturalHeight <= spaceBelow) return { position: below, maxHeight: null };
  if (naturalHeight <= spaceAbove) return { position: above, maxHeight: null };
  return spaceAbove > spaceBelow
    ? { position: above, maxHeight: Math.max(MIN_MENU_HEIGHT, spaceAbove) }
    : { position: below, maxHeight: Math.max(MIN_MENU_HEIGHT, spaceBelow) };
}

interface LayerPlacementOptions<T extends HTMLElement> {
  triggerRef: RefObject<HTMLElement | null>;
  menuRef: RefObject<T | null>;
  open: boolean;
  width: number;
  align: "start" | "end";
  margin: number;
}

/** 浮层定位状态：随内容高度、视口与弹窗边界变化实时重算。 */
function useLayerPlacement<T extends HTMLElement>({ triggerRef, menuRef, open, width, align, margin }: LayerPlacementOptions<T>) {
  const [position, setPosition] = useState<CSSProperties>({});
  /** 弹窗内剩余空间不足时的可用高度；null 表示不受限 */
  const [maxHeight, setMaxHeight] = useState<number | null>(null);
  /** 内容自然高度缓存：限高后元素被内部滚动容器压缩，scrollHeight 不再可信 */
  const naturalHeightRef = useRef(0);

  useEffect(() => {
    if (!open) naturalHeightRef.current = 0;
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const trigger = triggerRef.current;
      const menu = menuRef.current;
      if (!trigger) return;
      if (menu && !menu.style.maxHeight) naturalHeightRef.current = menu.scrollHeight;
      const rect = trigger.getBoundingClientRect();
      const dialog = dialogBounds(trigger);
      const placement = resolveLayerPlacement({
        trigger: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom },
        boundary: dialog ? { left: dialog.left, right: dialog.right } : null,
        viewport: { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight },
        menuWidth: menu?.offsetWidth || width,
        naturalHeight: naturalHeightRef.current,
        align,
        margin,
      });
      setPosition(placement.position);
      setMaxHeight(placement.maxHeight);
    };
    update();
    // 内容渲染完成（字体、异步布局）后高度会变化，需要按真实高度重新定位
    const menu = menuRef.current;
    // jsdom 等环境没有 ResizeObserver，退化为一次性定位
    const observer = typeof ResizeObserver === "function" && menu ? new ResizeObserver(update) : null;
    observer?.observe(menu as Element);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, align, margin, triggerRef, menuRef, width]);

  return { position, maxHeight };
}

/** 工具栏下拉菜单定位：portal 到 body 后用 fixed 定位，避免被滚动容器 overflow 裁剪。 */
export function useAnchoredLayer<T extends HTMLElement = HTMLDivElement>({ triggerRef, open, close, width, align = "end", margin = 8 }: UseAnchoredLayerOptions) {
  const menuRef = useRef<T | null>(null);
  const { position, maxHeight } = useLayerPlacement({ triggerRef, menuRef, open, width, align, margin });

  useBackHandler(open, close);

  useEffect(() => {
    if (!open) return;
    return markFloatingLayerOpen();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close, triggerRef]);

  return { menuRef, position, maxHeight };
}

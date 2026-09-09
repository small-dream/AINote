import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { useBackHandler } from "@/platform/back-navigation";

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

/** 工具栏下拉菜单定位：portal 到 body 后用 fixed 定位，避免被滚动容器 overflow 裁剪。 */
export function useAnchoredLayer<T extends HTMLElement = HTMLDivElement>({ triggerRef, open, close, width, align = "end", margin = 8 }: UseAnchoredLayerOptions) {
  const menuRef = useRef<T | null>(null);
  const [position, setPosition] = useState<CSSProperties>({});

  useBackHandler(open, close);

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = document.documentElement.clientHeight;
      const menuWidth = menuRef.current?.offsetWidth || width;
      const preferredLeft = align === "end" ? rect.right - menuWidth : rect.left;
      const left = Math.min(Math.max(preferredLeft, margin), Math.max(margin, viewportWidth - menuWidth - margin));
      const menuHeight = menuRef.current?.offsetHeight ?? 0;
      const fitsBelow = rect.bottom + margin + menuHeight <= viewportHeight - margin;
      setPosition(fitsBelow
        ? { left, top: rect.bottom + margin }
        : { left, bottom: viewportHeight - rect.top + margin });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, align, margin, triggerRef, width]);

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

  return { menuRef, position };
}

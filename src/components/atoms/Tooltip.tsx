import { useLayoutEffect, useRef, useState, type CSSProperties, type PropsWithChildren, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type TooltipPlacement = "top" | "bottom" | "right";
/** end：气泡右缘对齐触发点右缘，用于贴近容器右边缘的按钮，避免气泡被裁切 */
export type TooltipAlign = "center" | "end";

interface TooltipProps extends PropsWithChildren {
  content: ReactNode;
  placement?: TooltipPlacement;
  align?: TooltipAlign;
  className?: string;
  /** 触发点位于 overflow 裁剪（滚动）容器内时开启：气泡 portal 到 body 用 fixed 定位，避免被容器裁掉 */
  portal?: boolean;
}

const PLACEMENT_CLASS: Record<TooltipPlacement, Record<TooltipAlign, string>> = {
  top: { center: "bottom-full left-1/2 mb-1.5 -translate-x-1/2", end: "bottom-full right-0 mb-1.5" },
  bottom: { center: "top-full left-1/2 mt-1.5 -translate-x-1/2", end: "top-full right-0 mt-1.5" },
  right: { center: "left-full top-1/2 ml-2 -translate-y-1/2", end: "left-full top-1/2 ml-2 -translate-y-1/2" },
};

const BUBBLE_CLASS =
  "pointer-events-none whitespace-nowrap rounded-md border border-border bg-bg-primary px-2 py-1 text-xs text-text-primary shadow-sm";

/** 图标控件的即时提示：hover/focus 立即展示，替代浏览器延迟显示的 title。 */
export function Tooltip({ content, placement = "top", align = "center", className = "", portal = false, children }: TooltipProps) {
  if (!portal) {
    return (
      <span className={`group relative inline-flex ${className}`}>
        {children}
        <span
          aria-hidden="true"
          className={`absolute z-[80] opacity-0 transition-opacity duration-100 group-hover:opacity-100 group-focus-within:opacity-100 ${PLACEMENT_CLASS[placement][align]} ${BUBBLE_CLASS}`}
        >
          {content}
        </span>
      </span>
    );
  }
  return <PortalTooltip content={content} placement={placement} align={align} className={className}>{children}</PortalTooltip>;
}

/** portal 形态：气泡渲染到 body 的 fixed 层，逃出 overflow 裁剪容器；用布局效应测量后定位，首帧即到位。 */
function PortalTooltip({ content, placement, align, className, children }: Omit<TooltipProps, "portal">) {
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const bubbleRef = useRef<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties | null>(null);

  useLayoutEffect(() => {
    // 关闭时不渲染气泡，position 只保留给下次打开前的首帧定位（重开时布局效应先于绘制更新）
    if (!open) return;
    const trigger = triggerRef.current;
    const bubble = bubbleRef.current;
    if (!trigger || !bubble) return;
    const rect = trigger.getBoundingClientRect();
    const bubbleWidth = bubble.offsetWidth;
    const bubbleHeight = bubble.offsetHeight;
    if (placement === "top") {
      setPosition({ left: align === "end" ? rect.right - bubbleWidth : rect.left + rect.width / 2 - bubbleWidth / 2, top: rect.top - bubbleHeight - 6 });
    } else if (placement === "bottom") {
      setPosition({ left: align === "end" ? rect.right - bubbleWidth : rect.left + rect.width / 2 - bubbleWidth / 2, top: rect.bottom + 6 });
    } else {
      setPosition({ left: rect.right + 8, top: rect.top + rect.height / 2 - bubbleHeight / 2 });
    }
  }, [open, placement, align]);

  return (
    <span
      ref={triggerRef}
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open
        ? createPortal(
            <span
              ref={bubbleRef}
              role="tooltip"
              style={position ?? undefined}
              className={`fixed z-[80] ${BUBBLE_CLASS}`}
            >
              {content}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}

import type { PropsWithChildren, ReactNode } from "react";

export type TooltipPlacement = "top" | "bottom" | "right";
/** end：气泡右缘对齐触发点右缘，用于贴近容器右边缘的按钮，避免气泡被裁切 */
export type TooltipAlign = "center" | "end";

interface TooltipProps extends PropsWithChildren {
  content: ReactNode;
  placement?: TooltipPlacement;
  align?: TooltipAlign;
  className?: string;
}

const PLACEMENT_CLASS: Record<TooltipPlacement, Record<TooltipAlign, string>> = {
  top: { center: "bottom-full left-1/2 mb-1.5 -translate-x-1/2", end: "bottom-full right-0 mb-1.5" },
  bottom: { center: "top-full left-1/2 mt-1.5 -translate-x-1/2", end: "top-full right-0 mt-1.5" },
  right: { center: "left-full top-1/2 ml-2 -translate-y-1/2", end: "left-full top-1/2 ml-2 -translate-y-1/2" },
};

/** 图标控件的即时提示：hover/focus 立即展示，替代浏览器延迟显示的 title。 */
export function Tooltip({ content, placement = "top", align = "center", className = "", children }: TooltipProps) {
  return (
    <span className={`group relative inline-flex ${className}`}>
      {children}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute z-[80] whitespace-nowrap rounded-md border border-border bg-bg-primary px-2 py-1 text-xs text-text-primary opacity-0 shadow-sm transition-opacity duration-100 group-hover:opacity-100 group-focus-within:opacity-100 ${PLACEMENT_CLASS[placement][align]}`}
      >
        {content}
      </span>
    </span>
  );
}

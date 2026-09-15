import type { PropsWithChildren, ReactNode } from "react";

type TooltipPlacement = "top" | "bottom" | "right";

interface TooltipProps extends PropsWithChildren {
  content: ReactNode;
  placement?: TooltipPlacement;
  className?: string;
}

const PLACEMENT_CLASS: Record<TooltipPlacement, string> = {
  top: "bottom-full left-1/2 mb-1.5 -translate-x-1/2",
  bottom: "top-full left-1/2 mt-1.5 -translate-x-1/2",
  right: "left-full top-1/2 ml-2 -translate-y-1/2",
};

/** 图标控件的即时提示：hover/focus 立即展示，替代浏览器延迟显示的 title。 */
export function Tooltip({ content, placement = "top", className = "", children }: TooltipProps) {
  return (
    <span className={`group relative inline-flex ${className}`}>
      {children}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute z-[80] whitespace-nowrap rounded-md border border-border bg-bg-primary px-2 py-1 text-xs text-text-primary opacity-0 shadow-sm transition-opacity duration-100 group-hover:opacity-100 group-focus-within:opacity-100 ${PLACEMENT_CLASS[placement]}`}
      >
        {content}
      </span>
    </span>
  );
}

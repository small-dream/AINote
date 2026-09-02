import type { ButtonHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";

type IconButtonSize = "sm" | "md";

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  icon: LucideIcon;
  label: string;
  size?: IconButtonSize;
  active?: boolean;
}

/** 工具栏图标按钮：固定触控尺寸，统一图标、状态与焦点反馈。 */
export function IconButton({ icon: Icon, label, size = "md", active, className = "", ...rest }: IconButtonProps) {
  const dimension = size === "sm" ? "h-8 w-8" : "h-9 w-9";
  const iconSize = size === "sm" ? 16 : 18;
  const state = active
    ? "border-accent/30 bg-accent-soft text-accent"
    : "border-transparent text-text-secondary hover:border-border hover:bg-bg-secondary hover:text-text-primary";
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={`group inline-flex ${dimension} shrink-0 items-center justify-center rounded-md border p-0 transition-[background-color,border-color,color,transform] duration-150 ease-out active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40 ${state} ${className}`}
      {...rest}
    >
      <Icon size={iconSize} strokeWidth={1.9} aria-hidden="true" />
    </button>
  );
}

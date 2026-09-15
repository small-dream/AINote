import type { LucideIcon } from "lucide-react";
import { Tooltip } from "@/components/atoms/Tooltip";

interface ToolbarButtonProps {
  icon: LucideIcon;
  label: string;
  shortcut?: string | undefined;
  active?: boolean;
  onClick: () => void;
}

/** 格式工具栏按钮：统一 30px 命中区，hover/激活双态。 */
export function ToolbarButton({ icon: Icon, label, shortcut, active = false, onClick }: ToolbarButtonProps) {
  return (
    <Tooltip content={shortcut ? `${label} ${shortcut}` : label}>
      <button
        type="button"
        aria-label={label}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors duration-120 ${
          active
            ? "bg-accent-soft text-accent"
            : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
        }`}
      >
        <Icon size={16} />
      </button>
    </Tooltip>
  );
}

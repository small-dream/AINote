import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, type LucideIcon } from "lucide-react";
import { Tooltip } from "@/components/atoms/Tooltip";
import { useAnchoredLayer } from "@/hooks/useAnchoredLayer";

/* 必须高于 Modal（z-[70]）：chip 菜单要浮在弹窗之上；宽度由调用方声明，避免压住面板内容 */
const MENU_CLASS = "fixed z-[80] flex flex-col rounded-xl border border-border bg-bg-primary p-1 shadow-xl";

interface ChipProps {
  icon: LucideIcon;
  label: string;
  menuLabel: string;
  tooltip: string;
  active?: boolean;
  disabled?: boolean;
  toneClass?: string | undefined;
  /** 菜单宽度（px），影响定位时的翻转与收边计算 */
  menuWidth?: number;
  children: (close: () => void) => ReactNode;
}

/** 元数据 chip 按钮 + portal 弹层：mousedown 阻止默认行为，避免抢走输入框焦点。 */
export function Chip({ icon: Icon, label, menuLabel, tooltip, active = false, disabled = false, toneClass, menuWidth = 208, children }: ChipProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const { menuRef, position, maxHeight } = useAnchoredLayer({ triggerRef, open, close: () => setOpen(false), width: menuWidth, align: "start" });
  const close = () => setOpen(false);

  return (
    <div ref={triggerRef} className="relative shrink-0">
      <Tooltip content={tooltip}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={menuLabel}
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setOpen((value) => !value)}
          className={`flex h-9 max-w-40 items-center gap-1.5 rounded-lg border px-2 text-xs font-medium transition-colors disabled:opacity-40 sm:h-6 sm:max-w-32 sm:rounded-md sm:px-1.5 sm:text-[11px] ${
            active
              ? `border-transparent bg-bg-tertiary ${toneClass ?? "text-text-primary"}`
              : "border-transparent text-text-tertiary hover:bg-bg-tertiary hover:text-text-secondary"
          }`}
        >
          <Icon size={12} strokeWidth={2} aria-hidden="true" className="shrink-0" />
          <span className="truncate">{label}</span>
        </button>
      </Tooltip>
      {open ? createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label={menuLabel}
          style={{ ...position, width: menuWidth, maxHeight: maxHeight ?? undefined }}
          className={`${MENU_CLASS} ${maxHeight ? "overflow-hidden" : ""}`}
        >
          {children(close)}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}

interface MenuItemProps {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  iconClass?: string | undefined;
  onSelect: () => void;
}

export function MenuItem({ icon: Icon, label, active = false, iconClass, onSelect }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onSelect}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${active ? "bg-accent/10 text-accent" : "text-text-primary hover:bg-bg-tertiary"}`}
    >
      <Icon size={13} strokeWidth={2} aria-hidden="true" className={`shrink-0 ${iconClass ?? "text-text-tertiary"}`} />
      <span className="flex-1 truncate">{label}</span>
      {active ? <Check size={12} strokeWidth={2.5} aria-hidden="true" /> : null}
    </button>
  );
}

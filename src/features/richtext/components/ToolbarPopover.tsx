import { useRef, useState, type CSSProperties, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, type LucideIcon } from "lucide-react";
import { useAnchoredLayer } from "@/hooks/useAnchoredLayer";

export interface ToolbarMenuItem {
  key: string;
  label: string;
  icon: LucideIcon;
  active?: boolean | undefined;
  disabled?: boolean | undefined;
  onSelect: () => void;
}

interface ToolbarPopoverProps {
  label: string;
  icon?: LucideIcon;
  text?: string;
  active?: boolean;
  align?: "left" | "right";
  items: ToolbarMenuItem[];
}

const MENU_MIN_WIDTH = 192;

const triggerState = (active: boolean) => active
  ? "border-accent/30 bg-accent-soft text-accent"
  : "border-transparent text-text-secondary hover:border-border hover:bg-bg-tertiary hover:text-text-primary";

/** 工具栏折叠菜单：portal 到 body 定位，避免被工具栏滚动容器裁剪；保留编辑器当前选区 */
export function ToolbarPopover({ label, icon: Icon, text, active = false, align = "left", items }: ToolbarPopoverProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { menuRef, position } = useAnchoredLayer({ triggerRef: containerRef, open, close: () => setOpen(false), width: MENU_MIN_WIDTH, align: align === "right" ? "end" : "start" });

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button type="button" aria-expanded={open} aria-haspopup="menu" aria-label={label} title={label} className={`inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-md border px-1.5 text-xs font-medium transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.96] ${triggerState(active)}`} onMouseDown={(event) => event.preventDefault()} onClick={() => setOpen((value) => !value)}>
        {Icon ? <Icon size={16} strokeWidth={1.9} aria-hidden="true" /> : null}
        {text ? <span>{text}</span> : null}
        <ChevronDown size={13} strokeWidth={2.2} aria-hidden="true" />
      </button>
      {open ? createPortal(<ToolbarMenuItems items={items} label={label} position={position} menuRef={menuRef} onClose={() => setOpen(false)} />, document.body) : null}
    </div>
  );
}

function ToolbarMenuItems({ items, label, position, menuRef, onClose }: { items: ToolbarMenuItem[]; label: string; position: CSSProperties; menuRef: RefObject<HTMLDivElement | null>; onClose: () => void }) {
  return (
    <div ref={menuRef} role="menu" aria-label={label} style={position} className="fixed z-50 min-w-48 rounded-xl border border-border bg-bg-primary p-1 shadow-xl">
      {items.map(({ key, label: itemLabel, icon: ItemIcon, active = false, disabled = false, onSelect }) => (
        <button key={key} type="button" role="menuitem" aria-current={active} className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${active ? "bg-accent/10 text-accent" : "text-text-primary hover:bg-bg-tertiary"} disabled:pointer-events-none disabled:opacity-40`} onMouseDown={(event) => event.preventDefault()} disabled={disabled} onClick={() => { onClose(); onSelect(); }}>
          <ItemIcon size={15} strokeWidth={1.9} aria-hidden="true" />
          <span className="flex-1 truncate">{itemLabel}</span>
          {active ? <Check size={14} strokeWidth={2.2} aria-hidden="true" /> : null}
        </button>
      ))}
    </div>
  );
}

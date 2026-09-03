import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, type LucideIcon } from "lucide-react";

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

const triggerState = (active: boolean) => active
  ? "border-accent/30 bg-accent-soft text-accent"
  : "border-transparent text-text-secondary hover:border-border hover:bg-bg-tertiary hover:text-text-primary";

/** 工具栏折叠菜单：点击外部/Escape 关闭，保留编辑器当前选区 */
export function ToolbarPopover({ label, icon: Icon, text, active = false, align = "left", items }: ToolbarPopoverProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button type="button" aria-expanded={open} aria-haspopup="menu" aria-label={label} title={label} className={`inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-md border px-1.5 text-xs font-medium transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.96] ${triggerState(active)}`} onMouseDown={(event) => event.preventDefault()} onClick={() => setOpen((value) => !value)}>
        {Icon ? <Icon size={16} strokeWidth={1.9} aria-hidden="true" /> : null}
        {text ? <span>{text}</span> : null}
        <ChevronDown size={13} strokeWidth={2.2} aria-hidden="true" />
      </button>
      {open ? <ToolbarMenuItems items={items} align={align} label={label} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}

function ToolbarMenuItems({ items, align, label, onClose }: { items: ToolbarMenuItem[]; align: "left" | "right"; label: string; onClose: () => void }) {
  return (
    <div role="menu" aria-label={label} className={`absolute top-[calc(100%+6px)] z-50 min-w-48 rounded-xl border border-border bg-bg-primary p-1 shadow-xl ${align === "right" ? "right-0" : "left-0"}`}>
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

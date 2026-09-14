import { useEffect, useRef, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";
import type { NoteTheme } from "@/stores/ui.store";
import { clampContextMenuPosition, estimateContextMenuHeight } from "@/utils/contextMenuPosition";

export interface ContextMenuAction {
  key: string;
  label: string;
  icon?: LucideIcon;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  onSelect: () => void;
}

export type ContextMenuItem = ContextMenuAction | { kind: "separator"; key: string };

export interface ContextMenuPoint {
  x: number;
  y: number;
}

interface EditorContextMenuProps {
  position: ContextMenuPoint | null;
  label: string;
  items: ContextMenuItem[];
  noteTheme: NoteTheme;
  onClose: () => void;
}

/** 编辑器统一右键菜单：替代 WebView 原生 reload 菜单，并保持键盘与主题可达。 */
export function EditorContextMenu({ position, label, items, noteTheme, onClose }: EditorContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const clamped = position
    ? clampContextMenuPosition(position, MENU_FALLBACK_WIDTH, estimateContextMenuHeight(items))
    : null;

  useEffect(() => {
    if (!position) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("scroll", onClose, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("scroll", onClose, true);
    };
  }, [onClose, position]);

  if (!position || !clamped || items.length === 0) return null;
  const style: CSSProperties = { left: clamped.x, top: clamped.y };
  return createPortal(
    <div ref={menuRef} role="menu" aria-label={label} style={style} data-note-theme={noteTheme} className="note-theme-surface fixed z-[70] min-w-52 rounded-xl border border-border bg-bg-primary p-1 shadow-xl">
      {items.map((item) => "kind" in item
        ? <div key={item.key} className="my-1 h-px bg-border" />
        : <ContextMenuButton key={item.key} item={item} onClose={onClose} />)}
    </div>,
    document.body,
  );
}

function ContextMenuButton({ item, onClose }: { item: ContextMenuAction; onClose: () => void }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      role="menuitem"
      disabled={item.disabled}
      className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary disabled:pointer-events-none disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-40"
      onClick={() => {
        item.onSelect();
        onClose();
      }}
    >
      {Icon ? <Icon size={15} aria-hidden="true" /> : null}
      <span className="flex-1 truncate">{item.label}</span>
      {item.shortcut ? <span className="text-xs text-text-tertiary">{item.shortcut}</span> : null}
    </button>
  );
}

const MENU_FALLBACK_WIDTH = 208;

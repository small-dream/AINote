import { useEffect, useRef, useState, type FocusEvent } from "react";
import { List } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { useTranslation } from "@/i18n";
import type { OutlineItem } from "../utils/outline";
import { NoteOutline } from "./NoteOutline";

interface NoteOutlineFloatingProps {
  items: OutlineItem[];
  open: boolean;
  onToggle: () => void;
  onSelect: (item: OutlineItem) => void;
}

/** 编辑区左上角的悬浮大纲入口：悬停预览，点击后保持展开。 */
export function NoteOutlineFloating({ items, open, onToggle, onSelect }: NoteOutlineFloatingProps) {
  const { t } = useTranslation();
  const { visible, keepVisible, scheduleHide, setFocused, clearTransient, rootRef } = useFloatingVisibility(open, onToggle);
  const handleToggle = () => { if (open) clearTransient(); onToggle(); };
  return (
    <div
      ref={rootRef}
      className="note-outline-floating"
      onMouseEnter={keepVisible}
      onMouseLeave={scheduleHide}
      onFocus={() => setFocused(true)}
      onBlur={(event) => handleOutlineBlur(event, setFocused)}
    >
      <Button
        variant="ghost"
        type="button"
        aria-label={t("note.outline")}
        aria-expanded={visible}
        aria-haspopup="true"
        title={t("note.outline")}
        className={`note-outline-floating-trigger ${visible ? "is-open" : ""}`}
        onClick={handleToggle}
      >
        <List size={16} aria-hidden="true" />
        <span className="sr-only">{t("note.outline")}</span>
      </Button>
      <div
        className={`note-outline-floating-panel ${visible ? "is-visible" : ""}`}
        aria-hidden={!visible}
        onMouseEnter={keepVisible}
        onMouseLeave={scheduleHide}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <NoteOutline items={items} onSelect={onSelect} />
      </div>
    </div>
  );
}

function handleOutlineBlur(event: FocusEvent<HTMLDivElement>, setFocused: (focused: boolean) => void): void {
  const next = event.relatedTarget;
  if (!(next instanceof Node) || !event.currentTarget.contains(next)) setFocused(false);
}

function useFloatingVisibility(open: boolean, onToggle: () => void) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const visible = open || hovered || focused;

  useEffect(() => () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
  }, []);

  useEffect(() => {
    if (!visible) return undefined;
    const handleOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || !rootRef.current?.contains(target)) {
        setHovered(false);
        setFocused(false);
        if (open) onToggle();
      }
    };
    document.addEventListener("pointerdown", handleOutsidePointer);
    return () => document.removeEventListener("pointerdown", handleOutsidePointer);
  }, [visible, open, onToggle]);

  const keepVisible = () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
    setHovered(true);
  };
  const scheduleHide = () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => { closeTimer.current = null; setHovered(false); }, 120);
  };
  const clearTransient = () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
    setHovered(false);
    setFocused(false);
  };
  return { visible: open || hovered || focused, keepVisible, scheduleHide, setFocused, clearTransient, rootRef };
}

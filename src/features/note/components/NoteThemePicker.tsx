import { Check, Palette } from "lucide-react";
import { useRef, useState, type CSSProperties, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "@/i18n";
import { useUiStore, type NoteTheme } from "@/stores/ui.store";
import { IconButton } from "@/components/atoms/IconButton";
import { useAnchoredLayer } from "@/hooks/useAnchoredLayer";
import { NOTE_THEME_GROUPS, NOTE_THEME_OPTIONS, type NoteThemeOption } from "../utils/noteThemes";

const THEME_MENU_WIDTH = 208;

/** 编辑器与预览共用的主题选择器，偏好存储在 UI store。 */
export function NoteThemePicker() {
  const { t } = useTranslation();
  const noteTheme = useUiStore((state) => state.noteTheme);
  const setNoteTheme = useUiStore((state) => state.setNoteTheme);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { menuRef, position } = useAnchoredLayer({ triggerRef: rootRef, open, close: () => setOpen(false), width: THEME_MENU_WIDTH });

  return (
    <div ref={rootRef} className="relative">
      <IconButton
        icon={Palette}
        label={t("note.theme")}
        active={open}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      />
      {open ? createPortal(
        <ThemeMenu menuRef={menuRef} position={position} noteTheme={noteTheme} onSelect={(value) => { setNoteTheme(value); setOpen(false); }} />,
        document.body,
      ) : null}
    </div>
  );
}

function ThemeMenu({ menuRef, position, noteTheme, onSelect }: { menuRef: RefObject<HTMLDivElement | null>; position: CSSProperties; noteTheme: NoteTheme; onSelect: (value: NoteTheme) => void }) {
  const { t } = useTranslation();
  return (
    <div ref={menuRef} role="menu" aria-label={t("note.theme")} style={position} className="note-theme-menu fixed z-50 w-52 rounded-lg border border-border bg-bg-primary p-1.5 shadow-sm">
      <p className="px-2 py-1 text-[11px] font-medium text-text-tertiary">{t("note.theme")}</p>
      {NOTE_THEME_GROUPS.map(({ mode, labelKey }) => (
        <div key={mode}>
          <p className="px-2 pb-0.5 pt-1.5 text-[10px] font-medium uppercase tracking-wide text-text-tertiary">{t(labelKey)}</p>
          {NOTE_THEME_OPTIONS.filter((option) => option.mode === mode).map((option) => <ThemeMenuItem key={option.value} option={option} selected={option.value === noteTheme} onSelect={onSelect} />)}
        </div>
      ))}
    </div>
  );
}

function ThemeMenuItem({ option, selected, onSelect }: { option: NoteThemeOption; selected: boolean; onSelect: (value: NoteTheme) => void }) {
  const { t } = useTranslation();
  return (
    <button type="button" role="menuitemradio" aria-checked={selected} onClick={() => onSelect(option.value)} className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs transition-colors ${selected ? "bg-accent-soft text-accent" : "text-text-primary hover:bg-bg-secondary"}`}>
      <span className="flex shrink-0 overflow-hidden rounded border border-border" aria-hidden="true">{option.swatches.map((color) => <span key={color} className="h-4 w-4" style={{ backgroundColor: color }} />)}</span>
      <span className="flex-1">{t(option.labelKey)}</span>
      {selected ? <Check size={14} /> : null}
    </button>
  );
}

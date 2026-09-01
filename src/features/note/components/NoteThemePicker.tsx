import { Check, ChevronDown, Palette } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import { useTranslation } from "@/i18n";
import { useUiStore, type NoteTheme } from "@/stores/ui.store";

const NOTE_THEME_OPTIONS: ReadonlyArray<{ value: NoteTheme; labelKey: "note.themeClassic" | "note.themePaper" | "note.themeMidnight" | "note.themeForest"; swatches: string[] }> = [
  { value: "classic", labelKey: "note.themeClassic", swatches: ["#f8fafc", "#2563eb", "#334155"] },
  { value: "paper", labelKey: "note.themePaper", swatches: ["#fbf7ef", "#b45309", "#3f3528"] },
  { value: "midnight", labelKey: "note.themeMidnight", swatches: ["#111827", "#7dd3fc", "#dbeafe"] },
  { value: "forest", labelKey: "note.themeForest", swatches: ["#f1f7f2", "#2f855a", "#244239"] },
];
const DEFAULT_NOTE_THEME = NOTE_THEME_OPTIONS[0] ?? { value: "classic" as NoteTheme, labelKey: "note.themeClassic" as const, swatches: [] };

/** 编辑器与预览共用的主题选择器，偏好存储在 UI store。 */
export function NoteThemePicker() {
  const { t } = useTranslation();
  const noteTheme = useUiStore((state) => state.noteTheme);
  const setNoteTheme = useUiStore((state) => state.setNoteTheme);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const active = NOTE_THEME_OPTIONS.find((option) => option.value === noteTheme) ?? DEFAULT_NOTE_THEME;
  useCloseOnOutside(rootRef, open, () => setOpen(false));

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={t("note.theme")}
        aria-haspopup="menu"
        aria-expanded={open}
        title={t("note.theme")}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-1.5 rounded-md border border-transparent px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-border hover:bg-bg-secondary hover:text-text-primary"
      >
        <Palette size={14} />
        <span className="hidden 2xl:inline">{t(active.labelKey)}</span>
        <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? <ThemeMenu noteTheme={noteTheme} onSelect={(value) => { setNoteTheme(value); setOpen(false); }} /> : null}
    </div>
  );
}

function useCloseOnOutside(ref: RefObject<HTMLDivElement | null>, active: boolean, close: () => void): void {
  useEffect(() => {
    if (!active) return;
    const onPointerDown = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) close(); };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("pointerdown", onPointerDown); document.removeEventListener("keydown", onKeyDown); };
  }, [active, close, ref]);
}

function ThemeMenu({ noteTheme, onSelect }: { noteTheme: NoteTheme; onSelect: (value: NoteTheme) => void }) {
  const { t } = useTranslation();
  return (
    <div role="menu" aria-label={t("note.theme")} className="note-theme-menu absolute right-0 top-[calc(100%+0.5rem)] z-50 w-52 rounded-lg border border-border bg-bg-primary p-1.5 shadow-sm">
      <p className="px-2 py-1 text-[11px] font-medium text-text-tertiary">{t("note.theme")}</p>
      {NOTE_THEME_OPTIONS.map((option) => <ThemeMenuItem key={option.value} option={option} selected={option.value === noteTheme} onSelect={onSelect} />)}
    </div>
  );
}

function ThemeMenuItem({ option, selected, onSelect }: { option: (typeof NOTE_THEME_OPTIONS)[number]; selected: boolean; onSelect: (value: NoteTheme) => void }) {
  const { t } = useTranslation();
  return (
    <button type="button" role="menuitemradio" aria-checked={selected} onClick={() => onSelect(option.value)} className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs transition-colors ${selected ? "bg-accent-soft text-accent" : "text-text-primary hover:bg-bg-secondary"}`}>
      <span className="flex shrink-0 overflow-hidden rounded border border-border" aria-hidden="true">{option.swatches.map((color) => <span key={color} className="h-4 w-4" style={{ backgroundColor: color }} />)}</span>
      <span className="flex-1">{t(option.labelKey)}</span>
      {selected ? <Check size={14} /> : null}
    </button>
  );
}

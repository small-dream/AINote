import { Check } from "lucide-react";
import { useTranslation } from "@/i18n";
import { useUiStore, type NoteTheme } from "@/stores/ui.store";
import { NOTE_THEME_GROUPS, NOTE_THEME_OPTIONS, type NoteThemeOption } from "../utils/noteThemes";

/** 主题选项列表：弹层触发由共享 ToolbarMenu 的子视图承担，这里只保留主题逻辑本身。 */
export function NoteThemeOptions({ onPicked }: { onPicked?: (() => void) | undefined }) {
  const { t } = useTranslation();
  const noteTheme = useUiStore((state) => state.noteTheme);
  const setNoteTheme = useUiStore((state) => state.setNoteTheme);
  return (
    <>
      {NOTE_THEME_GROUPS.map(({ mode, labelKey }) => (
        <div key={mode}>
          <p className="px-2 pb-0.5 pt-1.5 text-[10px] font-medium uppercase tracking-wide text-text-tertiary">{t(labelKey)}</p>
          {NOTE_THEME_OPTIONS.filter((option) => option.mode === mode).map((option) => <ThemeMenuItem key={option.value} option={option} selected={option.value === noteTheme} onSelect={(value) => { setNoteTheme(value); onPicked?.(); }} />)}
        </div>
      ))}
    </>
  );
}

function ThemeMenuItem({ option, selected, onSelect }: { option: NoteThemeOption; selected: boolean; onSelect: (value: NoteTheme) => void }) {
  const { t } = useTranslation();
  return (
    <button type="button" role="menuitemradio" aria-checked={selected} tabIndex={-1} onClick={() => onSelect(option.value)} className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs transition-colors ${selected ? "bg-accent-soft text-accent" : "text-text-primary hover:bg-bg-secondary"}`}>
      <span className="flex shrink-0 overflow-hidden rounded border border-border" aria-hidden="true">{option.swatches.map((color) => <span key={color} className="h-4 w-4" style={{ backgroundColor: color }} />)}</span>
      <span className="flex-1">{t(option.labelKey)}</span>
      {selected ? <Check size={14} /> : null}
    </button>
  );
}

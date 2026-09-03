import { Check } from "lucide-react";
import { useTranslation } from "@/i18n";
import { useUiStore } from "@/stores/ui.store";
import { NOTE_THEME_GROUPS, NOTE_THEME_OPTIONS, type NoteThemeOption } from "@/features/note/utils/noteThemes";

/** 设置页「外观 → 阅读主题」画廊：按亮/暗系分组，卡片用真实主题 token 实时预览。 */
export function NoteThemeGallery() {
  const { t } = useTranslation();
  const noteTheme = useUiStore((s) => s.noteTheme);
  const setNoteTheme = useUiStore((s) => s.setNoteTheme);
  return (
    <section>
      <h3 className="mb-3 text-sm font-medium text-text-primary">{t("settings.noteTheme")}</h3>
      <div className="flex flex-col gap-5">
        {NOTE_THEME_GROUPS.map(({ mode, labelKey }) => (
          <div key={mode}>
            <p className="mb-1.5 text-xs text-text-tertiary">{t(labelKey)}</p>
            <div className="grid grid-cols-2 gap-2.5">
              {NOTE_THEME_OPTIONS.filter((option) => option.mode === mode).map((option) => (
                <ThemeCard key={option.value} option={option} selected={noteTheme === option.value} onSelect={() => setNoteTheme(option.value)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ThemeCard({ option, selected, onSelect }: { option: NoteThemeOption; selected: boolean; onSelect: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`overflow-hidden rounded-lg border text-left transition-colors ${selected ? "border-accent ring-1 ring-accent" : "border-border hover:border-text-tertiary"}`}
    >
      <div data-note-theme={option.value} className="note-theme-surface space-y-1 p-2.5">
        <div className="text-[11px] font-semibold leading-tight" style={{ color: "var(--note-ink)" }}>标题 Heading</div>
        <div className="h-1.5 w-3/4 rounded-sm" style={{ background: "var(--note-muted)" }} />
        <div className="h-1.5 w-1/2 rounded-sm" style={{ background: "var(--note-muted)" }} />
        <pre className="overflow-hidden rounded-sm px-1.5 py-1 text-[9px] leading-relaxed" style={{ background: "var(--note-code-bg)", color: "var(--note-ink)" }}>
          <span style={{ color: "var(--note-code-keyword)" }}>const</span> <span style={{ color: "var(--note-code-string)" }}>"note"</span> = 1
        </pre>
      </div>
      <div className="flex items-center justify-between px-2.5 py-1.5 text-xs">
        <span className={selected ? "text-accent" : "text-text-primary"}>{t(option.labelKey)}</span>
        {selected ? <Check size={14} className="text-accent" /> : null}
      </div>
    </button>
  );
}

import { Button } from "@/components/atoms/Button";
import { FilePenLine, FolderInput, History, Network, Save, Split, Eye, Pencil, List } from "lucide-react";
import { useTranslation } from "@/i18n";
import { NoteThemePicker } from "./NoteThemePicker";

export type ViewMode = "edit" | "split" | "preview";

interface EditorToolbarProps {
  path: string;
  mode: ViewMode;
  /** 富文本笔记：隐藏视图切换、主题与大纲（所见即所得无需分栏） */
  richText?: boolean;
  saving: boolean;
  dirty: boolean;
  saveError?: string | null;
  onModeChange: (mode: ViewMode) => void;
  onSave: () => void;
  onMove: () => void;
  onHistory: () => void;
  onWiki: () => void;
  onOutline?: () => void;
}

const MODE_TABS: { key: ViewMode; labelKey: "note.edit" | "note.split" | "note.preview" }[] = [
  { key: "edit", labelKey: "note.edit" },
  { key: "split", labelKey: "note.split" },
  { key: "preview", labelKey: "note.preview" },
];

/** 笔记操作栏：标题与保存状态、视图切换、文件操作。 */
export function EditorToolbar({ path, mode, richText = false, saving, dirty, saveError, onModeChange, onSave, onMove, onHistory, onWiki, onOutline }: EditorToolbarProps) {
  const { t } = useTranslation();
  return (
    <div
      data-tauri-drag-region="deep"
      className="flex min-h-14 items-center justify-between gap-4 border-b border-border bg-bg-primary px-6 py-2.5"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-accent-soft text-accent">
          <FilePenLine size={16} />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-semibold tracking-[-0.01em]">{path.split("/").at(-1)}</span>
            <SaveStatus saving={saving} dirty={dirty} saveError={saveError} />
          </div>
          <p className="mt-0.5 truncate text-[11px] text-text-tertiary">{path}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {!richText && <ModeTabs mode={mode} onChange={onModeChange} />}
        {!richText && <NoteThemePicker />}
        <Button variant="ghost" aria-label={t("history.title")} title={t("history.title")} className="inline-flex items-center gap-1.5 border border-transparent px-2.5 text-xs hover:border-border" onClick={onHistory}><History size={14} /><span className="hidden xl:inline">{t("history.title")}</span></Button>
        <Button variant="ghost" aria-label={t("wiki.title")} title={t("wiki.title")} className="inline-flex items-center gap-1.5 border border-transparent px-2.5 text-xs hover:border-border" onClick={onWiki}><Network size={14} /><span className="hidden xl:inline">{t("wiki.title")}</span></Button>
        {!richText && <Button variant="ghost" aria-label={t("note.outline")} title={t("note.outline")} className="inline-flex items-center gap-1.5 border border-transparent px-2.5 text-xs hover:border-border" onClick={() => onOutline?.()}><List size={14} /><span className="hidden xl:inline">{t("note.outline")}</span></Button>}
        <Button variant="ghost" aria-label={t("note.moving")} title={t("note.moving")} className="inline-flex items-center gap-1.5 border border-transparent px-2.5 text-xs hover:border-border" onClick={onMove}><FolderInput size={14} /><span className="hidden xl:inline">{t("note.moving")}</span></Button>
        <Button variant="primary" className="inline-flex items-center gap-1.5 px-3.5 text-xs font-medium" onClick={() => void onSave()} disabled={saving || !dirty}>
          <Save size={14} />
          {t("common.save")}
        </Button>
      </div>
      <SaveErrorMessage message={saveError} />
    </div>
  );
}

function SaveStatus({ saving, dirty, saveError }: { saving: boolean; dirty: boolean; saveError: string | null | undefined }) {
  const { t } = useTranslation();
  const status = saving ? t("common.saving") : saveError ? t("note.saveFailed") : dirty ? t("note.unsaved") : t("note.saved");
  const tone = saving || dirty || saveError ? "bg-warning/10 text-warning" : "bg-success/10 text-success";
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}>{status}</span>;
}

function SaveErrorMessage({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return <span role="status" className="max-w-56 truncate text-xs text-danger" title={message}>{message}</span>;
}

function ModeTabs({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  const { t } = useTranslation();
  const tabClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors ${active ? "bg-accent/10 text-accent shadow-sm" : "text-text-secondary hover:text-text-primary"}`;
  return (
    <div role="tablist" aria-label={t("note.viewMode")} className="flex overflow-hidden rounded-lg border border-border bg-bg-secondary p-0.5">
      {MODE_TABS.map(({ key, labelKey }) => {
        const Icon = key === "edit" ? Pencil : key === "split" ? Split : Eye;
        return (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={mode === key}
          tabIndex={mode === key ? 0 : -1}
          className={tabClass(mode === key)}
          onClick={() => onChange(key)}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            const current = MODE_TABS.findIndex((item) => item.key === mode);
            const delta = event.key === "ArrowRight" ? 1 : -1;
            const next = MODE_TABS[(current + delta + MODE_TABS.length) % MODE_TABS.length];
            if (next) onChange(next.key);
          }}
        >
          <Icon size={14} />
          {t(labelKey)}
        </button>
        );
      })}
    </div>
  );
}

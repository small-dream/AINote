import { Button } from "@/components/atoms/Button";
import { FilePenLine, FolderInput, History, Network, Save, Split, Eye, Pencil } from "lucide-react";
import { useTranslation } from "@/i18n";

export type ViewMode = "edit" | "split" | "preview";

interface EditorToolbarProps {
  path: string;
  mode: ViewMode;
  saving: boolean;
  dirty: boolean;
  onModeChange: (mode: ViewMode) => void;
  onSave: () => void;
  onMove: () => void;
  onHistory: () => void;
  onWiki: () => void;
}

const MODE_TABS: { key: ViewMode; labelKey: "note.edit" | "note.split" | "note.preview" }[] = [
  { key: "edit", labelKey: "note.edit" },
  { key: "split", labelKey: "note.split" },
  { key: "preview", labelKey: "note.preview" },
];

/** 笔记操作栏：标题与保存状态、视图切换、文件操作。 */
export function EditorToolbar({ path, mode, saving, dirty, onModeChange, onSave, onMove, onHistory, onWiki }: EditorToolbarProps) {
  const { t } = useTranslation();
  const status = saving ? t("common.saving") : dirty ? t("note.unsaved") : t("note.saved");
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 border-b border-border bg-bg-primary px-6 py-2.5">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-accent-soft text-accent">
          <FilePenLine size={16} />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-semibold tracking-[-0.01em]">{path.split("/").at(-1)}</span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${saving || dirty ? "bg-warning/10 text-warning" : "bg-success/10 text-success"}`}>
              {status}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-text-tertiary">{path}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <ModeTabs mode={mode} onChange={onModeChange} />
        <Button variant="ghost" aria-label={t("history.title")} title={t("history.title")} className="inline-flex items-center gap-1.5 border border-transparent px-2.5 text-xs hover:border-border" onClick={onHistory}><History size={14} /><span className="hidden xl:inline">{t("history.title")}</span></Button>
        <Button variant="ghost" aria-label={t("wiki.title")} title={t("wiki.title")} className="inline-flex items-center gap-1.5 border border-transparent px-2.5 text-xs hover:border-border" onClick={onWiki}><Network size={14} /><span className="hidden xl:inline">{t("wiki.title")}</span></Button>
        <Button variant="ghost" aria-label={t("note.moving")} title={t("note.moving")} className="inline-flex items-center gap-1.5 border border-transparent px-2.5 text-xs hover:border-border" onClick={onMove}><FolderInput size={14} /><span className="hidden xl:inline">{t("note.moving")}</span></Button>
        <Button variant="primary" className="inline-flex items-center gap-1.5 px-3.5 text-xs font-medium" onClick={onSave} disabled={saving || !dirty}>
          <Save size={14} />
          {t("common.save")}
        </Button>
      </div>
    </div>
  );
}

function ModeTabs({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  const { t } = useTranslation();
  const tabClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors ${active ? "bg-accent/10 text-accent shadow-sm" : "text-text-secondary hover:text-text-primary"}`;
  return (
    <div className="flex overflow-hidden rounded-lg border border-border bg-bg-secondary p-0.5">
      {MODE_TABS.map(({ key, labelKey }) => {
        const Icon = key === "edit" ? Pencil : key === "split" ? Split : Eye;
        return (
        <button key={key} className={tabClass(mode === key)} onClick={() => onChange(key)}>
          <Icon size={14} />
          {t(labelKey)}
        </button>
        );
      })}
    </div>
  );
}

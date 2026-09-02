import { Button } from "@/components/atoms/Button";
import { ArrowLeftRight, FolderInput, History, Network, Printer, Split, Eye, Pencil } from "lucide-react";
import { useTranslation } from "@/i18n";
import { NoteThemePicker } from "./NoteThemePicker";
import { noteDisplayName } from "../utils/displayName";
import { AiToolbarButton } from "@/features/ai/components/AiToolbarButton";

export type ViewMode = "edit" | "split" | "preview";

interface EditorToolbarProps {
  path: string;
  mode: ViewMode;
  /** 富文本笔记：隐藏视图切换、主题与大纲（所见即所得无需分栏） */
  richText?: boolean;
  saveError?: string | null;
  onModeChange: (mode: ViewMode) => void;
  onSave: () => void;
  onMove: () => void;
  onHistory: () => void;
  onWiki: () => void;
  onConvertToRichText?: () => void;
  onExportPdf?: () => void;
  onAi?: () => void;
}

const MODE_TABS: { key: ViewMode; labelKey: "note.edit" | "note.split" | "note.preview" }[] = [
  { key: "edit", labelKey: "note.edit" },
  { key: "split", labelKey: "note.split" },
  { key: "preview", labelKey: "note.preview" },
];

/** 笔记操作栏：标题与保存状态、视图切换、文件操作。 */
export function EditorToolbar({ path, mode, richText = false, saveError, onModeChange, onSave, onMove, onHistory, onWiki, onConvertToRichText, onExportPdf, onAi }: EditorToolbarProps) {
  const { t } = useTranslation();
  return (
    <div
      data-tauri-drag-region="deep"
      className="flex min-h-14 items-center justify-between gap-4 border-b border-border bg-bg-primary px-6 py-2.5"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="min-w-0">
          <span className="truncate text-[15px] font-semibold tracking-[-0.01em]">{noteDisplayName(path.split("/").at(-1) ?? path)}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {!richText && <ModeTabs mode={mode} onChange={onModeChange} />}
        {!richText && <NoteThemePicker />}
        <Button variant="ghost" aria-label={t("history.title")} title={t("history.title")} className="inline-flex items-center gap-1.5 border border-transparent px-2.5 text-xs hover:border-border" onClick={onHistory}><History size={14} /><span className="hidden xl:inline">{t("history.title")}</span></Button>
        <Button variant="ghost" aria-label={t("wiki.title")} title={t("wiki.title")} className="inline-flex items-center gap-1.5 border border-transparent px-2.5 text-xs hover:border-border" onClick={onWiki}><Network size={14} /><span className="hidden xl:inline">{t("wiki.title")}</span></Button>
        {onExportPdf ? <ExportPdfButton onClick={onExportPdf} /> : null}
        {onAi ? <AiToolbarButton onOpen={onAi} /> : null}
        <ConvertButton richText={richText} onConvert={onConvertToRichText} />
        <Button variant="ghost" aria-label={t("note.moving")} title={t("note.moving")} className="inline-flex items-center gap-1.5 border border-transparent px-2.5 text-xs hover:border-border" onClick={onMove}><FolderInput size={14} /><span className="hidden xl:inline">{t("note.moving")}</span></Button>
      </div>
      <SaveErrorMessage message={saveError} onRetry={onSave} />
    </div>
  );
}

function ExportPdfButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  const label = t("note.exportPdf");
  return (
    <Button variant="ghost" aria-label={label} title={label} className="inline-flex items-center gap-1.5 border border-transparent px-2.5 text-xs hover:border-border" onClick={onClick}>
      <Printer size={14} />
      <span className="hidden xl:inline">{label}</span>
    </Button>
  );
}

function ConvertButton({ richText, onConvert }: { richText: boolean; onConvert: (() => void) | undefined }) {
  const { t } = useTranslation();
  if (richText || !onConvert) return null;
  return <Button variant="ghost" aria-label={t("note.convertToRichText")} title={t("note.convertToRichText")} className="inline-flex items-center gap-1.5 border border-transparent px-2.5 text-xs hover:border-border" onClick={onConvert}><ArrowLeftRight size={14} /><span className="hidden xl:inline">{t("note.convertToRichText")}</span></Button>;
}

function SaveErrorMessage({ message, onRetry }: { message: string | null | undefined; onRetry: () => void }) {
  const { t } = useTranslation();
  if (!message) return null;
  return <span role="status" className="flex max-w-72 items-center gap-2 text-xs text-danger"><span className="truncate" title={message}>{message}</span><button type="button" className="shrink-0 underline underline-offset-2 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2" onClick={onRetry}>{t("note.retrySave")}</button></span>;
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

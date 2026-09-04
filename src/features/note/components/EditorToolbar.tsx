import { Eye, History, Link2, Pencil, Split, type LucideIcon } from "lucide-react";
import { IconButton } from "@/components/atoms/IconButton";
import { useTranslation } from "@/i18n";
import { NoteThemePicker } from "./NoteThemePicker";
import { noteDisplayName } from "../utils/displayName";
import { AiToolbarButton } from "@/features/ai/components/AiToolbarButton";
import { ToolbarOverflowMenu } from "./ToolbarOverflowMenu";

export type ViewMode = "edit" | "split" | "preview";

interface EditorToolbarProps {
  path: string;
  mode: ViewMode;
  /** 富文本笔记：隐藏视图切换、主题与大纲（所见即所得无需分栏） */
  richText?: boolean;
  saving?: boolean;
  dirty?: boolean;
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

/** 笔记操作栏：左侧标题锚点，右侧按「高频视图 → 中频工具 → 低频文件操作」分层分组。 */
export function EditorToolbar({ path, mode, richText = false, saving = false, dirty = false, saveError, onModeChange, onSave, onMove, onHistory, onWiki, onConvertToRichText, onExportPdf, onAi }: EditorToolbarProps) {
  const { t } = useTranslation();
  return (
    <div
      data-tauri-drag-region="deep"
      className="workspace-toolbar flex min-h-16 items-center justify-between gap-4 border-b border-border bg-bg-primary px-6 py-2.5"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="truncate text-[15px] font-semibold tracking-[-0.01em]">
          {noteDisplayName(path.split("/").at(-1) ?? path)}
        </span>
        <SaveStatus saving={saving} dirty={dirty} />
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <div className="flex items-center gap-1">
          {!richText ? (
            <>
              <ModeTabs mode={mode} onChange={onModeChange} />
              <ToolbarDivider />
              <NoteThemePicker />
            </>
          ) : null}
          <ToolbarIconButton icon={History} label={t("history.title")} onClick={onHistory} />
          {!richText ? <ToolbarIconButton icon={Link2} label={t("wiki.title")} onClick={onWiki} /> : null}
          {onAi ? <AiToolbarButton onOpen={onAi} /> : null}
          <ToolbarDivider />
          <ToolbarOverflowMenu
            richText={richText}
            hasConvert={Boolean(onConvertToRichText)}
            isPdfAvailable={Boolean(onExportPdf)}
            onExportPdf={onExportPdf}
            onConvert={onConvertToRichText}
            onMove={onMove}
          />
        </div>
        <SaveErrorMessage message={saveError} onRetry={onSave} />
      </div>
    </div>
  );
}

function SaveStatus({ saving, dirty }: { saving: boolean; dirty: boolean }) {
  const { t } = useTranslation();
  const label = saving ? t("common.saving") : dirty ? t("note.unsaved") : t("note.saved");
  const tone = saving ? "text-text-secondary" : dirty ? "text-warning" : "text-success";
  return (
    <span role="status" aria-live="polite" className={`inline-flex shrink-0 items-center gap-1 text-xs ${tone}`}>
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

/**
 * 工具条图标按钮：统一直观尺寸，整套图标选用近似笔画/占位深度的字形，观感一致。
 */
function ToolbarIconButton({ icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return <IconButton icon={icon} label={label} onClick={onClick} />;
}

function ToolbarDivider() {
  return <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />;
}

function SaveErrorMessage({ message, onRetry }: { message: string | null | undefined; onRetry: () => void }) {
  const { t } = useTranslation();
  if (!message) return null;
  return (
    <span role="status" className="flex max-w-72 items-center gap-2 text-xs text-danger">
      <span className="truncate" title={message}>{message}</span>
      <button type="button" className="shrink-0 underline underline-offset-2 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2" onClick={onRetry}>
        {t("note.retrySave")}
      </button>
    </span>
  );
}

function ModeTabs({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  const { t } = useTranslation();
  const tabClass = (active: boolean) =>
    `inline-flex h-8 items-center gap-1.5 px-2.5 text-xs font-medium transition-colors ${active ? "bg-accent/10 text-accent shadow-sm" : "text-text-secondary hover:text-text-primary"}`;
  return (
    <div role="tablist" aria-label={t("note.viewMode")} className="flex h-9 items-center overflow-hidden rounded-lg border border-border bg-bg-secondary p-0.5">
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
            <Icon size={16} />
            {t(labelKey)}
          </button>
        );
      })}
    </div>
  );
}

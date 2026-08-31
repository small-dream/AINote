import { useState } from "react";
import { RotateCcw, X } from "lucide-react";
import { messageOf } from "@/api";
import { Button } from "@/components/atoms/Button";
import { useTranslation } from "@/i18n";
import { useFileHistory } from "../hooks/useFileHistory";
import { CommitList } from "./CommitList";
import { DiffView } from "./DiffView";
import { formatDate } from "../utils/format";

interface HistoryPanelProps {
  repoPath: string | null;
  path: string | null;
  open: boolean;
  onClose: () => void;
  onRestored: () => void;
}

/** 版本历史面板：提交列表 + 选中提交 diff + 恢复此版本（P1-1） */
export function HistoryPanel({ repoPath, path, open, onClose, onRestored }: HistoryPanelProps) {
  const { t } = useTranslation();
  const history = useFileHistory({ repoPath, path, open, onClose, onRestored });
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("history.title")}
        className="mx-auto mt-16 flex h-[70vh] w-[min(900px,90vw)] flex-col overflow-hidden rounded-xl bg-bg-primary shadow-2xl"
      >
        <PanelHeader path={path} onClose={onClose} />
        <div className="flex min-h-0 flex-1">
          <CommitList commits={history.commits} selectedId={history.selectedId} onSelect={history.onSelect} />
          <DiffPane history={history} />
        </div>
      </div>
    </div>
  );
}

function PanelHeader({ path, onClose }: { path: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold">{t("history.title")}</h2>
        <p className="truncate text-[11px] text-text-tertiary">{path}</p>
      </div>
      <button
        type="button"
        aria-label={t("common.cancel")}
        onClick={onClose}
        className="shrink-0 rounded p-1 text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
      >
        <X size={16} />
      </button>
    </div>
  );
}

interface DiffPaneProps {
  history: ReturnType<typeof useFileHistory>;
}

function DiffPane({ history }: DiffPaneProps) {
  const { t } = useTranslation();
  const selected = history.commits.find((c) => c.id === history.selectedId);
  const errorMessage = history.restoreError ? messageOf(history.restoreError) : null;

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col border-l border-border">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{selected?.message ?? t("history.noSelection")}</p>
          <p className="mt-0.5 truncate text-[11px] text-text-tertiary">
            {selected ? `${selected.author} · ${formatDate(selected.timestamp)} · ${selected.shortId}` : ""}
          </p>
        </div>
        {selected && (
          <RestoreControl
            key={selected.id}
            restoring={history.restoring}
            onRestore={history.handleRestore}
          />
        )}
      </div>
      {errorMessage && <p className="border-b border-border px-4 py-2 text-xs text-danger">{errorMessage}</p>}
      <DiffView diff={history.diff} loading={history.diffLoading} />
    </section>
  );
}

interface RestoreControlProps {
  restoring: boolean;
  onRestore: () => void;
}

function RestoreControl({ restoring, onRestore }: RestoreControlProps) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <div className="flex shrink-0 items-center gap-1.5">
        <Button variant="ghost" className="text-xs" onClick={() => setConfirming(false)} disabled={restoring}>
          {t("common.cancel")}
        </Button>
        <Button className="inline-flex items-center gap-1.5 text-xs" onClick={onRestore} disabled={restoring}>
          <RotateCcw size={14} />
          {restoring ? t("history.restoring") : t("history.confirmRestore")}
        </Button>
      </div>
    );
  }
  return (
    <Button
      variant="ghost"
      className="inline-flex shrink-0 items-center gap-1.5 border border-transparent text-xs hover:border-border"
      onClick={() => setConfirming(true)}
    >
      <RotateCcw size={14} />
      {t("history.restore")}
    </Button>
  );
}

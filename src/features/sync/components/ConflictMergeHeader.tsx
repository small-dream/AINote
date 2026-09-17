import { X } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { Tooltip } from "@/components/atoms/Tooltip";
import { useIsMobileViewport } from "@/hooks/useIsMobileViewport";
import { useTranslation } from "@/i18n";
import type { ConflictMergeController } from "../hooks/useConflictMerge";
import { ExportConflictsButton } from "./ExportConflictsButton";

interface ConflictMergeHeaderProps {
  merge: ConflictMergeController;
  onClose: () => void;
}

/** 对话框头部：桌面一行放完，移动端拆成「文件名 + 操作」「文件切换」「批量」三行 */
export function ConflictMergeHeader({ merge, onClose }: ConflictMergeHeaderProps) {
  const isMobile = useIsMobileViewport();
  const ready = merge.phase === "ready";
  return isMobile ? (
    <MobileConflictHeader merge={merge} onClose={onClose} ready={ready} />
  ) : (
    <DesktopConflictHeader merge={merge} onClose={onClose} ready={ready} />
  );
}

function DesktopConflictHeader({ merge, onClose, ready }: ConflictMergeHeaderProps & { ready: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-2.5">
      <h2 className="shrink-0 text-sm font-semibold">{t("sync.conflictMerge")}</h2>
      {ready ? <ConflictFileTabs conflicts={merge.conflicts} current={merge.current} onSelect={merge.setCurrent} /> : <span className="min-w-0 flex-1" />}
      <div className="flex shrink-0 items-center gap-1.5">
        {ready ? <ExportConflictsButton /> : null}
        {ready ? <ConflictBulkActions merge={merge} /> : null}
        <CloseButton onClose={onClose} />
      </div>
    </div>
  );
}

function MobileConflictHeader({ merge, onClose, ready }: ConflictMergeHeaderProps & { ready: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex shrink-0 flex-col gap-1.5 border-b border-border px-3 pb-2 pt-2">
      <div className="flex items-center gap-1">
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{merge.file?.path ?? t("sync.conflictMerge")}</h2>
        {ready ? <ExportConflictsButton compact /> : null}
        <CloseButton onClose={onClose} touch />
      </div>
      {ready && merge.conflicts.length > 1 ? (
        <ConflictFileTabs conflicts={merge.conflicts} current={merge.current} onSelect={merge.setCurrent} />
      ) : null}
      {ready ? <ConflictBulkActions merge={merge} touch /> : null}
    </div>
  );
}

function ConflictFileTabs({ conflicts, current, onSelect }: { conflicts: ConflictMergeController["conflicts"]; current: number; onSelect: (index: number) => void }) {
  return (
    <div className="conflict-file-tabs flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
      {conflicts.map((conflict, index) => (
        <button
          key={conflict.path}
          type="button"
          title={conflict.path}
          onClick={() => onSelect(index)}
          className={`shrink-0 rounded-md px-2.5 py-1 text-xs transition-colors ${index === current ? "bg-accent/10 text-accent" : "text-text-secondary hover:bg-bg-secondary"}`}
        >
          {conflict.path}
        </button>
      ))}
    </div>
  );
}

function ConflictBulkActions({ merge, touch = false }: { merge: ConflictMergeController; touch?: boolean }) {
  const { t } = useTranslation();
  const busy = merge.resolving;
  const localLabel = merge.pending === "all" ? t("sync.resolving") : t("sync.keepLocalAll");
  const remoteLabel = merge.pending === "all" ? t("sync.resolving") : t("sync.keepRemoteAll");
  const size = touch ? "min-h-11 flex-1 border border-border" : "px-2 text-xs";
  return (
    <div className={touch ? "flex shrink-0 items-center gap-2" : "flex shrink-0 items-center gap-1.5"}>
      <Button variant="ghost" className={size} disabled={busy} onClick={() => merge.keepAll(true)}>
        {localLabel}
      </Button>
      <Button variant="ghost" className={size} disabled={busy} onClick={() => merge.keepAll(false)}>
        {remoteLabel}
      </Button>
    </div>
  );
}

function CloseButton({ onClose, touch = false }: { onClose: () => void; touch?: boolean }) {
  const { t } = useTranslation();
  const size = touch ? "grid h-11 w-11 place-items-center rounded-xl" : "p-1";
  return (
    <Tooltip content={t("common.close")}>
      <button
        type="button"
        aria-label={t("common.cancel")}
        onClick={onClose}
        className={`shrink-0 text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary active:bg-bg-tertiary ${size}`}
      >
        <X size={touch ? 20 : 16} />
      </button>
    </Tooltip>
  );
}

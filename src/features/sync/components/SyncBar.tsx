import { useState } from "react";
import { Check, Cloud, CloudOff, History, RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { useSync } from "../hooks/useSync";
import { deriveSyncHeader, type SyncOperation, type SyncTone } from "../utils/status";
import { ConflictMergeDialog } from "./ConflictMergeDialog";
import { useTranslation } from "@/i18n";

const TONE_DOT: Record<SyncTone, string> = {
  synced: "bg-success",
  pending: "bg-warning",
  conflict: "bg-danger",
  offline: "bg-text-secondary",
};

const TONE_ICON: Record<SyncTone, typeof Check> = {
  synced: Check,
  pending: Cloud,
  conflict: TriangleAlert,
  offline: CloudOff,
};

interface SyncBarProps {
  repoPath: string | null;
  startupSyncing?: boolean;
}

/** 顶部同步状态条：状态点 + 文案 + 一键同步（P0-4/P0-5/P0-6） */
export function SyncBar({ repoPath, startupSyncing = false }: SyncBarProps) {
  const { locale, t } = useTranslation();
  const { online, syncNow, isSyncing, status, resolving, checkpoint, committing } = useSync(repoPath);
  const [conflictOpen, setConflictOpen] = useState(false);
  const operation = getOperation(startupSyncing, isSyncing, resolving);
  const display = deriveSyncHeader(status, online, operation, locale);
  const StatusIcon = TONE_ICON[display.tone];

  return (
    <div className="flex min-h-12 items-center justify-between gap-4 border-b border-border bg-bg-secondary px-5 py-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${TONE_DOT[display.tone]} text-white`}>
          <StatusIcon size={14} strokeWidth={2.2} />
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[13px] font-medium text-text-primary">{display.text}</p>
          <p className="mt-0.5 truncate text-[11px] text-text-tertiary">{repoPath ? t("sync.localLibrary") : t("sync.noLibrary")}{!online && t("sync.offlineEdit")}</p>
        </div>
      </div>
      <SyncActions
        status={status}
        online={online}
        busy={display.busy}
        buttonLabel={display.buttonLabel}
        checkpoint={checkpoint}
        committing={committing}
        syncNow={syncNow}
        onConflict={() => setConflictOpen(true)}
      />
      <ConflictMergeDialog repoPath={repoPath} open={conflictOpen} onClose={() => setConflictOpen(false)} />
    </div>
  );
}

interface SyncActionsProps {
  status: ReturnType<typeof useSync>["status"];
  online: boolean;
  busy: boolean;
  buttonLabel: string;
  checkpoint: ReturnType<typeof useSync>["checkpoint"];
  committing: boolean;
  syncNow: ReturnType<typeof useSync>["syncNow"];
  onConflict: () => void;
}

function SyncActions({ status, online, busy, buttonLabel, checkpoint, committing, syncNow, onConflict }: SyncActionsProps) {
  const { t } = useTranslation();
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {!status.conflicted && (
        <Button
          variant="ghost"
          aria-label={t("sync.checkpoint")}
          title={t("sync.checkpointHint")}
          className="inline-flex items-center gap-1.5 border border-transparent px-2.5 text-xs hover:border-border"
          onClick={() => checkpoint.mutate("note: checkpoint")}
          disabled={!status.hasUncommitted || committing || checkpoint.isPending}
        >
          <History size={14} />
          <span>{checkpoint.isPending ? t("common.saving") : t("sync.checkpoint")}</span>
        </Button>
      )}
      {status.conflicted ? (
        <Button variant="primary" className="inline-flex items-center gap-1.5 px-3 text-xs" onClick={onConflict}>
          <TriangleAlert size={14} />
          {t("sync.resolveConflict")}
        </Button>
      ) : (
        <Button
          variant="primary"
          className="inline-flex items-center gap-1.5 px-3.5 text-xs font-medium"
          onClick={() => syncNow.mutate()}
          disabled={!online || busy}
        >
          <RefreshCw size={14} className={busy ? "animate-spin" : ""} />
          {buttonLabel}
        </Button>
      )}
    </div>
  );
}

function getOperation(startupSyncing: boolean, isSyncing: boolean, resolving: boolean): SyncOperation {
  if (startupSyncing) return "startup";
  if (isSyncing) return "syncing";
  if (resolving) return "resolving";
  return null;
}

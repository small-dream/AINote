import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import { useSync } from "../hooks/useSync";
import { deriveSyncHeader, type SyncOperation, type SyncTone } from "../utils/status";
import { ConflictDialog } from "./ConflictDialog";

const TONE_DOT: Record<SyncTone, string> = {
  synced: "bg-success",
  pending: "bg-warning",
  conflict: "bg-danger",
  offline: "bg-text-secondary",
};

interface SyncBarProps {
  repoPath: string | null;
  startupSyncing?: boolean;
}

/** 顶部同步状态条：状态点 + 文案 + 一键同步（P0-4/P0-5/P0-6） */
export function SyncBar({ repoPath, startupSyncing = false }: SyncBarProps) {
  const { online, syncNow, isSyncing, status, resolve, resolving, checkpoint, committing } = useSync(repoPath);
  const [conflictOpen, setConflictOpen] = useState(false);
  const operation = getOperation(startupSyncing, isSyncing, resolving);
  const display = deriveSyncHeader(status, online, operation);

  return (
    <div className="flex min-h-11 items-center justify-between border-b border-border bg-bg-secondary px-4 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${TONE_DOT[display.tone]}`} />
        <span className="truncate text-sm text-text-secondary">{display.text}</span>
        {!online && <span className="shrink-0 text-xs text-warning">离线模式</span>}
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
      <ConflictDialog
        open={conflictOpen}
        pending={resolving}
        onClose={() => setConflictOpen(false)}
        onResolve={(useLocal) => {
          resolve.mutate(useLocal);
          setConflictOpen(false);
        }}
      />
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
  return (
    <div className="flex shrink-0 items-center gap-2">
      {!status.conflicted && (
        <Button variant="ghost" onClick={() => checkpoint.mutate("note: checkpoint")} disabled={!status.hasUncommitted || committing || checkpoint.isPending}>
          {checkpoint.isPending ? "保存中…" : "保存版本"}
        </Button>
      )}
      {status.conflicted ? (
        <Button variant="primary" onClick={onConflict}>解决冲突</Button>
      ) : (
        <Button variant="primary" onClick={() => syncNow.mutate()} disabled={!online || busy}>{buttonLabel}</Button>
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

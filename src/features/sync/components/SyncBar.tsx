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
  const { online, syncNow, isSyncing, status, resolve, resolving } = useSync(repoPath);
  const [conflictOpen, setConflictOpen] = useState(false);
  const operation = getOperation(startupSyncing, isSyncing, resolving);
  const display = deriveSyncHeader(status, online, operation);

  return (
    <div className="flex items-center justify-between border-b border-bg-secondary px-4 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${TONE_DOT[display.tone]}`} />
        <span className="truncate text-sm text-text-secondary">{display.text}</span>
        {!online && <span className="shrink-0 text-xs text-warning">离线模式</span>}
      </div>
      {status.conflicted ? (
        <Button variant="primary" onClick={() => setConflictOpen(true)}>
          解决冲突
        </Button>
      ) : (
        <Button variant="primary" onClick={() => syncNow.mutate()} disabled={!online || display.busy}>
          {display.buttonLabel}
        </Button>
      )}
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

function getOperation(startupSyncing: boolean, isSyncing: boolean, resolving: boolean): SyncOperation {
  if (startupSyncing) return "startup";
  if (isSyncing) return "syncing";
  if (resolving) return "resolving";
  return null;
}

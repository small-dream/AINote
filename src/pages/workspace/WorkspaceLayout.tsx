import type { RefObject } from "react";
import type { NoteEditorHandle } from "@/features/note/components/NoteEditor";
import { WorkspaceNavRail } from "./WorkspaceNavRail";
import type { WorkspaceActions } from "./useWorkspaceActions";
import { WorkspaceColumns } from "./WorkspaceColumns";
import { useSync } from "@/features/sync/hooks/useSync";
import { SyncNotice } from "@/features/sync/components/SyncNotice";

export interface WorkspaceContentProps {
  repoPath: string | null;
  currentNotePath: string | null;
  editorRef: RefObject<NoteEditorHandle | null>;
  actions: WorkspaceActions;
  onSelect: (path: string) => void;
  historyRequestPath: string | null;
  setHistoryRequestPath: (path: string | null) => void;
}

interface WorkspaceLayoutProps extends WorkspaceContentProps {
  startupSyncing: boolean;
}

/** 桌面三栏壳：同步编排在此持有单一实例，导航轨与失败横幅共享同一份失败态。 */
export function WorkspaceLayout({ repoPath, startupSyncing, currentNotePath, editorRef, actions, onSelect, historyRequestPath, setHistoryRequestPath }: WorkspaceLayoutProps) {
  const sync = useSync(repoPath);
  return (
    <>
      <WorkspaceNavRail repoPath={repoPath} startupSyncing={startupSyncing} sync={sync} />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-bg-primary">
        <SyncNotice sync={sync} />
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <WorkspaceColumns
            repoPath={repoPath}
            currentNotePath={currentNotePath}
            createdPath={actions.createdPath}
            editorRef={editorRef}
            onSelect={onSelect}
            onRequestHistory={(path) => { setHistoryRequestPath(path); onSelect(path); }}
            historyRequestPath={historyRequestPath}
            onHistoryRequestHandled={() => setHistoryRequestPath(null)}
            onRequestNew={actions.requestNew}
            onRequestFolder={actions.requestNewFolder}
            onRequestImport={actions.importFiles}
            onRequestImportNotes={actions.importNotes}
            onSetMove={actions.setMoveTarget}
            onSetRename={actions.setRenameTarget}
          />
        </div>
      </main>
    </>
  );
}

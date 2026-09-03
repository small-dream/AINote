import { FileTree } from "@/features/file-tree/components/FileTree";
import { TagIndex } from "@/features/wiki/components/TagIndex";
import { TrashPanel } from "@/features/trash/components/TrashPanel";
import { useUiStore } from "@/stores/ui.store";
import type { NoteKind } from "@/api/types";

interface WorkspaceSidebarProps {
  repoPath: string | null;
  onSelect: (path: string) => void;
  onRequestNew: (dir: string, kind?: NoteKind) => void;
  onRequestFolder: (dir: string) => void;
  onRequestImport: (files: File[]) => Promise<void>;
  onRequestImportNotes: (dir: string, files: File[]) => Promise<void>;
  createDir?: string;
  onRequestMove: (path: string) => void;
  onRequestRename: (path: string) => void;
  onRequestHistory: (path: string) => void;
}

/** 侧边栏内容区；内容切换入口统一位于工作区导航轨道（P0-3 / P1-5 / P2-1）。 */
export function WorkspaceSidebar({
  repoPath,
  onSelect,
  onRequestNew,
  onRequestFolder,
  onRequestImport,
  onRequestImportNotes,
  createDir = "",
  onRequestMove,
  onRequestRename,
  onRequestHistory,
}: WorkspaceSidebarProps) {
  const tab = useUiStore((s) => s.sidebarTab);
  return (
    <div className="flex min-h-0 w-[248px] shrink-0 flex-col border-r border-border bg-bg-secondary/80">
      {tab === "tree" ? (
        <FileTree repoPath={repoPath} onSelect={onSelect} onRequestNew={onRequestNew} onRequestFolder={onRequestFolder} onRequestImport={onRequestImport} onRequestImportNotes={onRequestImportNotes} createDir={createDir} onRequestMove={onRequestMove} onRequestRename={onRequestRename} onRequestHistory={onRequestHistory} />
      ) : tab === "tags" ? (
        <TagIndex repoPath={repoPath} onSelect={onSelect} />
      ) : (
        <TrashPanel repoPath={repoPath} onSelect={onSelect} />
      )}
    </div>
  );
}

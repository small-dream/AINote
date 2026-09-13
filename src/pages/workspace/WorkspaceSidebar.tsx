import { FileTree } from "@/features/file-tree/components/FileTree";
import { RecentPanel } from "@/features/recent/components/RecentPanel";
import { FavoritePanel } from "@/features/favorites/components/FavoritePanel";
import { TagIndex } from "@/features/wiki/components/TagIndex";
import { TrashPanel } from "@/features/trash/components/TrashPanel";
import { RepoSwitcher } from "@/features/file-tree/components/RepoSwitcher";
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
  sidebarWidth: number;
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
  sidebarWidth,
}: WorkspaceSidebarProps) {
  const tab = useUiStore((s) => s.sidebarTab);

  return (
    <div className="workspace-sidebar flex h-full min-h-0 shrink-0 flex-col overflow-hidden bg-bg-secondary" style={{ width: sidebarWidth }}>
      {/* 仓库标识常驻：目录、最近、收藏、标签、回收站都只作用于当前仓库 */}
      <div className="min-w-0 shrink-0 border-b border-border px-3 py-2">
        <RepoSwitcher />
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        {tab === "tree" ? (
          <FileTree repoPath={repoPath} onSelect={onSelect} onRequestNew={onRequestNew} onRequestFolder={onRequestFolder} onRequestImport={onRequestImport} onRequestImportNotes={onRequestImportNotes} createDir={createDir} onRequestMove={onRequestMove} onRequestRename={onRequestRename} onRequestHistory={onRequestHistory} />
        ) : tab === "recent" ? (
          <RecentPanel repoPath={repoPath} onSelect={onSelect} />
        ) : tab === "favorites" ? (
          <FavoritePanel repoPath={repoPath} onSelect={onSelect} />
        ) : tab === "tags" ? (
          <TagIndex repoPath={repoPath} onSelect={onSelect} />
        ) : (
          <TrashPanel repoPath={repoPath} onSelect={onSelect} />
        )}
      </div>
    </div>
  );
}

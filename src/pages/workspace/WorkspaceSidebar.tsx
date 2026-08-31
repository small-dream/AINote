import { FileTree } from "@/features/file-tree/components/FileTree";

interface WorkspaceSidebarProps {
  repoPath: string | null;
  onSelect: (path: string) => void;
  onRequestNew: (dir: string) => void;
  onRequestFolder: (dir: string) => void;
  onRequestMove: (path: string) => void;
}

/** 目录区：仅承载文件树，顶部不再占用额外的账户信息区域。 */
export function WorkspaceSidebar({
  repoPath,
  onSelect,
  onRequestNew,
  onRequestFolder,
  onRequestMove,
}: WorkspaceSidebarProps) {
  return (
    <div className="flex min-h-0 w-[248px] shrink-0 flex-col border-r border-border bg-bg-secondary/80">
      <FileTree repoPath={repoPath} onSelect={onSelect} onRequestNew={onRequestNew} onRequestFolder={onRequestFolder} onRequestMove={onRequestMove} />
    </div>
  );
}

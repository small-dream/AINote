import { Button } from "@/components/atoms/Button";
import type { TreeNode } from "@/api/types";
import { useSessionStore } from "@/stores/session.store";
import { useFileTree } from "../hooks/useFileTree";

interface FileTreeProps {
  repoPath: string | null;
  onSelect: (path: string) => void;
  onRequestNew: (dir: string) => void;
  onRequestFolder: (dir: string) => void;
}

/** 目录树（P0-3）：目录可折叠、可在目录内新建笔记/文件夹；文件点击打开 */
export function FileTree({ repoPath, onSelect, onRequestNew, onRequestFolder }: FileTreeProps) {
  const { tree, isLoading, expanded, toggle } = useFileTree(repoPath);
  const currentNotePath = useSessionStore((s) => s.currentNotePath);

  if (isLoading || !tree) {
    return <div className="p-4 text-sm text-text-secondary">加载中…</div>;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-bg-secondary px-2 py-1.5">
        <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => onRequestNew("")}>
          ＋ 笔记
        </Button>
        <Button
          variant="ghost"
          className="px-2 py-1 text-xs"
          onClick={() => onRequestFolder("")}
        >
          ＋ 文件夹
        </Button>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto p-2" aria-label="笔记目录树">
        <TreeNodeItem
          node={tree}
          depth={0}
          expanded={expanded}
          currentNotePath={currentNotePath}
          onToggle={toggle}
          onSelect={onSelect}
          onRequestNew={onRequestNew}
          onRequestFolder={onRequestFolder}
        />
      </nav>
    </div>
  );
}

interface TreeNodeItemProps {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  currentNotePath: string | null;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
  onRequestNew: (dir: string) => void;
  onRequestFolder: (dir: string) => void;
}

function TreeNodeItem(props: TreeNodeItemProps) {
  return props.node.nodeType === "dir" ? <DirNode {...props} /> : <FileNode {...props} />;
}

function FileNode({ node, depth, currentNotePath, onSelect }: TreeNodeItemProps) {
  const active = node.path === currentNotePath;
  return (
    <button
      className={`flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-sm ${active ? "bg-accent/15 text-accent" : "text-text-primary hover:bg-bg-secondary"}`}
      style={{ paddingLeft: `${depth * 14 + 8}px` }}
      onClick={() => onSelect(node.path)}
    >
      <span className="text-text-secondary">📄</span>
      <span className="truncate">{node.name}</span>
    </button>
  );
}

function DirNode({ node, depth, expanded, currentNotePath, onToggle, onSelect, onRequestNew, onRequestFolder }: TreeNodeItemProps) {
  const isOpen = expanded.has(node.path);
  return (
    <div>
      <DirRow
        node={node}
        depth={depth}
        isOpen={isOpen}
        onToggle={onToggle}
        onRequestNew={onRequestNew}
        onRequestFolder={onRequestFolder}
      />
      {isOpen &&
        node.children.map((child) => (
          <TreeNodeItem
            key={child.path}
            node={child}
            depth={depth + 1}
            expanded={expanded}
            currentNotePath={currentNotePath}
            onToggle={onToggle}
            onSelect={onSelect}
            onRequestNew={onRequestNew}
            onRequestFolder={onRequestFolder}
          />
        ))}
    </div>
  );
}

interface DirRowProps {
  node: TreeNode;
  depth: number;
  isOpen: boolean;
  onToggle: (path: string) => void;
  onRequestNew: (dir: string) => void;
  onRequestFolder: (dir: string) => void;
}

function DirRow({ node, depth, isOpen, onToggle, onRequestNew, onRequestFolder }: DirRowProps) {
  return (
    <div className="group flex items-center" style={{ paddingLeft: `${depth * 14 + 4}px` }}>
      <button
        className="flex min-w-0 flex-1 items-center gap-1.5 rounded py-1 text-left text-sm text-text-primary hover:bg-bg-secondary"
        onClick={() => onToggle(node.path)}
      >
        <span className="w-3 shrink-0 text-text-secondary">{isOpen ? "▾" : "▸"}</span>
        <span className="shrink-0 text-text-secondary">📁</span>
        <span className="truncate">{node.name}</span>
      </button>
      <button
        title="在此目录新建笔记"
        className="shrink-0 px-1 py-1 text-sm text-text-secondary opacity-0 group-hover:opacity-100"
        onClick={(event) => {
          event.stopPropagation();
          onRequestNew(node.path);
        }}
      >
        📄＋
      </button>
      <button
        title="在此目录新建文件夹"
        className="shrink-0 px-1 py-1 text-sm text-text-secondary opacity-0 group-hover:opacity-100"
        onClick={(event) => {
          event.stopPropagation();
          onRequestFolder(node.path);
        }}
      >
        📁＋
      </button>
    </div>
  );
}

import type { TreeNode } from "@/api/types";
import { useSessionStore } from "@/stores/session.store";
import { useFileTree } from "../hooks/useFileTree";

interface FileTreeProps {
  repoPath: string | null;
  onSelect: (path: string) => void;
}

/** 目录树（P0-3）：目录可折叠，文件点击打开 */
export function FileTree({ repoPath, onSelect }: FileTreeProps) {
  const { tree, isLoading, expanded, toggle } = useFileTree(repoPath);
  const currentNotePath = useSessionStore((s) => s.currentNotePath);

  if (isLoading || !tree) {
    return <div className="p-4 text-sm text-text-secondary">加载中…</div>;
  }

  return (
    <nav className="overflow-y-auto p-2" aria-label="笔记目录树">
      <TreeNodeItem node={tree} depth={0} expanded={expanded} currentNotePath={currentNotePath} onToggle={toggle} onSelect={onSelect} />
    </nav>
  );
}

interface TreeNodeItemProps {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  currentNotePath: string | null;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
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

function DirNode({ node, depth, expanded, currentNotePath, onToggle, onSelect }: TreeNodeItemProps) {
  const isOpen = expanded.has(node.path);
  return (
    <div>
      <button
        className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-sm text-text-primary hover:bg-bg-secondary"
        style={{ paddingLeft: `${depth * 14 + 4}px` }}
        onClick={() => onToggle(node.path)}
      >
        <span className="w-3 text-text-secondary">{isOpen ? "▾" : "▸"}</span>
        <span className="text-text-secondary">📁</span>
        <span className="truncate">{node.name}</span>
      </button>
      {isOpen &&
        node.children.map((child) => (
          <TreeNodeItem key={child.path} node={child} depth={depth + 1} expanded={expanded} currentNotePath={currentNotePath} onToggle={onToggle} onSelect={onSelect} />
        ))}
    </div>
  );
}

import type { MouseEvent } from "react";
import { FilePenLine } from "lucide-react";
import type { NoteKind, TreeNode } from "@/api/types";
import { noteDisplayName } from "@/features/note/utils/displayName";
import { noteKindOfPath } from "@/features/note/utils/noteKind";
import { useTranslation } from "@/i18n";
import { CreateMenu } from "./CreateMenu";

export interface TreeNodesProps {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  currentNotePath: string | null;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
  onRequestNew: (dir: string, kind?: NoteKind) => void;
  onRequestFolder: (dir: string) => void;
  onRequestImport: (files: File[]) => Promise<void>;
  onContextMenu: (event: MouseEvent, node: TreeNode) => void;
}

/** 递归渲染目录树节点：目录可折叠，文件可打开。 */
export function TreeNodes(props: TreeNodesProps) {
  return props.node.nodeType === "dir" ? <DirNode {...props} /> : <FileNode {...props} />;
}

function FileNode({ node, depth, currentNotePath, onSelect, onContextMenu }: TreeNodesProps) {
  const active = node.path === currentNotePath;
  const isRichText = noteKindOfPath(node.path) === "richText";
  return (
    <button
      className={`flex min-h-8 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${active ? "bg-accent-soft font-medium text-accent" : "text-text-primary hover:bg-bg-tertiary"}`}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
      onClick={() => onSelect(node.path)}
      onContextMenu={(event) => onContextMenu(event, node)}
    >
      {isRichText ? (
        <FilePenLine size={15} strokeWidth={active ? 2.2 : 1.8} className={active ? "text-accent" : "text-text-tertiary"} aria-hidden="true" />
      ) : (
        <span className={`tree-file flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border text-[9px] font-semibold ${active ? "border-accent/40 text-accent" : "border-text-tertiary text-text-tertiary"}`} aria-hidden="true">M</span>
      )}
      <span className="truncate">{noteDisplayName(node.name)}</span>
    </button>
  );
}

function DirNode({ node, depth, expanded, currentNotePath, onToggle, onSelect, onRequestNew, onRequestFolder, onRequestImport, onContextMenu }: TreeNodesProps) {
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
        onRequestImport={onRequestImport}
        onContextMenu={onContextMenu}
      />
      {isOpen &&
        node.children.map((child) => (
          <TreeNodes
            key={child.path}
            node={child}
            depth={depth + 1}
            expanded={expanded}
            currentNotePath={currentNotePath}
            onToggle={onToggle}
            onSelect={onSelect}
            onRequestNew={onRequestNew}
            onRequestFolder={onRequestFolder}
            onRequestImport={onRequestImport}
            onContextMenu={onContextMenu}
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
  onRequestNew: (dir: string, kind?: NoteKind) => void;
  onRequestFolder: (dir: string) => void;
  onRequestImport: (files: File[]) => Promise<void>;
  onContextMenu: (event: MouseEvent, node: TreeNode) => void;
}

function DirRow({ node, depth, isOpen, onToggle, onRequestNew, onRequestFolder, onRequestImport, onContextMenu }: DirRowProps) {
  const { t } = useTranslation();
  const label = node.path === "" ? t("tree.allNotes") : node.name;
  return (
    <div className="group flex items-center" style={{ paddingLeft: `${depth * 16 + 4}px` }}>
      <button
        aria-expanded={isOpen}
        className="flex min-h-8 min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium text-text-primary transition-colors hover:bg-bg-tertiary"
        onClick={() => onToggle(node.path)}
        onContextMenu={(event) => onContextMenu(event, node)}
      >
        <span className={`tree-chevron ${isOpen ? "tree-chevron-open" : ""}`} aria-hidden="true" />
        <span className={`tree-folder ${isOpen ? "tree-folder-open" : ""}`} aria-hidden="true" />
        <span className="truncate">{label}</span>
      </button>
      <CreateMenu
        compact
        className="pointer-events-none opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
        onCreateNote={(kind) => Promise.resolve(onRequestNew(node.path, kind))}
        onCreateFolder={() => onRequestFolder(node.path)}
        onImportFiles={onRequestImport}
      />
    </div>
  );
}

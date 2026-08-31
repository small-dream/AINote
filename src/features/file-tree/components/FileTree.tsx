import type { ComponentProps, MouseEvent } from "react";
import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import type { TreeNode } from "@/api/types";
import { messageOf } from "@/api";
import { useDeleteNoteMutation } from "@/queries/note.queries";
import { useDeleteFolderMutation } from "@/queries/tree.queries";
import { useSessionStore } from "@/stores/session.store";
import { useFileTree } from "../hooks/useFileTree";
import { useTreeContextMenu } from "../hooks/useTreeContextMenu";
import { TreeContextMenu as TreeContextMenuView } from "./TreeContextMenu";
import { DeleteConfirmDialog, type PendingDelete } from "./DeleteConfirmDialog";

interface FileTreeProps {
  repoPath: string | null;
  onSelect: (path: string) => void;
  onRequestNew: (dir: string) => void;
  onRequestFolder: (dir: string) => void;
  onRequestMove: (path: string) => void;
}

/** 目录树（P0-3）：目录可折叠、可在目录内新建笔记/文件夹；文件点击打开 */
export function FileTree({ repoPath, onSelect, onRequestNew, onRequestFolder, onRequestMove }: FileTreeProps) {
  const { tree, isLoading, expanded, toggle } = useFileTree(repoPath);

  if (isLoading || !tree) {
    return <div className="p-4 text-sm text-text-secondary">加载中…</div>;
  }

  return <TreeContent tree={tree} expanded={expanded} toggle={toggle} onSelect={onSelect} onRequestNew={onRequestNew} onRequestFolder={onRequestFolder} onRequestMove={onRequestMove} />;
}

function TreeContent({ tree, expanded, toggle, onSelect, onRequestNew, onRequestFolder, onRequestMove }: { tree: TreeNode; expanded: Set<string>; toggle: (path: string) => void; onSelect: (path: string) => void; onRequestNew: (dir: string) => void; onRequestFolder: (dir: string) => void; onRequestMove: (path: string) => void }) {
  const currentNotePath = useSessionStore((s) => s.currentNotePath);
  const openNote = useSessionStore((s) => s.openNote);
  const remove = useDeleteNoteMutation((path) => { if (path === currentNotePath) openNote(null); });
  const removeFolder = useDeleteFolderMutation((path) => { if (currentNotePath && (currentNotePath === path || currentNotePath.startsWith(`${path}/`))) openNote(null); });
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const contextMenu = useTreeContextMenu();
  const requestDelete = (path: string, isFolder: boolean) => { setDeleteError(null); setPendingDelete({ path, isFolder, name: contextMenu.menu?.node.name ?? path }); };
  const confirmDelete = async () => { if (!pendingDelete) return; try { if (pendingDelete.isFolder) await removeFolder.mutateAsync(pendingDelete.path); else await remove.mutateAsync(pendingDelete.path); setPendingDelete(null); } catch (error) { setDeleteError(messageOf(error)); } };
  return <div className="flex h-full min-h-0 flex-col">
    <TreeToolbar onRequestNew={onRequestNew} onRequestFolder={onRequestFolder} />
    <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-2" aria-label="笔记目录树"><TreeNodeItem node={tree} depth={0} expanded={expanded} currentNotePath={currentNotePath} onToggle={toggle} onSelect={onSelect} onRequestNew={onRequestNew} onRequestFolder={onRequestFolder} onContextMenu={contextMenu.open} /></nav>
    {deleteError && <div className="tree-error" role="alert">删除失败：{deleteError}</div>}
    <ContextMenuSlot menu={contextMenu.menu} copied={contextMenu.copied} onClose={contextMenu.close} onToggle={toggle} onSelect={onSelect} onRequestNew={onRequestNew} onRequestFolder={onRequestFolder} onRequestMove={onRequestMove} onDelete={(path) => requestDelete(path, false)} onDeleteFolder={(path) => requestDelete(path, true)} onCopy={contextMenu.copy} />
    <DeleteConfirmDialog pending={pendingDelete} busy={remove.isPending || removeFolder.isPending} onClose={() => setPendingDelete(null)} onConfirm={confirmDelete} />
  </div>;
}

function TreeToolbar({ onRequestNew, onRequestFolder }: Pick<FileTreeProps, "onRequestNew" | "onRequestFolder">) {
  return <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
    <span className="text-xs font-medium uppercase tracking-wide text-text-tertiary">目录</span>
    <div className="flex items-center gap-0.5">
      <Button aria-label="新建笔记" title="新建笔记" variant="ghost" className="tree-action h-7 w-7 p-0" onClick={() => onRequestNew("")}><span className="tree-plus-icon" aria-hidden="true" /></Button>
      <Button aria-label="新建文件夹" title="新建文件夹" variant="ghost" className="tree-action h-7 w-7 p-0" onClick={() => onRequestFolder("")}><span className="tree-new-folder-icon" aria-hidden="true"><span className="tree-new-folder-shape" /><span className="tree-new-folder-plus">+</span></span></Button>
    </div>
  </div>;
}

function ContextMenuSlot(props: Omit<ComponentProps<typeof TreeContextMenuView>, "menu"> & { menu: ComponentProps<typeof TreeContextMenuView>["menu"] | null }) {
  const { menu, ...rest } = props;
  return menu ? <TreeContextMenuView {...rest} menu={menu} /> : null;
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
  onContextMenu: (event: MouseEvent, node: TreeNode) => void;
}

function TreeNodeItem(props: TreeNodeItemProps) {
  return props.node.nodeType === "dir" ? <DirNode {...props} /> : <FileNode {...props} />;
}

function FileNode({ node, depth, currentNotePath, onSelect, onContextMenu }: TreeNodeItemProps) {
  const active = node.path === currentNotePath;
  return (
    <button
      className={`flex min-h-8 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${active ? "bg-accent-soft font-medium text-accent" : "text-text-primary hover:bg-bg-tertiary"}`}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
      onClick={() => onSelect(node.path)}
      onContextMenu={(event) => onContextMenu(event, node)}
    >
      <span className={`tree-file flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border text-[9px] font-semibold ${active ? "border-accent/40 text-accent" : "border-text-tertiary text-text-tertiary"}`} aria-hidden="true">M</span>
      <span className="truncate">{node.name}</span>
    </button>
  );
}

function DirNode({ node, depth, expanded, currentNotePath, onToggle, onSelect, onRequestNew, onRequestFolder, onContextMenu }: TreeNodeItemProps) {
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
        onContextMenu={onContextMenu}
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
  onRequestNew: (dir: string) => void;
  onRequestFolder: (dir: string) => void;
  onContextMenu: (event: MouseEvent, node: TreeNode) => void;
}

function DirRow({ node, depth, isOpen, onToggle, onRequestNew, onRequestFolder, onContextMenu }: DirRowProps) {
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
        <span className="truncate">{node.name}</span>
      </button>
      <button
        title="在此目录新建笔记"
        aria-label="在此目录新建笔记"
        className="tree-node-action shrink-0 rounded p-1 text-text-secondary opacity-0 transition-opacity hover:bg-bg-primary hover:text-accent group-hover:opacity-100"
        onClick={(event) => {
          event.stopPropagation();
          onRequestNew(node.path);
        }}
      >
        <span className="tree-plus-icon" aria-hidden="true" />
      </button>
      <button
        title="在此目录新建文件夹"
        aria-label="在此目录新建文件夹"
        className="tree-node-action shrink-0 rounded p-1 text-text-secondary opacity-0 transition-opacity hover:bg-bg-primary hover:text-accent group-hover:opacity-100"
        onClick={(event) => {
          event.stopPropagation();
          onRequestFolder(node.path);
        }}
      >
        <span className="tree-new-folder-icon" aria-hidden="true"><span className="tree-new-folder-shape" /><span className="tree-new-folder-plus">+</span></span>
      </button>
    </div>
  );
}

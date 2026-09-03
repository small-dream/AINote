import type { LucideIcon } from "lucide-react";
import type { ReactElement } from "react";
import { ChevronDown, ChevronRight, Copy, FilePlus2, FileText, FolderPlus, History, Move, Pencil, Trash2 } from "lucide-react";
import type { TreeNode } from "@/api/types";
import type { TreeContextMenuState } from "../hooks/useTreeContextMenu";
import { useTranslation } from "@/i18n";

interface Props {
  menu: TreeContextMenuState;
  copied: boolean;
  onClose: () => void;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
  onRequestNew: (dir: string) => void;
  onRequestFolder: (dir: string) => void;
  onRequestMove: (path: string) => void;
  onRequestRename: (path: string) => void;
  onRequestHistory: (path: string) => void;
  onDelete: (path: string) => void;
  onDeleteFolder: (path: string) => void;
  onCopy: (path: string) => void;
}

interface MenuActionProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  danger?: boolean;
}

export function TreeContextMenu({ menu, copied, onClose, onToggle, onSelect, onRequestNew, onRequestFolder, onRequestMove, onRequestRename, onRequestHistory, onDelete, onDeleteFolder, onCopy }: Props) {
  const { t } = useTranslation();
  const { node } = menu;
  const displayName = contextMenuDisplayName(node, t);
  const command = ({ icon: Icon, label, onClick, danger = false }: MenuActionProps) => (
    <button type="button" role="menuitem" className={`tree-menu-item ${danger ? "tree-menu-danger" : ""}`} onClick={(event) => { event.stopPropagation(); onClick(); onClose(); }}>
      <Icon size={15} strokeWidth={1.8} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="tree-context-menu" role="menu" aria-label={displayName} style={{ left: menu.x, top: menu.y }} onClick={(event) => event.stopPropagation()}>
      <div className="tree-menu-heading" title={node.path || displayName}>
        <span className="tree-menu-heading-type">{node.nodeType === "dir" ? t("tree.folderType") : t("tree.noteType")}</span>
        <span className="tree-menu-heading-name">{displayName}</span>
      </div>
      {node.nodeType === "dir" ? <FolderActions node={node} copied={copied} command={command} onToggle={onToggle} onRequestNew={onRequestNew} onRequestFolder={onRequestFolder} onDeleteFolder={onDeleteFolder} onCopy={onCopy} /> : <NoteActions node={node} copied={copied} command={command} onSelect={onSelect} onRequestMove={onRequestMove} onRequestRename={onRequestRename} onRequestHistory={onRequestHistory} onDelete={onDelete} onCopy={onCopy} />}
    </div>
  );
}

interface ActionGroupProps {
  node: TreeNode;
  copied: boolean;
  command: (props: MenuActionProps) => ReactElement;
  onCopy: (path: string) => void;
}

function FolderActions({ node, copied, command, onToggle, onRequestNew, onRequestFolder, onDeleteFolder, onCopy }: ActionGroupProps & { onToggle: (path: string) => void; onRequestNew: (dir: string) => void; onRequestFolder: (dir: string) => void; onDeleteFolder: (path: string) => void }) {
  const { t } = useTranslation();
  const ExpandIcon = node.children.length ? ChevronDown : ChevronRight;
  return <>
    {command({ icon: FilePlus2, label: t("tree.newNote"), onClick: () => onRequestNew(node.path) })}
    {command({ icon: FolderPlus, label: t("tree.newChildFolder"), onClick: () => onRequestFolder(node.path) })}
    {command({ icon: ExpandIcon, label: node.children.length ? t("tree.collapse") : t("tree.expand"), onClick: () => onToggle(node.path) })}
    <div className="tree-menu-divider" />
    {command({ icon: Copy, label: copied ? t("tree.pathCopied") : t("tree.copyPath"), onClick: () => onCopy(node.path) })}
    {node.path && command({ icon: Trash2, label: t("tree.deleteFolder"), onClick: () => onDeleteFolder(node.path), danger: true })}
  </>;
}

function NoteActions({ node, copied, command, onSelect, onRequestMove, onRequestRename, onRequestHistory, onDelete, onCopy }: ActionGroupProps & { onSelect: (path: string) => void; onRequestMove: (path: string) => void; onRequestRename: (path: string) => void; onRequestHistory: (path: string) => void; onDelete: (path: string) => void }) {
  const { t } = useTranslation();
  return <>
    {command({ icon: FileText, label: t("tree.openNote"), onClick: () => onSelect(node.path) })}
    {command({ icon: Pencil, label: t("tree.renameNote"), onClick: () => onRequestRename(node.path) })}
    {command({ icon: Move, label: t("tree.moveNote"), onClick: () => onRequestMove(node.path) })}
    {command({ icon: History, label: t("tree.viewHistory"), onClick: () => onRequestHistory(node.path) })}
    {command({ icon: Copy, label: copied ? t("tree.pathCopied") : t("tree.copyPath"), onClick: () => onCopy(node.path) })}
    <div className="tree-menu-divider" />
    {command({ icon: Trash2, label: t("tree.deleteNote"), onClick: () => onDelete(node.path), danger: true })}
  </>;
}

export type { TreeNode };

function contextMenuDisplayName(node: TreeNode, translate: (key: "tree.allNotes") => string): string {
  return node.path ? node.name : translate("tree.allNotes");
}

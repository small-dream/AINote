import type { TreeNode } from "@/api/types";
import type { TreeContextMenuState } from "../hooks/useTreeContextMenu";
import { useTranslation } from "@/i18n";

interface Props {
  menu: TreeContextMenuState; copied: boolean; onClose: () => void;
  onToggle: (path: string) => void; onSelect: (path: string) => void;
  onRequestNew: (dir: string) => void; onRequestFolder: (dir: string) => void;
  onRequestMove: (path: string) => void; onDelete: (path: string) => void;
  onDeleteFolder: (path: string) => void;
  onCopy: (path: string) => void;
}

export function TreeContextMenu({ menu, copied, onClose, onToggle, onSelect, onRequestNew, onRequestFolder, onRequestMove, onDelete, onDeleteFolder, onCopy }: Props) {
  const { t } = useTranslation();
  const { node } = menu;
  const command = (label: string, action: () => void, danger = false) => (
    <button className={`tree-menu-item ${danger ? "tree-menu-danger" : ""}`} onClick={(event) => { event.stopPropagation(); action(); onClose(); }}>{label}</button>
  );
  return <div className="tree-context-menu" style={{ left: menu.x, top: menu.y }} onClick={(event) => event.stopPropagation()}>
    <div className="tree-menu-heading">{node.name}</div>
      {node.nodeType === "dir" ? <>
        {command(t("tree.newNote"), () => onRequestNew(node.path))}
        {command(t("tree.newChildFolder"), () => onRequestFolder(node.path))}
        {command(node.children.length ? t("tree.collapse") : t("tree.expand"), () => onToggle(node.path))}
        {node.path && command(t("tree.deleteFolder"), () => onDeleteFolder(node.path), true)}
    </> : <>
      {command(t("tree.openNote"), () => onSelect(node.path))}
      {command(t("tree.renameMove"), () => onRequestMove(node.path))}
      {command(t("tree.deleteNote"), () => onDelete(node.path), true)}
    </>}
    <div className="tree-menu-divider" />
    {command(copied ? t("tree.pathCopied") : t("tree.copyPath"), () => onCopy(node.path))}
  </div>;
}

export type { TreeNode };

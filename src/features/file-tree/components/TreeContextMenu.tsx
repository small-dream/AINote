import type { TreeNode } from "@/api/types";
import type { TreeContextMenuState } from "../hooks/useTreeContextMenu";

interface Props {
  menu: TreeContextMenuState; copied: boolean; onClose: () => void;
  onToggle: (path: string) => void; onSelect: (path: string) => void;
  onRequestNew: (dir: string) => void; onRequestFolder: (dir: string) => void;
  onRequestMove: (path: string) => void; onDelete: (path: string) => void;
  onDeleteFolder: (path: string) => void;
  onCopy: (path: string) => void;
}

export function TreeContextMenu({ menu, copied, onClose, onToggle, onSelect, onRequestNew, onRequestFolder, onRequestMove, onDelete, onDeleteFolder, onCopy }: Props) {
  const { node } = menu;
  const command = (label: string, action: () => void, danger = false) => (
    <button className={`tree-menu-item ${danger ? "tree-menu-danger" : ""}`} onClick={(event) => { event.stopPropagation(); action(); onClose(); }}>{label}</button>
  );
  return <div className="tree-context-menu" style={{ left: menu.x, top: menu.y }} onClick={(event) => event.stopPropagation()}>
    <div className="tree-menu-heading">{node.name}</div>
      {node.nodeType === "dir" ? <>
        {command("新建笔记", () => onRequestNew(node.path))}
        {command("新建子目录", () => onRequestFolder(node.path))}
        {command(node.children.length ? "收起目录" : "展开目录", () => onToggle(node.path))}
        {node.path && command("删除目录", () => onDeleteFolder(node.path), true)}
    </> : <>
      {command("打开笔记", () => onSelect(node.path))}
      {command("移动 / 重命名", () => onRequestMove(node.path))}
      {command("删除笔记", () => onDelete(node.path), true)}
    </>}
    <div className="tree-menu-divider" />
    {command(copied ? "已复制路径" : "复制路径", () => onCopy(node.path))}
  </div>;
}

export type { TreeNode };

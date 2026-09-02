import { useEffect, useState, type MouseEvent } from "react";
import type { TreeNode } from "@/api/types";

export interface TreeContextMenuState { node: TreeNode; x: number; y: number; }

export function useTreeContextMenu() {
  const [menu, setMenu] = useState<TreeContextMenuState | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const close = () => setMenu(null);
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("click", close);
    window.addEventListener("keydown", escape);
    return () => { window.removeEventListener("click", close); window.removeEventListener("keydown", escape); };
  }, []);
  const open = (event: MouseEvent, node: TreeNode) => {
    event.preventDefault(); event.stopPropagation();
    const estimatedHeight = node.nodeType === "dir" ? 250 : 220;
    const x = Math.min(event.clientX, Math.max(8, window.innerWidth - 232));
    const y = Math.min(event.clientY, Math.max(8, window.innerHeight - estimatedHeight));
    setMenu({ node, x, y });
  };
  const copy = async (path: string) => {
    if (navigator.clipboard) await navigator.clipboard.writeText(path);
    setCopied(true); window.setTimeout(() => setCopied(false), 1200);
  };
  return { menu, copied, open, close: () => setMenu(null), copy };
}

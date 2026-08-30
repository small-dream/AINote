import { useState } from "react";
import type { TreeNode } from "@/api/types";
import { useNoteTreeQuery } from "@/queries/tree.queries";

/** 文件树状态：树数据 + 目录展开集合（根节点 path 为空串，默认展开） */
export function useFileTree(repoPath: string | null) {
  const treeQuery = useNoteTreeQuery(repoPath);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([""]));

  function toggle(path: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  return {
    tree: treeQuery.data,
    isLoading: treeQuery.isLoading,
    expanded,
    toggle,
  };
}

export type { TreeNode };

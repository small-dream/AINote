import type { TreeNode } from "@/api/types";

export interface DirectoryOption {
  depth: number;
  name: string;
  path: string;
}

/** 将目录树转换为按层级缩进的目录选项（根目录空串在最前） */
export function collectDirectoryOptions(tree: TreeNode | null): DirectoryOption[] {
  if (!tree) return [{ depth: 0, name: "", path: "" }];
  return [{ depth: 0, name: "", path: "" }, ...collectChildDirectories(tree, 1)];
}

function collectChildDirectories(node: TreeNode, depth: number): DirectoryOption[] {
  if (node.nodeType !== "dir") return [];
  return [...node.children].filter(isDirectory).sort(compareNodeNames).flatMap((child) => [
    { depth, name: child.name, path: child.path },
    ...collectChildDirectories(child, depth + 1),
  ]);
}

function isDirectory(node: TreeNode): boolean {
  return node.nodeType === "dir";
}

function compareNodeNames(left: TreeNode, right: TreeNode): number {
  return left.name.localeCompare(right.name);
}

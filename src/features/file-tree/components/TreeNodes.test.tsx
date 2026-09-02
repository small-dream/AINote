import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TreeNode } from "@/api/types";
import { TreeNodes } from "./TreeNodes";

const note: TreeNode = { name: "b.md", path: "b.md", nodeType: "file", children: [] };
const root: TreeNode = {
  name: "noterepo",
  path: "",
  nodeType: "dir",
  children: [note],
};

function renderTree(node: TreeNode, expanded: Set<string>) {
  return render(
    <TreeNodes
      node={node}
      depth={0}
      expanded={expanded}
      currentNotePath={null}
      onToggle={vi.fn()}
      onSelect={vi.fn()}
      onRequestNew={vi.fn()}
      onRequestFolder={vi.fn()}
      onRequestImport={vi.fn()}
      onContextMenu={vi.fn()}
    />,
  );
}

describe("TreeNodes", () => {
  it("根节点展示「全部笔记」而非仓库名", () => {
    renderTree(root, new Set([""]));
    expect(screen.getByText("全部笔记")).toBeTruthy();
    expect(screen.queryByText("noterepo")).toBeNull();
  });

  it("文件名去掉扩展名展示", () => {
    renderTree(root, new Set([""]));
    expect(screen.getByText("b")).toBeTruthy();
    expect(screen.queryByText("b.md")).toBeNull();
  });

  it("子目录展示自身名称", () => {
    const folder: TreeNode = {
      name: "daily",
      path: "daily",
      nodeType: "dir",
      children: [note],
    };
    renderTree(folder, new Set(["daily"]));
    expect(screen.getByText("daily")).toBeTruthy();
  });
});

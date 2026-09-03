import { describe, expect, it } from "vitest";
import { collectDirectoryOptions } from "./directoryTree";
import type { TreeNode } from "@/api/types";

const tree: TreeNode = {
  name: "root",
  path: "",
  nodeType: "dir",
  children: [
    { name: "z.md", path: "z.md", nodeType: "file", children: [] },
    {
      name: "daily",
      path: "daily",
      nodeType: "dir",
      children: [{ name: "archive", path: "daily/archive", nodeType: "dir", children: [] }],
    },
    { name: "projects", path: "projects", nodeType: "dir", children: [] },
  ],
};

describe("collectDirectoryOptions", () => {
  it("包含根目录并按层级输出目录选项", () => {
    expect(collectDirectoryOptions(tree)).toEqual([
      { depth: 0, name: "", path: "" },
      { depth: 1, name: "daily", path: "daily" },
      { depth: 2, name: "archive", path: "daily/archive" },
      { depth: 1, name: "projects", path: "projects" },
    ]);
  });

  it("空树时仍提供根目录", () => {
    expect(collectDirectoryOptions(null)).toEqual([{ depth: 0, name: "", path: "" }]);
  });
});

import { describe, expect, it } from "vitest";
import type { TreeNode } from "@/api/types";
import { collectDirPaths, getDirectoryPath, joinPath, normalizeFolderPath, splitPath } from "./path";

describe("normalizeFolderPath", () => {
  it("去首尾斜杠", () => {
    expect(normalizeFolderPath("/daily/2026/")).toBe("daily/2026");
  });

  it("空输入返回 null", () => {
    expect(normalizeFolderPath("   ")).toBeNull();
    expect(normalizeFolderPath("/")).toBeNull();
  });

  it("保留多级目录", () => {
    expect(normalizeFolderPath("daily/2026")).toBe("daily/2026");
  });
});

describe("collectDirPaths", () => {
  const tree: TreeNode = {
    name: "root",
    path: "",
    nodeType: "dir",
    children: [
      { name: "daily", path: "daily", nodeType: "dir", children: [
        { name: "2026", path: "daily/2026", nodeType: "dir", children: [] },
        { name: "a.md", path: "daily/a.md", nodeType: "file", children: [] },
      ] },
      { name: "b.md", path: "b.md", nodeType: "file", children: [] },
    ],
  };

  it("收集目录路径且不含根节点", () => {
    expect(collectDirPaths(tree)).toEqual(["daily", "daily/2026"]);
  });

  it("空树返回空数组", () => {
    expect(collectDirPaths({ name: "root", path: "", nodeType: "dir", children: [] })).toEqual([]);
  });
});

describe("getDirectoryPath", () => {
  it("返回父目录", () => {
    expect(getDirectoryPath("daily/2026-08-30.md")).toBe("daily");
  });

  it("根文件返回空字符串", () => {
    expect(getDirectoryPath("README.md")).toBe("");
  });

  it("多级目录", () => {
    expect(getDirectoryPath("a/b/c.md")).toBe("a/b");
  });
});

describe("splitPath / joinPath", () => {
  it("拆分与拼接对称", () => {
    expect(splitPath("a/b/c.md")).toEqual(["a", "b", "c.md"]);
    expect(joinPath(["a", "b", "c.md"])).toBe("a/b/c.md");
  });

  it("过滤空段", () => {
    expect(splitPath("/a//b/")).toEqual(["a", "b"]);
  });
});

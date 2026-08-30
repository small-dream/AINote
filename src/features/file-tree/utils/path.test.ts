import { describe, expect, it } from "vitest";
import { getDirectoryPath, joinPath, splitPath } from "./path";

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

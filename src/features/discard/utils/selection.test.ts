import { describe, expect, it } from "vitest";
import type { ChangedFile } from "@/api/types";
import { splitByStatus, toggleSelectAll, toggleSelection } from "./selection";

const file = (path: string, status: ChangedFile["status"]): ChangedFile => ({ path, status });

describe("toggleSelection", () => {
  it("未选中则加入，已选中则移除，且不改动原集合", () => {
    const original = new Set(["a.md"]);
    expect([...toggleSelection(original, "b.md")]).toEqual(["a.md", "b.md"]);
    expect([...toggleSelection(original, "a.md")]).toEqual([]);
    expect([...original]).toEqual(["a.md"]);
  });
});

describe("toggleSelectAll", () => {
  it("未全选时选中全部路径", () => {
    expect([...toggleSelectAll(new Set(["a.md"]), ["a.md", "b.md"])]).toEqual(["a.md", "b.md"]);
  });

  it("已全选时清空", () => {
    expect([...toggleSelectAll(new Set(["a.md", "b.md"]), ["a.md", "b.md"])]).toEqual([]);
  });

  it("空列表不产生选中项", () => {
    expect([...toggleSelectAll(new Set(), [])]).toEqual([]);
  });
});

describe("splitByStatus", () => {
  it("新增归入删除组，改 / 删归入恢复组", () => {
    const { restore, remove } = splitByStatus([
      file("a.md", "modified"),
      file("b.md", "deleted"),
      file("new.md", "added"),
    ]);
    expect(restore.map((item) => item.path)).toEqual(["a.md", "b.md"]);
    expect(remove.map((item) => item.path)).toEqual(["new.md"]);
  });
});

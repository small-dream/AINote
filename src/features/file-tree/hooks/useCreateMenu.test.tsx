import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NoteKind } from "@/api/types";
import { useCreateMenu } from "./useCreateMenu";

function setup() {
  const onCreateNote = vi.fn<(kind: NoteKind) => Promise<void>>();
  const onImportFiles = vi.fn<(files: File[]) => Promise<void>>();
  const onImportNotes = vi.fn<(files: File[]) => Promise<void>>();
  const { result } = renderHook(() => useCreateMenu(onCreateNote, onImportFiles, onImportNotes));
  return { result, onImportNotes };
}

function filesOf(names: string[]): File[] {
  return names.map((name) => new File(["# 标题\n正文"], name, { type: "text/markdown" }));
}

describe("useCreateMenu 导入 Markdown 笔记", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("importNotes 转发文件并成功关闭菜单", async () => {
    const { result, onImportNotes } = setup();
    act(() => result.current.toggle());
    expect(result.current.open).toBe(true);
    await act(async () => {
      await result.current.importNotes(filesOf(["a.md", "b.md"]));
    });
    expect(onImportNotes).toHaveBeenCalledTimes(1);
    expect(onImportNotes.mock.calls[0]?.[0]).toHaveLength(2);
    expect(result.current.open).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("importNotes 失败时保留菜单并展示错误", async () => {
    const { result, onImportNotes } = setup();
    onImportNotes.mockRejectedValueOnce(new Error("导入失败"));
    await act(async () => {
      await result.current.importNotes(filesOf(["bad.md"]));
    });
    expect(result.current.open).toBe(false);
    expect(result.current.error).toBe("导入失败");
    expect(result.current.busy).toBe(false);
  });

  it("空文件列表为无操作", async () => {
    const { result, onImportNotes } = setup();
    await act(async () => {
      await result.current.importNotes([]);
    });
    expect(onImportNotes).not.toHaveBeenCalled();
    expect(result.current.open).toBe(false);
  });
});

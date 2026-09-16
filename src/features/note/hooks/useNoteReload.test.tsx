import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { NoteContent } from "@/api/types";
import { useNoteReload } from "./useNoteReload";

function noteContent(overrides: Partial<NoteContent>): NoteContent {
  return { path: "secret.md", kind: "markdown", content: "", locked: false, encrypted: true, ...overrides };
}

interface Props {
  data: NoteContent;
  dirty: boolean;
}

function setup(initial: Props, notePath = "secret.md") {
  const applyContent = vi.fn();
  const hook = renderHook(
    ({ data, dirty }: Props) => useNoteReload({ notePath, data, reloadToken: 0, dirty, applyContent }),
    { initialProps: initial },
  );
  return { ...hook, applyContent };
}

describe("useNoteReload", () => {
  it("路径切换时装载一次，同路径新数据不重复装载", () => {
    const { rerender, applyContent } = setup({ data: noteContent({ content: "# 正文" }), dirty: false });
    expect(applyContent).toHaveBeenCalledTimes(1);
    expect(applyContent).toHaveBeenCalledWith("# 正文");

    rerender({ data: noteContent({ content: "# 外部变更" }), dirty: false });
    expect(applyContent).toHaveBeenCalledTimes(1);
  });

  it("同一笔记 locked → unlocked 后装载明文（草稿仍是锁定占位）", () => {
    // 复现 H1 评审路径：打开锁定笔记时装载占位空串 → 设置覆盖层解锁 → query 重取到明文
    const { rerender, applyContent } = setup({ data: noteContent({ locked: true }), dirty: false });
    expect(applyContent).toHaveBeenCalledWith("");

    applyContent.mockClear();
    rerender({ data: noteContent({ locked: false, content: "# 机密正文" }), dirty: false });

    expect(applyContent).toHaveBeenCalledTimes(1);
    expect(applyContent).toHaveBeenCalledWith("# 机密正文");
  });

  it("用户已有脏草稿时 locked → unlocked 不覆盖草稿", () => {
    const { rerender, applyContent } = setup({ data: noteContent({ locked: true }), dirty: true });
    // 脏草稿下首次装载占位也照常发生（占位等于当前笔记的初始态）
    applyContent.mockClear();

    rerender({ data: noteContent({ locked: false, content: "# 机密正文" }), dirty: true });
    expect(applyContent).not.toHaveBeenCalled();
  });

  it("unlocked → locked 翻转不动 draft（锁定前已 flush，清空反而会丢草稿）", () => {
    const { rerender, applyContent } = setup({ data: noteContent({ content: "# 机密正文" }), dirty: false });
    expect(applyContent).toHaveBeenCalledWith("# 机密正文");

    applyContent.mockClear();
    rerender({ data: noteContent({ locked: true }), dirty: false });
    expect(applyContent).not.toHaveBeenCalled();
  });

  it("解锁后再次重取到明文不重复装载", () => {
    const { rerender, applyContent } = setup({ data: noteContent({ locked: true }), dirty: false });
    rerender({ data: noteContent({ locked: false, content: "# 机密正文" }), dirty: false });
    expect(applyContent).toHaveBeenCalledTimes(2);

    rerender({ data: noteContent({ locked: false, content: "# 机密正文（外部更新）" }), dirty: false });
    expect(applyContent).toHaveBeenCalledTimes(2);
  });

  it("切换到另一篇锁定笔记时重新按占位装载", () => {
    const applyContent = vi.fn();
    const { rerender } = renderHook(
      ({ notePath, data }: { notePath: string; data: NoteContent }) =>
        useNoteReload({ notePath, data, reloadToken: 0, dirty: false, applyContent }),
      { initialProps: { notePath: "a.md", data: noteContent({ locked: true }) } },
    );
    expect(applyContent).toHaveBeenCalledWith("");

    rerender({ notePath: "b.md", data: noteContent({ path: "b.md", locked: false, content: "# B" }) });
    expect(applyContent).toHaveBeenCalledWith("# B");
  });
});

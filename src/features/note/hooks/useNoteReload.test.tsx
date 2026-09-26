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

describe("useNoteReload reloadToken 强制重载", () => {

  it("reloadToken 变化后，同路径新数据到达时重载（无脏草稿）", () => {
    const applyContent = vi.fn();
    const { rerender } = renderHook(
      ({ data, reloadToken, dirty }: Props & { reloadToken: number }) =>
        useNoteReload({ notePath: "secret.md", data, reloadToken, dirty, applyContent }),
      { initialProps: { data: noteContent({ content: "# 旧内容" }), reloadToken: 0, dirty: false } },
    );
    expect(applyContent).toHaveBeenCalledWith("# 旧内容");

    // 同步落盘后：先 bump 令牌，query 重取到新内容 → 同路径也重载
    applyContent.mockClear();
    rerender({ data: noteContent({ content: "# 旧内容" }), reloadToken: 1, dirty: false });
    rerender({ data: noteContent({ content: "# 同步后的新内容" }), reloadToken: 1, dirty: false });
    expect(applyContent).toHaveBeenCalledTimes(1);
    expect(applyContent).toHaveBeenCalledWith("# 同步后的新内容");
  });

  it("reloadToken 触发的重载遇到脏草稿时保留草稿（不丢弃也不覆盖）", () => {
    const applyContent = vi.fn();
    const { rerender } = renderHook(
      ({ data, reloadToken, dirty }: Props & { reloadToken: number }) =>
        useNoteReload({ notePath: "secret.md", data, reloadToken, dirty, applyContent }),
      { initialProps: { data: noteContent({ content: "# 旧内容" }), reloadToken: 0, dirty: false } },
    );
    applyContent.mockClear();

    // 令牌 bump 后用户又敲了键：新数据到达时 dirty → 跳过重载，草稿保留
    rerender({ data: noteContent({ content: "# 旧内容" }), reloadToken: 1, dirty: true });
    rerender({ data: noteContent({ content: "# 同步后的新内容" }), reloadToken: 1, dirty: true });
    expect(applyContent).not.toHaveBeenCalled();
  });
});

describe("useNoteReload 强制重载（用户显式丢弃草稿）", () => {
  it("forceToken 变化后有脏草稿也照常应用磁盘内容", () => {
    const applyContent = vi.fn();
    const before = noteContent({ content: "# 丢弃前" });
    const { rerender } = renderHook(
      ({ data, forceToken, dirty }: Props & { forceToken: number }) =>
        useNoteReload({ notePath: "secret.md", data, reloadToken: 0, forceToken, dirty, applyContent }),
      { initialProps: { data: before, forceToken: 0, dirty: true } },
    );
    applyContent.mockClear();

    // 丢弃成功后：先 bump 令牌（query 尚未重取，数据引用不变）→ 新数据到达
    rerender({ data: before, forceToken: 1, dirty: true });
    rerender({ data: noteContent({ content: "# 上次提交的内容" }), forceToken: 1, dirty: true });

    expect(applyContent).toHaveBeenCalledTimes(1);
    expect(applyContent).toHaveBeenCalledWith("# 上次提交的内容");
  });

  it("forceToken 不变化时脏草稿仍然被保护", () => {
    const applyContent = vi.fn();
    const before = noteContent({ content: "# 丢弃前" });
    const { rerender } = renderHook(
      ({ data, forceToken, dirty }: Props & { forceToken: number }) =>
        useNoteReload({ notePath: "secret.md", data, reloadToken: 0, forceToken, dirty, applyContent }),
      { initialProps: { data: before, forceToken: 1, dirty: false } },
    );
    applyContent.mockClear();

    rerender({ data: before, forceToken: 2, dirty: true });
    rerender({ data: noteContent({ content: "# 磁盘内容" }), forceToken: 2, dirty: true });
    expect(applyContent).toHaveBeenCalledTimes(1);

    rerender({ data: noteContent({ content: "# 又一次磁盘内容" }), forceToken: 2, dirty: true });
    expect(applyContent).toHaveBeenCalledTimes(1);
  });
});

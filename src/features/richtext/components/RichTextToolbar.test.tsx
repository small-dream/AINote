import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Editor } from "@tiptap/core";
import { RichTextToolbar } from "./RichTextToolbar";

function createEditor(activeType: string | null = null) {
  const run = vi.fn();
  const chainMethods = {
    toggleHeading: vi.fn(() => ({ run })),
    setParagraph: vi.fn(() => ({ run })),
    toggleCodeBlock: vi.fn(() => ({ run })),
    insertTable: vi.fn(() => ({ run })),
    setHorizontalRule: vi.fn(() => ({ run })),
  };
  return {
    editor: {
      isActive: vi.fn((type: string, attrs?: { level?: 1 | 2 | 3 | 4 | 5 | 6 }) => type === activeType && (!attrs || attrs.level === 2)),
      can: vi.fn(() => ({ undo: () => true, redo: () => false })),
      chain: vi.fn(() => ({ focus: () => chainMethods })),
    } as unknown as Editor,
    chainMethods,
    run,
  };
}

describe("RichTextToolbar", () => {
  it("用段落选择器收敛标题命令并执行二级标题", () => {
    const { chainMethods, editor, run } = createEditor("heading");
    render(<RichTextToolbar editor={editor} />);

    fireEvent.click(screen.getByRole("button", { name: "标题级别" }));
    // 标题级别是「多选一」：走 menuitemradio + aria-checked，读屏软件据此播报当前级别
    const level = screen.getByRole("menuitemradio", { name: "二级标题" });
    expect(level.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(level);

    expect(chainMethods.toggleHeading).toHaveBeenCalledWith({ level: 2 });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("提供格式刷与清除格式入口", () => {
    const { editor } = createEditor();
    render(<RichTextToolbar editor={editor} />);

    expect(screen.getByRole("button", { name: "格式刷" })).toBeDefined();
    expect(screen.getByRole("button", { name: "清除格式" })).toBeDefined();
  });

  it("右侧只保留撤销/重做：主题与 AI 入口统一收在顶部工具栏", () => {
    const { editor } = createEditor();
    render(<RichTextToolbar editor={editor} />);

    expect(screen.getByRole("button", { name: "撤销" })).toBeDefined();
    expect(screen.getByRole("button", { name: "重做" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "笔记主题" })).toBeNull();
    expect(screen.queryByRole("button", { name: /AI/ })).toBeNull();
  });
});

describe("RichTextToolbar / 插入菜单", () => {
  it("块级插入命令收进「插入」菜单，菜单项触发对应命令", () => {
    const { chainMethods, editor, run } = createEditor();
    render(<RichTextToolbar editor={editor} />);

    fireEvent.click(screen.getByRole("button", { name: "插入" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "插入表格" }));

    expect(chainMethods.insertTable).toHaveBeenCalledWith({ rows: 3, cols: 3, withHeaderRow: true });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("插入菜单内嵌图片文件选择器并回传文件", () => {
    const onImagePicked = vi.fn();
    const { editor } = createEditor();
    render(<RichTextToolbar editor={editor} onImagePicked={onImagePicked} />);

    fireEvent.click(screen.getByRole("button", { name: "插入" }));
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    const file = new File(["png"], "a.png", { type: "image/png" });
    fireEvent.change(input as HTMLInputElement, { target: { files: [file] } });

    expect(onImagePicked).toHaveBeenCalledWith([file]);
  });
});

describe("RichTextToolbar / 链接", () => {
  it("链接按钮弹出 URL 输入，Enter 确认后规范化并写入链接", () => {
    const { editor, run, setLink } = createLinkEditor(false);
    render(<RichTextToolbar editor={editor} />);

    fireEvent.click(screen.getByRole("button", { name: "链接" }));
    const input = screen.getByPlaceholderText("输入链接 URL，Enter 确认");
    fireEvent.change(input, { target: { value: "example.com" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(setLink).toHaveBeenCalledWith({ href: "https://example.com" });
    expect(run).toHaveBeenCalled();
  });

  it("链接格式无效时提示错误且不写入", () => {
    const { editor, run, setLink } = createLinkEditor(false);
    render(<RichTextToolbar editor={editor} />);

    fireEvent.click(screen.getByRole("button", { name: "链接" }));
    const input = screen.getByPlaceholderText("输入链接 URL，Enter 确认");
    fireEvent.change(input, { target: { value: "not a url" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(setLink).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("链接格式无效");
  });

  it("对已带链接的选区点击链接按钮直接解除链接", () => {
    const { editor, run, unsetLink } = createLinkEditor(true);
    render(<RichTextToolbar editor={editor} />);

    fireEvent.click(screen.getByRole("button", { name: "移除链接" }));

    expect(unsetLink).toHaveBeenCalled();
    expect(run).toHaveBeenCalled();
  });

});

function createLinkEditor(activeLink: boolean) {
  const run = vi.fn();
  const setLink = vi.fn(() => ({ run }));
  const unsetLink = vi.fn(() => ({ run }));
  const extendMarkRange = vi.fn(() => ({ setLink, unsetLink }));
  const editor = {
    isActive: vi.fn((type: string) => (activeLink ? type === "link" : false)),
    getAttributes: vi.fn(() => ({})),
    can: vi.fn(() => ({ undo: () => true, redo: () => false })),
    chain: vi.fn(() => ({ focus: () => ({ extendMarkRange }) })),
    view: { dom: document.createElement("div") },
  } as unknown as Editor;
  return { editor, run, setLink, unsetLink };
}

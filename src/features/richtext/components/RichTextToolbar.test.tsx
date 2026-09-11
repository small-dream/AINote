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
      isActive: vi.fn((type: string, attrs?: { level?: 1 | 2 | 3 }) => type === activeType && (!attrs || attrs.level === 2)),
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

    fireEvent.click(screen.getByTitle("标题级别"));
    fireEvent.click(screen.getByRole("menuitem", { name: "二级标题" }));

    expect(chainMethods.toggleHeading).toHaveBeenCalledWith({ level: 2 });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("将块级插入命令直接呈现在工具栏", () => {
    const { chainMethods, editor, run } = createEditor();
    render(<RichTextToolbar editor={editor} />);

    fireEvent.click(screen.getByRole("button", { name: "插入表格" }));

    expect(chainMethods.insertTable).toHaveBeenCalledWith({ rows: 3, cols: 3, withHeaderRow: true });
    expect(run).toHaveBeenCalledTimes(1);
  });

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

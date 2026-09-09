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

});

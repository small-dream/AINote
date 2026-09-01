import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EditorToolbar, type ViewMode } from "./EditorToolbar";

function renderToolbar(overrides: Partial<Parameters<typeof EditorToolbar>[0]> = {}) {
  const props = {
    path: "notes/hello.md",
    mode: "edit" as ViewMode,
    saving: false,
    dirty: false,
    onModeChange: vi.fn(),
    onSave: vi.fn(),
    onMove: vi.fn(),
    onHistory: vi.fn(),
    onWiki: vi.fn(),
    ...overrides,
  };
  return render(<EditorToolbar {...props} />);
}

describe("EditorToolbar", () => {
  it("将工具栏空白区域标记为窗口拖拽区", () => {
    const { container } = renderToolbar();

    expect(container.firstElementChild?.getAttribute("data-tauri-drag-region")).toBe("deep");
  });

  it("展示三种视图模式并支持分栏切换", () => {
    const onModeChange = vi.fn();
    renderToolbar({ onModeChange });

    fireEvent.click(screen.getByText("分栏"));
    expect(onModeChange).toHaveBeenCalledWith("split");

    fireEvent.click(screen.getByText("预览"));
    expect(onModeChange).toHaveBeenCalledWith("preview");
  });

  it("分栏模式下高亮对应标签", () => {
    renderToolbar({ mode: "split" });
    const tab = screen.getByText("分栏");
    expect(tab.className).toContain("bg-accent");
  });
});

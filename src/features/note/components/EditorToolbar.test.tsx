import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { EditorToolbar } from "./EditorToolbar";

function renderToolbar(overrides: Partial<Parameters<typeof EditorToolbar>[0]> = {}) {
  const props: Parameters<typeof EditorToolbar>[0] = {
    path: "notes/hello.md",
    mode: "edit",
    onModeChange: vi.fn(),
    onSave: vi.fn(),
    onMove: vi.fn(),
    onHistory: vi.fn(),
    onWiki: vi.fn(),
    onConvertToRichText: vi.fn(),
    onExportPdf: vi.fn(),
    onAi: vi.fn(),
    ...overrides,
  };
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <EditorToolbar {...props} />
    </QueryClientProvider>,
  );
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

describe("EditorToolbar / 更多菜单", () => {
  it("低频文件操作收进「更多」菜单", () => {
    renderToolbar();
    expect(screen.queryByText("导出 PDF")).toBeNull();
    expect(screen.queryByText("转换为富文本")).toBeNull();
    expect(screen.queryByText("移动 / 重命名")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "更多" }));
    expect(screen.getByRole("menuitem", { name: "导出 PDF" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "转换为富文本" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "移动 / 重命名" })).toBeTruthy();
  });

  it("「更多」菜单项触发动作并关闭菜单", () => {
    const onMove = vi.fn();
    renderToolbar({ onMove });
    fireEvent.click(screen.getByRole("button", { name: "更多" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "移动 / 重命名" }));
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menuitem")).toBeNull();
  });

  it("历史 / 双链按钮通过 aria-label 可访问", () => {
    renderToolbar();
    expect(screen.getByRole("button", { name: "版本历史" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "双链与标签" })).toBeTruthy();
  });

  it("富文本模式隐藏视图切换、主题与「转换为富文本」", () => {
    renderToolbar({ richText: true });
    expect(screen.queryByText("编辑")).toBeNull();
    expect(screen.queryByRole("button", { name: "笔记主题" })).toBeNull();
    expect(screen.queryByRole("button", { name: "双链与标签" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "更多" }));
    expect(screen.queryByRole("menuitem", { name: "转换为富文本" })).toBeNull();
    expect(screen.getByRole("menuitem", { name: "移动 / 重命名" })).toBeTruthy();
  });
});

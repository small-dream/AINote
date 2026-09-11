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
    expect(screen.getByRole("tab", { name: "写作" }).getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByText("分栏"));
    expect(onModeChange).toHaveBeenCalledWith("split");
    fireEvent.click(screen.getByText("预览"));
    expect(onModeChange).toHaveBeenCalledWith("preview");
  });

  it("展示自动保存状态", () => {
    renderToolbar({ dirty: true });
    expect(screen.getByRole("status").textContent).toContain("有未保存修改");
  });

  it("保存进行中优先显示保存中", () => {
    renderToolbar({ saving: true, dirty: true });
    expect(screen.getByRole("status").textContent).toContain("保存中…");
  });

  it("分栏模式下高亮对应标签", () => {
    renderToolbar({ mode: "split" });
    const tab = screen.getByRole("tab", { name: "分栏" });
    expect(tab.getAttribute("aria-selected")).toBe("true");
  });

  it("窄屏用「源码」替代「分栏」", () => {
    const onModeChange = vi.fn();
    renderToolbar({ compact: true, onModeChange });
    expect(screen.queryByText("分栏")).toBeNull();
    fireEvent.click(screen.getByText("源码"));
    expect(onModeChange).toHaveBeenCalledWith("source");
  });

  it("宽屏提供「源码」单栏标签", () => {
    const onModeChange = vi.fn();
    const { unmount } = renderToolbar({ onModeChange });
    fireEvent.click(screen.getByText("源码"));
    expect(onModeChange).toHaveBeenCalledWith("source");
    unmount();
    renderToolbar({ mode: "source" });
    expect(screen.getByRole("tab", { name: "源码" }).getAttribute("aria-selected")).toBe("true");
  });
});

describe("EditorToolbar / 保存失败", () => {
  it("展示失败原因、可操作建议与内联重试，并保留未保存状态", () => {
    const onSave = vi.fn();
    renderToolbar({ dirty: true, saveError: "笔记保存失败", saveErrorCode: "IO_5001", onSave });
    expect(screen.getByText("笔记保存失败")).toBeTruthy();
    expect(screen.getByText("写入本地文件失败，请检查磁盘空间与目录权限后重试")).toBeTruthy();
    expect(screen.getByText("有未保存修改")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "重试保存" }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("未知错误码仍给出重试与诊断包建议", () => {
    renderToolbar({ saveError: "未知故障", saveErrorCode: "NOTE_1001" });
    expect(screen.getByText("请重试；若持续失败，请在「设置 → 诊断与反馈」导出诊断包")).toBeTruthy();
  });

  it("没有保存失败时不渲染错误区", () => {
    renderToolbar();
    expect(screen.queryByRole("button", { name: "重试保存" })).toBeNull();
  });
});

describe("EditorToolbar / 更多菜单", () => {
  it("低频文件操作收进「更多」菜单", () => {
    renderToolbar();
    expect(screen.queryByText("导出 PDF")).toBeNull();
    expect(screen.queryByText("转换为富文本")).toBeNull();
    expect(screen.queryByText("移动笔记")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "更多" }));
    expect(screen.getByRole("menuitem", { name: "导出 PDF" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "转换为富文本" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "移动笔记" })).toBeTruthy();
  });

  it("「更多」菜单项触发动作并关闭菜单", () => {
    const onMove = vi.fn();
    renderToolbar({ onMove });
    fireEvent.click(screen.getByRole("button", { name: "更多" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "移动笔记" }));
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
    expect(screen.queryByText("写作")).toBeNull();
    expect(screen.queryByRole("button", { name: "笔记主题" })).toBeNull();
    expect(screen.getByRole("button", { name: "双链与标签" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "更多" }));
    expect(screen.queryByRole("menuitem", { name: "转换为富文本" })).toBeNull();
    expect(screen.getByRole("menuitem", { name: "移动笔记" })).toBeTruthy();
  });
});

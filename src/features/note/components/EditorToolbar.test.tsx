import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { EditorToolbar } from "./EditorToolbar";

vi.mock("@/features/ai/hooks/useAiConfig", () => ({
  useAiConfig: () => ({
    data: {
      enabled: true,
      providers: [{ id: "p1", provider: "openAiCompatible", displayName: "OpenAI", baseUrl: "https://api.example.com", enabled: true, hasKey: true }],
      models: [{ id: "m1", providerId: "p1", modelId: "gpt-5", displayName: "GPT-5", enabled: true }],
      defaultModelId: "m1",
    },
  }),
}));

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
    aiBlocked: false,
    historyBlocked: false,
    encryptionAction: "encrypt",
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

  it("干净保存态静默：不渲染状态文案", () => {
    renderToolbar();
    expect(screen.queryByText("已保存")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
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

  it("主题 / 历史 / 双链 / AI 收进「更多」菜单，顶栏不再常驻", () => {
    renderToolbar();
    expect(screen.queryByRole("button", { name: "笔记历史" })).toBeNull();
    expect(screen.queryByRole("button", { name: "双链与标签" })).toBeNull();
    expect(screen.queryByRole("button", { name: "笔记主题" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "更多" }));
    expect(screen.getByRole("menuitem", { name: "笔记历史" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "双链与标签" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "笔记主题" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "AI" })).toBeTruthy();
  });
});

describe("EditorToolbar / 更多菜单 / 工具入口", () => {
  it("富文本模式隐藏视图切换与「转换为富文本」，工具入口仍在「更多」菜单（与 Markdown 同一位置）", () => {
    renderToolbar({ richText: true });
    expect(screen.queryByText("写作")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "更多" }));
    expect(screen.getByRole("menuitem", { name: "笔记主题" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "双链与标签" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "转换为富文本" })).toBeNull();
    expect(screen.getByRole("menuitem", { name: "移动笔记" })).toBeTruthy();
  });

  it("加密笔记：笔记历史菜单项禁用并说明原因，点击不触发（决策④）", () => {
    const onHistory = vi.fn();
    renderToolbar({ historyBlocked: true, onHistory });
    fireEvent.click(screen.getByRole("button", { name: "更多" }));
    const item = screen.getByRole("menuitem", { name: "笔记历史" }) as HTMLButtonElement;
    expect(item.disabled).toBe(true);
    expect(item.title).toBe("加密笔记不提供笔记历史");
    fireEvent.click(item);
    expect(onHistory).not.toHaveBeenCalled();
  });

  it("加密笔记：AI 菜单项禁用并说明原因（决策③）", () => {
    const onAi = vi.fn();
    renderToolbar({ aiBlocked: true, onAi });
    fireEvent.click(screen.getByRole("button", { name: "更多" }));
    const item = screen.getByRole("menuitem", { name: "AI" }) as HTMLButtonElement;
    expect(item.disabled).toBe(true);
    expect(item.title).toBe("加密笔记不支持 AI 功能");
    // 双链与标签不受影响
    expect((screen.getByRole("menuitem", { name: "双链与标签" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("解锁态提供「加密此笔记」入口", () => {
    const onToggleEncryption = vi.fn();
    renderToolbar({ onToggleEncryption });
    fireEvent.click(screen.getByRole("button", { name: "更多" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "加密此笔记" }));
    expect(onToggleEncryption).toHaveBeenCalledTimes(1);
  });

  it("加密态提供「解密此笔记」入口", () => {
    const onToggleEncryption = vi.fn();
    renderToolbar({ onToggleEncryption, encryptionAction: "decrypt" });
    fireEvent.click(screen.getByRole("button", { name: "更多" }));
    expect(screen.getByRole("menuitem", { name: "解密此笔记" })).toBeTruthy();
  });
});

describe("EditorToolbar / 中频工具入口位置", () => {
  it("AI 入口在两种笔记类型下都收在「更多」菜单", () => {
    const onAi = vi.fn();
    const first = renderToolbar({ onAi });
    fireEvent.click(screen.getByRole("button", { name: "更多" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "AI" }));
    expect(onAi).toHaveBeenCalledTimes(1);
    first.unmount();

    renderToolbar({ richText: true, onAi });
    fireEvent.click(screen.getByRole("button", { name: "更多" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "AI" }));
    expect(onAi).toHaveBeenCalledTimes(2);
  });
});

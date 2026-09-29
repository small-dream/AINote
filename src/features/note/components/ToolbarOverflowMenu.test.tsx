import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUiStore } from "@/stores/ui.store";
import { ToolbarOverflowMenu } from "./ToolbarOverflowMenu";

const aiConfigState = vi.hoisted(() => ({ configured: true }));

vi.mock("@/features/ai/hooks/useAiConfig", () => ({
  useAiConfig: () => ({
    data: aiConfigState.configured
      ? {
          enabled: true,
          providers: [{ id: "p1", provider: "openAiCompatible", displayName: "OpenAI", baseUrl: "https://api.example.com", enabled: true, hasKey: true }],
          models: [{ id: "m1", providerId: "p1", modelId: "gpt-5", displayName: "GPT-5", enabled: true }],
          defaultModelId: "m1",
        }
      : { enabled: true, providers: [], models: [], defaultModelId: null },
  }),
}));

function renderMenu(overrides: Partial<Parameters<typeof ToolbarOverflowMenu>[0]> = {}) {
  const props: Parameters<typeof ToolbarOverflowMenu>[0] = {
    richText: false,
    hasConvert: false,
    isPdfAvailable: false,
    onHistory: vi.fn(),
    onWiki: vi.fn(),
    onMove: vi.fn(),
    ...overrides,
  };
  return render(<ToolbarOverflowMenu {...props} />);
}

function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: "更多" }));
}

beforeEach(() => {
  localStorage.clear();
  aiConfigState.configured = true;
  useUiStore.setState({ noteTheme: "classic", settingsOpen: false });
});

describe("ToolbarOverflowMenu / 导出与转换", () => {
  it("富文本笔记把导出 Markdown 合并进溢出菜单并触发回调", () => {
    const onExportMarkdown = vi.fn();
    renderMenu({ richText: true, isPdfAvailable: true, onExportPdf: vi.fn(), onExportMarkdown });

    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "导出 Markdown" }));

    expect(onExportMarkdown).toHaveBeenCalledTimes(1);
  });

  it("未提供导出 Markdown 时不渲染该项", () => {
    renderMenu({ richText: true });

    openMenu();

    expect(screen.queryByRole("menuitem", { name: "导出 Markdown" })).toBeNull();
  });

  it("富文本笔记提供「转换为 Markdown」逆转换入口并触发回调", () => {
    const onConvertToMarkdown = vi.fn();
    renderMenu({ richText: true, onConvertToMarkdown });

    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "转换为 Markdown" }));

    expect(onConvertToMarkdown).toHaveBeenCalledTimes(1);
  });

  it("Markdown 笔记不渲染逆转换入口", () => {
    renderMenu();

    openMenu();

    expect(screen.queryByRole("menuitem", { name: "转换为 Markdown" })).toBeNull();
  });
});

describe("ToolbarOverflowMenu / 工具入口", () => {
  it("主题 / 历史 / 双链 / AI 收进溢出菜单并触发对应动作", () => {
    const onHistory = vi.fn();
    const onWiki = vi.fn();
    const onAi = vi.fn();
    renderMenu({ onHistory, onWiki, onAi });

    openMenu();
    expect(screen.getByRole("menuitem", { name: "笔记主题" })).toBeTruthy();
    fireEvent.click(screen.getByRole("menuitem", { name: "笔记历史" }));
    expect(onHistory).toHaveBeenCalledTimes(1);

    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "双链与标签" }));
    expect(onWiki).toHaveBeenCalledTimes(1);

    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "AI" }));
    expect(onAi).toHaveBeenCalledTimes(1);
  });

  it("未提供 onAi 时不渲染 AI 菜单项", () => {
    renderMenu();

    openMenu();

    expect(screen.queryByRole("menuitem", { name: "AI" })).toBeNull();
  });

  it("AI 未配置：菜单项保持「AI」名称，hint 引导去设置，点击打开设置而非触发 onAi", () => {
    aiConfigState.configured = false;
    const onAi = vi.fn();
    renderMenu({ onAi });

    openMenu();
    const item = screen.getByRole("menuitem", { name: "AI" }) as HTMLButtonElement;
    expect(item.title).toBe("尚未配置 AI，请先在设置中完成配置");
    fireEvent.click(item);
    expect(onAi).not.toHaveBeenCalled();
    expect(useUiStore.getState().settingsOpen).toBe(true);
    expect(useUiStore.getState().settingsTab).toBe("ai");
  });

  it("加密笔记：历史 / AI 菜单项禁用并说明原因，点击不触发动作", () => {
    const onHistory = vi.fn();
    const onAi = vi.fn();
    renderMenu({ onHistory, onAi, aiBlocked: true, historyBlocked: true });

    openMenu();
    const historyItem = screen.getByRole("menuitem", { name: "笔记历史" }) as HTMLButtonElement;
    const aiItem = screen.getByRole("menuitem", { name: "AI" }) as HTMLButtonElement;
    expect(historyItem.disabled).toBe(true);
    expect(historyItem.title).toBe("加密笔记不提供笔记历史");
    expect(aiItem.disabled).toBe(true);
    expect(aiItem.title).toBe("加密笔记不支持 AI 功能");
    fireEvent.click(historyItem);
    fireEvent.click(aiItem);
    expect(onHistory).not.toHaveBeenCalled();
    expect(onAi).not.toHaveBeenCalled();
  });

  it("主题菜单项展开子视图，选择主题后关闭菜单并持久化", () => {
    renderMenu();

    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "笔记主题" }));
    expect(screen.getAllByRole("menuitemradio")).toHaveLength(8);
    fireEvent.click(screen.getByRole("menuitemradio", { name: "森林" }));

    expect(useUiStore.getState().noteTheme).toBe("forest");
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

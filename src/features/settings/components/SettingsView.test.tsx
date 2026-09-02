import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUiStore } from "@/stores/ui.store";
import { SettingsView } from "./SettingsView";

const repoApiMock = vi.hoisted(() => ({ list: vi.fn(), rename: vi.fn(), remove: vi.fn(), switchRepo: vi.fn() }));
const aiApiMock = vi.hoisted(() => ({ getConfig: vi.fn(), saveConfig: vi.fn() }));
const authApiMock = vi.hoisted(() => ({ logout: vi.fn() }));
const updateApiMock = vi.hoisted(() => ({ checkForUpdate: vi.fn(), installUpdate: vi.fn() }));

vi.mock("@/api", () => ({
  repoApi: repoApiMock,
  aiApi: aiApiMock,
  authApi: authApiMock,
  updateApi: updateApiMock,
  messageOf: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}));

function renderSettings() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <SettingsView />
    </QueryClientProvider>
  );
}

describe("SettingsView 全屏设置视图", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useUiStore.setState({ settingsOpen: true, settingsTab: "appearance", theme: "light", locale: "zh-CN" });
    aiApiMock.getConfig.mockResolvedValue({ enabled: false, provider: "openAiCompatible", baseUrl: "", model: "", hasKey: false });
  });

  it("渲染全部分类导航与当前分类内容", () => {
    renderSettings();
    expect(screen.getByText("仓库")).toBeTruthy();
    expect(screen.getAllByText("外观").length).toBeGreaterThan(0);
    expect(screen.getByText("语言")).toBeTruthy();
    expect(screen.getByText("AI")).toBeTruthy();
    expect(screen.getByText("软件更新")).toBeTruthy();
    expect(screen.getByText("账户")).toBeTruthy();
    expect(screen.getByText("返回工作区")).toBeTruthy();
    expect(document.querySelector('[data-tauri-drag-region]')).toBeTruthy();
  });

  it("点击分类切换右侧内容区", async () => {
    renderSettings();
    fireEvent.click(screen.getByText("AI"));
    expect(useUiStore.getState().settingsTab).toBe("ai");
    expect(await screen.findByText("启用 AI 功能")).toBeTruthy();
  });

  it("按 Esc 关闭设置视图", () => {
    renderSettings();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(useUiStore.getState().settingsOpen).toBe(false);
  });
});

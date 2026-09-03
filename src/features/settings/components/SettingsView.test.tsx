import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUiStore } from "@/stores/ui.store";
import { SettingsView } from "./SettingsView";

const repoApiMock = vi.hoisted(() => ({ list: vi.fn(), rename: vi.fn(), remove: vi.fn(), switchRepo: vi.fn() }));
const aiApiMock = vi.hoisted(() => ({ getConfig: vi.fn(), saveConfig: vi.fn(), fetchModels: vi.fn() }));
const authApiMock = vi.hoisted(() => ({ logout: vi.fn() }));
const updateApiMock = vi.hoisted(() => ({ getCurrentVersion: vi.fn(), checkForUpdate: vi.fn(), installUpdate: vi.fn() }));

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

async function expectAddModelDialogDoesNotSaveSettings() {
  renderSettings();
  fireEvent.click(screen.getByText("AI"));
  await screen.findByText("模型目录");

  fireEvent.click(screen.getByRole("button", { name: "添加模型" }));
  fireEvent.change(await screen.findByLabelText("模型"), { target: { value: "gpt-test" } });
  fireEvent.change(screen.getByLabelText("模型显示名"), { target: { value: "测试模型" } });
  const dialog = screen.getByRole("dialog", { name: "添加模型" });
  fireEvent.click(within(dialog).getByRole("button", { name: "添加模型" }));

  await waitFor(() => expect((screen.getByLabelText("模型显示名") as HTMLInputElement).value).toBe("测试模型"));
  expect(aiApiMock.saveConfig).not.toHaveBeenCalled();
}

async function expectRemoteModelSuggestionsWithoutDuplicateControl() {
  renderSettings();
  fireEvent.click(screen.getByText("AI"));
  await screen.findByText("模型目录");
  fireEvent.click(screen.getByRole("button", { name: "添加模型" }));

  aiApiMock.fetchModels.mockResolvedValue(["gpt-test", "gpt-small"]);
  fireEvent.click(await screen.findByRole("button", { name: "拉取模型列表" }));
  await waitFor(() => expect(document.querySelectorAll("datalist option")).toHaveLength(2));

  expect(screen.getAllByLabelText("模型")).toHaveLength(1);
  expect(screen.queryByLabelText("从远程模型中选择")).toBeNull();
  const modelInput = screen.getByLabelText("模型") as HTMLInputElement;
  fireEvent.change(modelInput, { target: { value: "gpt-test" } });
  expect(modelInput.value).toBe("gpt-test");
  expect((screen.getByLabelText("模型显示名") as HTMLInputElement).value).toBe("gpt-test");
}

async function expectSettingsNavigation() {
  renderSettings();
  expect(screen.getByText("仓库")).toBeTruthy();
  expect(screen.getAllByText("外观").length).toBeGreaterThan(0);
  expect(screen.getByText("语言")).toBeTruthy();
  expect(screen.getByText("AI")).toBeTruthy();
  expect(screen.getByText("软件更新")).toBeTruthy();
  expect(screen.getByText("账户")).toBeTruthy();
  expect(screen.getByText("返回工作区")).toBeTruthy();
  expect(document.querySelector('[data-tauri-drag-region]')).toBeTruthy();
}

describe("SettingsView 全屏设置视图", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useUiStore.setState({ settingsOpen: true, settingsTab: "appearance", theme: "light", locale: "zh-CN" });
    aiApiMock.getConfig.mockResolvedValue({
      enabled: false,
      providers: [{ id: "provider", provider: "openAiCompatible", displayName: "OpenAI", baseUrl: "", enabled: false, hasKey: false }],
      models: [],
      defaultModelId: null,
    });
    updateApiMock.getCurrentVersion.mockResolvedValue("0.14.2");
  });

  it("渲染全部分类导航与当前分类内容", () => {
    void expectSettingsNavigation();
  });

  it("点击分类切换右侧内容区", async () => {
    renderSettings();
    fireEvent.click(screen.getByText("AI"));
    expect(useUiStore.getState().settingsTab).toBe("ai");
    expect(await screen.findByText("AI 能力")).toBeTruthy();
  });

  it("在 AI 弹窗中添加模型时不提交外层设置表单", async () => {
    await expectAddModelDialogDoesNotSaveSettings();
  });

  it("拉取成功后用候选列表选择模型且不显示重复控件", async () => {
    await expectRemoteModelSuggestionsWithoutDuplicateControl();
  });

  it("按 Esc 关闭设置视图", () => {
    renderSettings();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(useUiStore.getState().settingsOpen).toBe(false);
  });
});

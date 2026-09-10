import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SupportSettings } from "./SupportSettings";

const supportApiMock = vi.hoisted(() => ({
  log: vi.fn(),
  exportDiagnostics: vi.fn(),
  info: vi.fn(),
  setLoggingEnabled: vi.fn(),
  clearLogs: vi.fn(),
}));
const openExternalMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const metricsApiMock = vi.hoisted(() => ({ read: vi.fn(), setEnabled: vi.fn(), clear: vi.fn() }));

vi.mock("@/api", () => ({
  supportApi: supportApiMock,
  openExternal: openExternalMock,
  metricsApi: metricsApiMock,
}));

function renderSettings() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <SupportSettings />
    </QueryClientProvider>
  );
}

function mockInfo(overrides: Partial<{ logDir: string; loggingEnabled: boolean; logBytes: number }> = {}) {
  supportApiMock.info.mockResolvedValue({
    logDir: "/Users/me/Library/Logs/dev.ainote.app",
    loggingEnabled: true,
    logBytes: 1536,
    ...overrides,
  });
}

describe("SupportSettings 信息与开关", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockInfo();
    supportApiMock.setLoggingEnabled.mockResolvedValue(undefined);
    supportApiMock.clearLogs.mockResolvedValue(1536);
    metricsApiMock.read.mockResolvedValue({
      enabled: true,
      platform: "macos",
      appVersion: "0.24.12",
      updatedAt: "",
      totals: [],
      activeDays: 0,
      syncSuccessRate: null,
    });
  });

  it("加载日志目录与占用", async () => {
    renderSettings();
    expect(await screen.findByText("1.5 KB")).toBeTruthy();
    expect(screen.getByText("/Users/me/Library/Logs/dev.ainote.app")).toBeTruthy();
  });

  it("开关键盘可达且状态区带 aria-live", async () => {
    renderSettings();
    await screen.findByText("1.5 KB");

    const toggle = screen.getByRole("switch", { name: "记录本地日志" });
    expect(toggle.tagName).toBe("BUTTON");
    expect(toggle.tabIndex).toBe(0);
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    expect(document.querySelector('[aria-live="polite"]')).toBeTruthy();

    fireEvent.click(toggle);
    await waitFor(() => expect(supportApiMock.setLoggingEnabled).toHaveBeenCalledWith(false));
    expect(await screen.findByText("已关闭本地日志")).toBeTruthy();
  });

  it("读取失败时提供重试", async () => {
    supportApiMock.info.mockRejectedValue(new Error("boom"));
    renderSettings();

    expect(await screen.findByText("无法读取诊断信息")).toBeTruthy();
    mockInfo({ logDir: "/tmp/logs", logBytes: 0 });
    fireEvent.click(screen.getByText("重试"));
    expect(await screen.findByText("/tmp/logs")).toBeTruthy();
  });
});

describe("SupportSettings 清理与隐私", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockInfo();
    supportApiMock.clearLogs.mockResolvedValue(1536);
  });

  it("清理日志需二次确认并提示释放空间", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderSettings();
    await screen.findByText("1.5 KB");

    fireEvent.click(screen.getByText("清理日志"));
    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() => expect(supportApiMock.clearLogs).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("已清理 1.5 KB 日志")).toBeTruthy();
  });

  it("用户取消确认时不清理日志", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderSettings();
    await screen.findByText("1.5 KB");

    fireEvent.click(screen.getByText("清理日志"));
    expect(supportApiMock.clearLogs).not.toHaveBeenCalled();
  });

  it("复制日志目录与隐私链接给出反馈", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderSettings();
    await screen.findByText("1.5 KB");

    fireEvent.click(screen.getByLabelText("复制日志目录"));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("/Users/me/Library/Logs/dev.ainote.app"));
    expect(await screen.findByText("已复制日志目录")).toBeTruthy();

    fireEvent.click(screen.getByText("查看隐私说明"));
    expect(openExternalMock).toHaveBeenCalledWith(expect.stringContaining("github.com/small-dream/AINote"));
  });
});

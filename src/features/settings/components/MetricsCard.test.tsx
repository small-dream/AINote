import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const metricsApiMock = vi.hoisted(() => ({
  read: vi.fn(),
  clear: vi.fn(),
  setEnabled: vi.fn(),
}));

vi.mock("@/api", () => ({ metricsApi: metricsApiMock }));

import { MetricsCard } from "./MetricsCard";

const NOTICE_KEY = "ainote.metrics-notice-seen";

const snapshot = {
  enabled: true,
  platform: "macos",
  appVersion: "0.24.12",
  updatedAt: "2026-09-10T02:00:00Z",
  totals: [{ event: "app_launched", count: 3, firstSeen: "2026-09-10T01:00:00Z" }],
  activeDays: 1,
  syncSuccessRate: 1,
};

function renderCard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onStatus = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <MetricsCard onStatus={onStatus} />
    </QueryClientProvider>,
  );
  return { onStatus };
}

beforeEach(() => {
  metricsApiMock.read.mockReset();
  metricsApiMock.clear.mockReset();
  metricsApiMock.setEnabled.mockReset();
  metricsApiMock.read.mockResolvedValue(snapshot);
  metricsApiMock.clear.mockResolvedValue(undefined);
  metricsApiMock.setEnabled.mockResolvedValue(undefined);
});

describe("MetricsCard", () => {
  it("首次打开设置展示说明，确认后记忆不再出现", async () => {
    renderCard();
    await screen.findByText("本机已记录 3 次事件");

    const notice = screen.getByRole("status");
    expect(notice.textContent).toContain("关于本机使用计数");
    expect(notice.textContent).toContain("不包含笔记内容与路径");

    fireEvent.click(screen.getByRole("button", { name: "知道了" }));
    expect(screen.queryByText("关于本机使用计数")).toBeNull();
    expect(localStorage.getItem(NOTICE_KEY)).toBe("1");
  });

  it("已确认过说明时不再展示", async () => {
    localStorage.setItem(NOTICE_KEY, "1");
    renderCard();
    await screen.findByText("本机已记录 3 次事件");
    expect(screen.queryByText("关于本机使用计数")).toBeNull();
  });

  it("关闭开关时写入关闭状态并提示", async () => {
    localStorage.setItem(NOTICE_KEY, "1");
    const { onStatus } = renderCard();
    const toggle = await screen.findByRole("switch", { name: "记录本机使用计数" });
    expect(toggle.getAttribute("aria-checked")).toBe("true");

    fireEvent.click(toggle);
    await waitFor(() => expect(metricsApiMock.setEnabled).toHaveBeenCalledWith(false));
    await waitFor(() => expect(onStatus).toHaveBeenCalledWith("已关闭本机计数，不再写入新记录"));
  });

  it("关闭状态下开关显示为关闭", async () => {
    localStorage.setItem(NOTICE_KEY, "1");
    metricsApiMock.read.mockResolvedValue({ ...snapshot, enabled: false });
    renderCard();
    const toggle = await screen.findByRole("switch", { name: "记录本机使用计数" });
    await waitFor(() => expect(toggle.getAttribute("aria-checked")).toBe("false"));
  });

  it("确认后清空本机计数并提示结果", async () => {
    localStorage.setItem(NOTICE_KEY, "1");
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { onStatus } = renderCard();
    await screen.findByText("本机已记录 3 次事件");

    fireEvent.click(screen.getByRole("button", { name: "清空本机计数" }));
    await waitFor(() => expect(metricsApiMock.clear).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onStatus).toHaveBeenCalledWith("已清空本机计数"));
  });

  it("取消确认时不清空", async () => {
    localStorage.setItem(NOTICE_KEY, "1");
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderCard();
    await screen.findByText("本机已记录 3 次事件");

    fireEvent.click(screen.getByRole("button", { name: "清空本机计数" }));
    expect(metricsApiMock.clear).not.toHaveBeenCalled();
  });
});

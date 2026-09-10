import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const metricsApiMock = vi.hoisted(() => ({
  read: vi.fn(),
  clear: vi.fn(),
  setEnabled: vi.fn(),
  export: vi.fn(),
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
  metricsApiMock.export.mockReset();
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

const funnelSnapshot = {
  ...snapshot,
  totals: [
    { event: "app_launched", count: 10, firstSeen: null },
    { event: "repo_bound", count: 9, firstSeen: null },
    { event: "note_created", count: 9, firstSeen: null },
  ],
  activeDays: 4,
  syncSuccessRate: 0.99,
};

function rowOf(label: string): HTMLElement | null {
  return screen.getByText(label).closest("li");
}

describe("MetricsCard 本机漏斗（E5-T3）", () => {
  it("按事件计数展示转化率、目标与达标状态", async () => {
    localStorage.setItem(NOTICE_KEY, "1");
    metricsApiMock.read.mockResolvedValue(funnelSnapshot);
    renderCard();
    await screen.findByText("本机已记录 28 次事件");

    const bound = rowOf("绑定仓库");
    expect(bound?.textContent).toContain("90.0%");
    expect(bound?.textContent).toContain("目标 ≥ 85%");
    expect(bound?.textContent).toContain("达标");

    expect(rowOf("周活跃天数")?.textContent).toContain("4 天");
    expect(rowOf("同步成功率")?.textContent).toContain("99.0%");
    expect(rowOf("创建笔记")?.textContent).toContain("目标 < 3 分钟");
    expect(rowOf("创建笔记")?.textContent).toContain("无结论");
  });

  it("没有样本的环节显示破折号与「无结论」，不伪装成 0", async () => {
    localStorage.setItem(NOTICE_KEY, "1");
    metricsApiMock.read.mockResolvedValue({ ...snapshot, totals: [], activeDays: 0, syncSuccessRate: null });
    renderCard();
    await screen.findByText("本机已记录 0 次事件");

    expect(rowOf("安装（启动次数）")?.textContent).toContain("—");
    expect(rowOf("同步成功率")?.textContent).toContain("—");
    expect(rowOf("同步成功率")?.textContent).toContain("无结论");
  });
});

describe("MetricsCard 指标导出（E5-T3）", () => {
  it("导出 JSON 调用 IPC 并提示结果", async () => {
    localStorage.setItem(NOTICE_KEY, "1");
    metricsApiMock.export.mockResolvedValue({ path: "/tmp/metrics.json", bytes: 1536 });
    const { onStatus } = renderCard();

    fireEvent.click(await screen.findByRole("button", { name: "导出 JSON" }));
    await waitFor(() => expect(metricsApiMock.export).toHaveBeenCalledWith("json"));
    await waitFor(() => expect(onStatus).toHaveBeenCalledWith("已导出本机指标（1.5 KB）"));
  });

  it("导出 CSV 走同一命令的 csv 格式", async () => {
    localStorage.setItem(NOTICE_KEY, "1");
    metricsApiMock.export.mockResolvedValue({ path: "/tmp/metrics.csv", bytes: 120 });
    renderCard();

    fireEvent.click(await screen.findByRole("button", { name: "导出 CSV" }));
    await waitFor(() => expect(metricsApiMock.export).toHaveBeenCalledWith("csv"));
  });

  it("用户取消保存时既不提示成功也不报错", async () => {
    localStorage.setItem(NOTICE_KEY, "1");
    metricsApiMock.export.mockResolvedValue(null);
    const { onStatus } = renderCard();

    fireEvent.click(await screen.findByRole("button", { name: "导出 JSON" }));
    await waitFor(() => expect(metricsApiMock.export).toHaveBeenCalledWith("json"));
    expect(onStatus).not.toHaveBeenCalled();
  });

  it("导出失败时提示重试", async () => {
    localStorage.setItem(NOTICE_KEY, "1");
    metricsApiMock.export.mockRejectedValue(new Error("disk full"));
    const { onStatus } = renderCard();

    fireEvent.click(await screen.findByRole("button", { name: "导出 CSV" }));
    await waitFor(() => expect(onStatus).toHaveBeenCalledWith("导出失败，请重试"));
  });
});

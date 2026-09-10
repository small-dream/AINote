import { describe, expect, it } from "vitest";
import type { MetricEventName, MetricsSnapshotDto } from "@/api";
import { buildMetricsFunnel, formatFunnelCount, formatFunnelPercent } from "./metricsFunnel";

function snapshot(
  partial: Partial<MetricsSnapshotDto> & { counts?: Record<string, number> } = {},
): MetricsSnapshotDto {
  const { counts = {}, ...rest } = partial;
  return {
    enabled: true,
    platform: "macos",
    appVersion: "0.24.12",
    updatedAt: "",
    totals: Object.entries(counts).map(([event, count]) => ({
      event: event as MetricEventName,
      count,
      firstSeen: null,
    })),
    activeDays: 0,
    syncSuccessRate: null,
    ...rest,
  };
}

function stepOf(snapshotInput: MetricsSnapshotDto | undefined, id: string) {
  return buildMetricsFunnel(snapshotInput).find((step) => step.id === id);
}

describe("buildMetricsFunnel", () => {
  it("没有快照时五个环节都无样本", () => {
    const steps = buildMetricsFunnel(undefined);
    expect(steps.map((step) => step.id)).toEqual([
      "installed",
      "repoBound",
      "firstNote",
      "activeDays",
      "syncHealth",
    ]);
    expect(steps.every((step) => step.value === null)).toBe(true);
    expect(steps.every((step) => step.ratio === null)).toBe(true);
    expect(steps.every((step) => step.met === null)).toBe(true);
  });

  it("换算绑定率、笔记转化率与两个窗口指标", () => {
    const data = snapshot({
      counts: { app_launched: 10, repo_bound: 9, note_created: 9 },
      activeDays: 4,
      syncSuccessRate: 0.99,
    });

    expect(stepOf(data, "repoBound")).toEqual({
      id: "repoBound",
      value: 9,
      ratio: 0.9,
      met: true,
    });
    expect(stepOf(data, "firstNote")?.ratio).toBe(1);
    expect(stepOf(data, "activeDays")).toEqual({
      id: "activeDays",
      value: 4,
      ratio: null,
      met: true,
    });
    expect(stepOf(data, "syncHealth")?.met).toBe(true);
  });

  it("低于目标时标记未达标", () => {
    const data = snapshot({
      counts: { app_launched: 10, repo_bound: 8, note_created: 1 },
      activeDays: 2,
      syncSuccessRate: 0.9,
    });

    expect(stepOf(data, "repoBound")?.met).toBe(false);
    expect(stepOf(data, "activeDays")?.met).toBe(false);
    expect(stepOf(data, "syncHealth")?.met).toBe(false);
  });

  it("启动次数为 0 时不给出绑定率与结论", () => {
    const data = snapshot({ counts: { repo_bound: 2 } });

    expect(stepOf(data, "repoBound")?.ratio).toBeNull();
    expect(stepOf(data, "repoBound")?.met).toBeNull();
  });

  it("没有绑定记录时不给出笔记转化率，同步无样本时不给结论", () => {
    const data = snapshot({ counts: { app_launched: 3 }, syncSuccessRate: null });

    expect(stepOf(data, "firstNote")?.ratio).toBeNull();
    expect(stepOf(data, "firstNote")?.met).toBeNull();
    expect(stepOf(data, "syncHealth")?.value).toBeNull();
    expect(stepOf(data, "syncHealth")?.met).toBeNull();
  });

});

describe("buildMetricsFunnel 边界", () => {
  it("累计计数超过分母时转化率封顶 100%", () => {
    const data = snapshot({ counts: { app_launched: 1, repo_bound: 2, note_created: 7 } });
    expect(stepOf(data, "repoBound")?.ratio).toBe(1);
    expect(stepOf(data, "firstNote")?.ratio).toBe(1);
  });

  it("缺失的白名单事件按 0 计", () => {
    const data = snapshot({ counts: { app_launched: 4 } });
    expect(stepOf(data, "repoBound")?.value).toBe(0);
    expect(stepOf(data, "repoBound")?.ratio).toBe(0);
  });

  it("「创建笔记」不给达标结论（耗时口径未采集）", () => {
    const data = snapshot({ counts: { app_launched: 1, repo_bound: 1, note_created: 1 } });
    expect(stepOf(data, "firstNote")?.met).toBeNull();
  });
});

describe("漏斗格式化", () => {
  it("百分比保留一位小数，无样本显示破折号", () => {
    expect(formatFunnelPercent(0.8512)).toBe("85.1%");
    expect(formatFunnelPercent(0.99)).toBe("99.0%");
    expect(formatFunnelPercent(null)).toBe("—");
  });

  it("计数为 0 与无数据区分展示", () => {
    expect(formatFunnelCount(0)).toBe("0");
    expect(formatFunnelCount(12)).toBe("12");
    expect(formatFunnelCount(null)).toBe("—");
  });
});

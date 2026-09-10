import type { MetricEventName, MetricsSnapshotDto } from "@/api";

/** 漏斗环节（顺序与 `docs/ROADMAP.md` §3.2 的输入指标一致）。 */
export type MetricsFunnelStepId = "installed" | "repoBound" | "firstNote" | "activeDays" | "syncHealth";

/** ROADMAP §3.2 的目标值；本机可度量的环节按它判定是否达标。 */
export const FUNNEL_TARGETS = {
  repoBoundRate: 0.85,
  activeDays: 3,
  syncSuccessRate: 0.99,
} as const;

export interface MetricsFunnelStep {
  id: MetricsFunnelStepId;
  /** 环节数值：前 3 步是事件计数，后 2 步是窗口指标；没有数据为 null。 */
  value: number | null;
  /** 相对上一环节的转化率（0–1）；上一环节无样本时为 null。 */
  ratio: number | null;
  /** 是否达到 ROADMAP 目标；目标本机不可度量或样本不足时为 null。 */
  met: boolean | null;
}

function countOf(snapshot: MetricsSnapshotDto, event: MetricEventName): number {
  return snapshot.totals.find((item) => item.event === event)?.count ?? 0;
}

/** 转化率：分母为 0 时无样本；累计计数可能超过分母，展示上限封顶 100%。 */
function convert(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.min(1, part / whole);
}

function meetsTarget(value: number | null, target: number): boolean | null {
  if (value === null) return null;
  return value >= target - 1e-9;
}

/**
 * 用本机事件计数近似 ROADMAP §3.2 的漏斗。
 * 「创建笔记」环节的目标是首次创建耗时（< 3 分钟），本机未采集时长，因此只给方向不给结论。
 */
export function buildMetricsFunnel(snapshot: MetricsSnapshotDto | undefined): MetricsFunnelStep[] {
  const installed = snapshot ? countOf(snapshot, "app_launched") : null;
  const bound = snapshot ? countOf(snapshot, "repo_bound") : null;
  const notes = snapshot ? countOf(snapshot, "note_created") : null;
  const repoBoundRate = installed === null || bound === null ? null : convert(bound, installed);
  const firstNoteRate = bound === null || notes === null ? null : convert(notes, bound);
  const activeDays = snapshot?.activeDays ?? null;
  const syncRate = snapshot?.syncSuccessRate ?? null;

  return [
    { id: "installed", value: installed, ratio: null, met: null },
    {
      id: "repoBound",
      value: bound,
      ratio: repoBoundRate,
      met: meetsTarget(repoBoundRate, FUNNEL_TARGETS.repoBoundRate),
    },
    { id: "firstNote", value: notes, ratio: firstNoteRate, met: null },
    {
      id: "activeDays",
      value: activeDays,
      ratio: null,
      met: meetsTarget(activeDays, FUNNEL_TARGETS.activeDays),
    },
    {
      id: "syncHealth",
      value: syncRate,
      ratio: null,
      met: meetsTarget(syncRate, FUNNEL_TARGETS.syncSuccessRate),
    },
  ];
}

/** 比率展示：一位小数百分比，无样本显示「—」（不把 0 样本伪装成 0%）。 */
export function formatFunnelPercent(ratio: number | null): string {
  if (ratio === null) return "—";
  return `${(ratio * 100).toFixed(1)}%`;
}

/** 计数展示：无数据显示「—」。 */
export function formatFunnelCount(value: number | null): string {
  return value === null ? "—" : String(value);
}

import { call } from "./client";

/** 可采集事件白名单（与 Rust `domain/metrics.rs` 的 METRIC_EVENTS 一一对应）。 */
export type MetricEventName =
  | "app_launched"
  | "repo_bound"
  | "note_created"
  | "sync_succeeded"
  | "sync_failed"
  | "ai_action_confirmed"
  | "update_checked";

export interface MetricTotalDto {
  event: MetricEventName;
  count: number;
  firstSeen: string | null;
}

export interface MetricsSnapshotDto {
  /** 本地计数开关状态（关闭后不再写入） */
  enabled: boolean;
  platform: string;
  appVersion: string;
  updatedAt: string;
  totals: MetricTotalDto[];
  /** 近 7 天有过事件的天数 */
  activeDays: number;
  /** 近 7 天同步成功率（0–1）；无样本为 null */
  syncSuccessRate: number | null;
}

/** 读取本机指标快照（只有事件计数与时间，不含笔记内容）。 */
async function read(): Promise<MetricsSnapshotDto> {
  return call<MetricsSnapshotDto>("metrics_read");
}

async function record(event: MetricEventName): Promise<void> {
  await call("metrics_record", { event });
}

/** 清空本机指标（用户主动操作）。 */
async function clear(): Promise<void> {
  await call("metrics_clear");
}

/** 切换本地计数开关；关闭后立即停止写入（不删除已有计数）。 */
async function setEnabled(enabled: boolean): Promise<void> {
  await call("metrics_set_enabled", { enabled });
}

/** 尽力而为地记录一次事件：埋点失败不得影响任何业务路径。 */
export function recordMetric(event: MetricEventName): void {
  void record(event).catch(() => undefined);
}

export const metricsApi = { read, record, clear, setEnabled };

/** E2E mock：本地使用指标读写（与 Rust metrics store 同形）。 */
import type { E2eState } from "./types";

export interface MetricsStore {
  metricsEnabled: boolean;
  metricsCounts: Record<string, number>;
  activeDays: number;
  syncSuccessRate: number | null;
}

interface MetricsContext {
  state: E2eState;
  store: MetricsStore;
}

type MetricsHandler = (args: Record<string, unknown>, ctx: MetricsContext) => unknown;

const METRIC_EVENT_NAMES = [
  "app_launched",
  "repo_bound",
  "note_created",
  "sync_succeeded",
  "sync_failed",
  "ai_action_confirmed",
  "update_checked",
];

function metricsError(message: string) {
  return { code: "UNKNOWN_9001", kind: "Unknown", message, retriable: false };
}

export const metricsCommandHandlers: Record<string, MetricsHandler> = {
  metrics_record: (args, ctx) => {
    const event = String(args.event ?? "");
    if (ctx.store.metricsEnabled) ctx.store.metricsCounts[event] = (ctx.store.metricsCounts[event] ?? 0) + 1;
    return null;
  },
  metrics_clear: (_args, ctx) => {
    ctx.store.metricsCounts = {};
    return null;
  },
  metrics_set_enabled: (args, ctx) => {
    ctx.store.metricsEnabled = args.enabled !== false;
    return null;
  },
  metrics_read: (_args, ctx) => ({
    enabled: ctx.store.metricsEnabled,
    platform: "android",
    appVersion: ctx.state.appVersion ?? "0.24.12",
    updatedAt: "",
    totals: METRIC_EVENT_NAMES.map((event) => ({ event, count: ctx.store.metricsCounts[event] ?? 0, firstSeen: null })),
    activeDays: ctx.store.activeDays,
    syncSuccessRate: ctx.store.syncSuccessRate,
  }),
  metrics_export: (args, ctx) => {
    if (ctx.state.metricsExportCanceled) return null;
    const format = String(args.format ?? "");
    if (format !== "json" && format !== "csv") throw metricsError(`unsupported format: ${format}`);
    return { path: `/tmp/ainote-metrics-0.24.12.${format}`, bytes: 1536 };
  },
};

import { BarChart3, Trash2 } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { useTranslation } from "@/i18n";
import { useClearMetrics, useMetricsNotice, useMetricsSnapshot, useSetMetricsEnabled } from "../hooks/useMetrics";
import { AiToggle } from "./AiField";

/**
 * 设置页「隐私与度量」（E5-T2）：本机计数说明 + 开关 + 清空。
 * 文字必须与实现一致——只记事件计数与时间，不记内容、路径、凭证，也没有远程上报。
 */
export function MetricsCard({ onStatus }: { onStatus: (message: string) => void }) {
  const { t } = useTranslation();
  const snapshot = useMetricsSnapshot();
  const setEnabled = useSetMetricsEnabled();
  const clear = useClearMetrics();
  const notice = useMetricsNotice();
  const enabled = snapshot.data?.enabled ?? true;
  const recorded = snapshot.data?.totals.reduce((sum, item) => sum + item.count, 0) ?? 0;

  function toggle(next: boolean): void {
    setEnabled.mutate(next, {
      onSuccess: () => onStatus(next ? t("support.metricsEnabledOn") : t("support.metricsEnabledOff")),
      onError: () => onStatus(t("support.metricsToggleFailed")),
    });
  }

  function runClear(): void {
    if (!window.confirm(t("support.metricsClearConfirm"))) return;
    clear.mutate(undefined, {
      onSuccess: () => onStatus(t("support.metricsCleared")),
      onError: () => onStatus(t("support.metricsClearFailed")),
    });
  }

  return (
    <section className="rounded-lg border border-border p-4">
      {notice.visible ? <MetricsNotice onDismiss={notice.dismiss} /> : null}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-text-primary">{t("support.metricsTitle")}</h3>
          <p className="mt-1 text-xs text-text-secondary">{t("support.metricsDescription")}</p>
        </div>
        <AiToggle checked={enabled} label={t("support.metricsToggle")} onChange={toggle} />
      </div>
      <p className="mt-2 text-xs text-text-tertiary">{t("support.metricsRemoteOff")}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          className="inline-flex items-center gap-1.5 text-xs"
          disabled={clear.isPending || setEnabled.isPending}
          onClick={runClear}
        >
          <Trash2 size={14} />
          {clear.isPending ? t("support.metricsClearing") : t("support.metricsClear")}
        </Button>
        <span className="text-xs text-text-tertiary">
          {t("support.metricsRecorded", { count: recorded })}
        </span>
      </div>
    </section>
  );
}

function MetricsNotice({ onDismiss }: { onDismiss: () => void }) {
  const { t } = useTranslation();
  return (
    <div role="status" className="mb-3 rounded-md bg-accent-soft px-3 py-2">
      <p className="flex items-center gap-1.5 text-xs font-medium text-text-primary">
        <BarChart3 size={13} aria-hidden="true" />
        {t("support.metricsNoticeTitle")}
      </p>
      <p className="mt-1 text-xs leading-5 text-text-secondary">{t("support.metricsNoticeBody")}</p>
      <Button variant="ghost" className="mt-1.5 border border-border text-xs" onClick={onDismiss}>
        {t("support.metricsNoticeOk")}
      </Button>
    </div>
  );
}

import { Download, Trash2 } from "lucide-react";
import type { MetricsExportFormat } from "@/api";
import { Button } from "@/components/atoms/Button";
import { useTranslation } from "@/i18n";
import type { TranslationKey } from "@/i18n/messages";
import { useClearMetrics, useExportMetrics } from "../hooks/useMetrics";
import { formatRepoSize } from "../utils/repoSize";

const EXPORT_FORMATS: { format: MetricsExportFormat; labelKey: TranslationKey }[] = [
  { format: "json", labelKey: "support.metricsExportJson" },
  { format: "csv", labelKey: "support.metricsExportCsv" },
];

interface MetricsActionsProps {
  recorded: number;
  toggling: boolean;
  onStatus: (message: string) => void;
}

/** 本机指标操作行（E5-T3）：导出 JSON / CSV、清空计数、已记录次数。 */
export function MetricsActions({ recorded, toggling, onStatus }: MetricsActionsProps) {
  const { t } = useTranslation();
  const clear = useClearMetrics();
  const exportMetrics = useExportMetrics();
  const pendingFormat = exportMetrics.isPending ? exportMetrics.variables : undefined;

  function runClear(): void {
    if (!window.confirm(t("support.metricsClearConfirm"))) return;
    clear.mutate(undefined, {
      onSuccess: () => onStatus(t("support.metricsCleared")),
      onError: () => onStatus(t("support.metricsClearFailed")),
    });
  }

  /** 用户取消保存时后端返回 null：不提示成功也不报错。 */
  function runExport(format: MetricsExportFormat): void {
    exportMetrics.mutate(format, {
      onSuccess: (result) => {
        if (result) onStatus(t("support.metricsExported", { size: formatRepoSize(result.bytes) }));
      },
      onError: () => onStatus(t("support.metricsExportFailed")),
    });
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {EXPORT_FORMATS.map(({ format, labelKey }) => (
        <Button
          key={format}
          variant="ghost"
          className="inline-flex items-center gap-1.5 text-xs"
          disabled={exportMetrics.isPending}
          onClick={() => runExport(format)}
        >
          <Download size={14} />
          {pendingFormat === format ? t("support.metricsExporting") : t(labelKey)}
        </Button>
      ))}
      <Button
        variant="ghost"
        className="inline-flex items-center gap-1.5 text-xs"
        disabled={clear.isPending || toggling}
        onClick={runClear}
      >
        <Trash2 size={14} />
        {clear.isPending ? t("support.metricsClearing") : t("support.metricsClear")}
      </Button>
      <span className="text-xs text-text-tertiary">
        {t("support.metricsRecorded", { count: recorded })}
      </span>
    </div>
  );
}

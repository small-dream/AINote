import { RefreshCw } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { useTranslation } from "@/i18n";
import type { SyncRetryProgress } from "@/stores/sync-retry.store";

interface SyncRetryBannerProps {
  retry: SyncRetryProgress;
  onCancel: () => void;
}

/** 拉取阶段自动重试中的进度条：显示「重试中（n/m）」并可随时取消（E4-T2）。 */
export function SyncRetryBanner({ retry, onCancel }: SyncRetryBannerProps) {
  const { t } = useTranslation();
  return (
    <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-warning/30 bg-warning/5 px-4 py-2.5">
      <RefreshCw size={15} aria-hidden="true" className="shrink-0 animate-spin text-warning" />
      <p className="min-w-0 flex-1 text-[13px] text-text-primary">
        {t("sync.retrying", { retry: retry.retry, max: retry.maxRetries })}
        <span className="ml-2 text-xs text-text-tertiary">
          {t("sync.retryingHint", { seconds: Math.max(1, Math.round(retry.delayMs / 1000)) })}
        </span>
      </p>
      <Button variant="ghost" className="shrink-0 px-2.5 text-xs" onClick={onCancel}>
        {t("sync.cancelRetry")}
      </Button>
    </div>
  );
}

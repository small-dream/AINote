import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { useTranslation } from "@/i18n";
import { deriveSyncFailure } from "../utils/status";

interface ConflictFailureBannerProps {
  error: unknown;
  onRetry: () => void;
  retrying?: boolean;
}

/**
 * 冲突处理失败横幅：沿用同步失败的「原因 + 下一步」口径。
 * 冲突解决 / 收尾推送失败必须显式回显，否则用户点按钮后看不到任何反应。
 */
export function ConflictFailureBanner({ error, onRetry, retrying = false }: ConflictFailureBannerProps) {
  const { locale, t } = useTranslation();
  const failure = deriveSyncFailure(error, locale);
  if (!failure) return null;
  return (
    <div role="alert" className="flex shrink-0 items-start gap-x-3 border-b border-danger/30 bg-danger/5 px-4 py-2.5">
      <TriangleAlert size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-danger" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-text-primary">{t("sync.resolveFailedTitle")}</p>
        <p className="mt-0.5 break-words text-xs text-text-secondary">{failure.reason}</p>
        <p className="mt-0.5 break-words text-xs text-text-tertiary">{failure.suggestion}</p>
      </div>
      <Button variant="primary" className="shrink-0 px-3 text-xs" onClick={onRetry} disabled={retrying}>
        {t("common.retry")}
      </Button>
    </div>
  );
}

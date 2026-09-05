import { RefreshCw } from "lucide-react";
import { useTranslation } from "@/i18n";
import { useRepoSize } from "../hooks/useRepoSize";
import { formatRepoSize } from "../utils/repoSize";

/** 设置页仓库管理：当前活动仓库的本地磁盘占用。 */
export function RepoSizeCard() {
  const { data, error, isFetching, isLoading, refetch } = useRepoSize();
  const { t } = useTranslation();
  const size = error
    ? t("repo.sizeUnavailable")
    : isLoading || isFetching
      ? t("repo.sizeLoading")
      : formatRepoSize(data?.bytes ?? 0);

  return (
    <div className="flex items-center justify-between rounded-md border border-border p-3">
      <div>
        <p className="text-xs text-text-tertiary">{t("repo.sizeLabel")}</p>
        <p className="mt-0.5 text-sm font-medium">{size}</p>
      </div>
      <button
        type="button"
        aria-label={t("repo.sizeRefresh")}
        title={t("repo.sizeRefresh")}
        onClick={() => void refetch()}
        disabled={isFetching}
        className="grid h-7 w-7 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-primary disabled:opacity-50"
      >
        <RefreshCw size={15} />
      </button>
    </div>
  );
}

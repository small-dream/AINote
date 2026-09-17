import type { ReactNode } from "react";
import { GitMerge, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { useTranslation } from "@/i18n";
import type { ConflictMergeController } from "../hooks/useConflictMerge";
import { deriveSyncFailure } from "../utils/status";

/** 冲突面板的加载 / 失败 / 无冲突文件三态：任何一种都不能只留一块空白面板 */
export function ConflictMergePlaceholder({ merge }: { merge: ConflictMergeController }) {
  const { locale, t } = useTranslation();
  if (merge.phase === "loading") {
    return (
      <Placeholder icon={<Loader2 size={20} className="animate-spin" />} title={t("common.loading")} />
    );
  }
  if (merge.phase === "error") {
    const reason = deriveSyncFailure(merge.loadError, locale)?.reason;
    return (
      <Placeholder
        icon={<TriangleAlert size={20} className="text-danger" />}
        title={t("sync.conflictLoadFailed")}
        description={reason ? `${reason} · ${t("sync.conflictLoadFailedHint")}` : t("sync.conflictLoadFailedHint")}
        action={
          <Button variant="primary" onClick={merge.retry}>
            {t("common.retry")}
          </Button>
        }
      />
    );
  }
  return (
    <Placeholder
      icon={<GitMerge size={20} className="text-text-tertiary" />}
      title={t("sync.conflictEmpty")}
      description={t("sync.finishMergeHint")}
      action={
        <Button variant="primary" disabled={merge.resolving} onClick={merge.finishMerge}>
          {merge.pending === "all" ? t("sync.resolving") : t("sync.finishMerge")}
        </Button>
      }
    />
  );
}

function Placeholder({ icon, title, description, action }: { icon: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 py-8 text-center">
      {icon}
      <p className="text-sm font-medium text-text-primary">{title}</p>
      {description ? <p className="max-w-md text-xs text-text-secondary">{description}</p> : null}
      {action}
    </div>
  );
}

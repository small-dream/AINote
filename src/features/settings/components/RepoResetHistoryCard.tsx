import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { useTranslation } from "@/i18n";
import { ResetHistoryDialog } from "./ResetHistoryDialog";

interface RepoResetHistoryCardProps {
  /** 当前活动仓库展示名：确认框要求逐字输入它 */
  repoName: string;
}

/**
 * 设置页仓库管理「危险区」：把仓库重置为「工作区现状 = 唯一一次提交」。
 * 与上方只读卡片分开呈现，避免用户误认为它是可逆操作。
 */
export function RepoResetHistoryCard({ repoName }: RepoResetHistoryCardProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-md border border-danger/40 bg-danger/5 p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-danger">
        <TriangleAlert size={13} />
        {t("repo.resetHistory")}
      </p>
      <p className="mt-0.5 text-xs text-text-secondary">{t("repo.resetHistoryDescription")}</p>
      <div className="mt-3">
        <Button
          type="button"
          variant="ghost"
          className="inline-flex items-center gap-1.5 border border-danger/50 text-xs text-danger"
          onClick={() => setOpen(true)}
        >
          <TriangleAlert size={13} />
          {t("repo.resetHistoryAction")}
        </Button>
      </div>
      <ResetHistoryDialog open={open} repoName={repoName} onClose={() => setOpen(false)} />
    </section>
  );
}

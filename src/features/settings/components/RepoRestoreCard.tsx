import { Upload } from "lucide-react";
import { messageOf } from "@/api";
import { Button } from "@/components/atoms/Button";
import { useTranslation } from "@/i18n";
import { useRepoRestore } from "../hooks/useRepoRestore";

/** 设置页仓库管理：从备份包恢复仓库（校验 manifest 与 sha256 后落盘）。 */
export function RepoRestoreCard() {
  const { t } = useTranslation();
  const restore = useRepoRestore();

  return (
    <section className="rounded-md border border-border p-3">
      <p className="flex items-center gap-1.5 text-xs text-text-tertiary">
        <Upload size={13} />
        {t("repo.restore")}
      </p>
      <p className="mt-0.5 text-xs text-text-secondary">{t("repo.restoreDescription")}</p>

      <div className="mt-3">
        <Button
          type="button"
          variant="ghost"
          className="inline-flex items-center gap-1.5 border border-border text-xs"
          disabled={restore.pending}
          onClick={() => restore.run()}
        >
          <Upload size={13} />
          {restore.pending ? t("repo.restoring") : t("repo.restoreAction")}
        </Button>
      </div>

      <div className="mt-2" role="status" aria-live="polite">
        <RestoreStatus
          pending={restore.pending}
          failed={restore.failed}
          error={restore.error}
          result={restore.result}
        />
      </div>
    </section>
  );
}

interface RestoreStatusProps {
  pending: boolean;
  failed: boolean;
  error: unknown;
  result: { name: string; fileCount: number } | null | undefined;
}

function RestoreStatus({ pending, failed, error, result }: RestoreStatusProps) {
  const { t } = useTranslation();
  if (pending) return <p className="text-xs text-text-secondary">{t("repo.restoring")}</p>;
  if (failed) {
    return (
      <p className="break-all text-xs text-text-secondary">
        {t("repo.restoreFailed", { message: messageOf(error) })}
      </p>
    );
  }
  if (result === null) return <p className="text-xs text-text-secondary">{t("repo.restoreCanceled")}</p>;
  if (!result) return null;
  return (
    <p className="break-all text-xs text-text-secondary">
      {t("repo.restoreDone", { name: result.name, count: result.fileCount })}
    </p>
  );
}

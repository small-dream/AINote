import { useState } from "react";
import { Archive } from "lucide-react";
import type { BackupExportDto, BackupProgress } from "@/api";
import { Button } from "@/components/atoms/Button";
import { useTranslation } from "@/i18n";
import { useRepoBackup } from "../hooks/useRepoBackup";
import { formatRepoSize } from "../utils/repoSize";

/** 设置页仓库管理：把工作区 + Git 历史导出为 zip（只读，不改动仓库）。 */
export function RepoBackupCard() {
  const { t } = useTranslation();
  const [excludeAssets, setExcludeAssets] = useState(false);
  const backup = useRepoBackup();

  return (
    <section className="rounded-md border border-border p-3">
      <p className="flex items-center gap-1.5 text-xs text-text-tertiary">
        <Archive size={13} />
        {t("repo.backup")}
      </p>
      <p className="mt-0.5 text-xs text-text-secondary">{t("repo.backupDescription")}</p>

      <label className="mt-2 flex items-center gap-2 text-xs text-text-secondary">
        <input
          type="checkbox"
          checked={excludeAssets}
          disabled={backup.pending}
          onChange={(event) => setExcludeAssets(event.target.checked)}
          className="h-3.5 w-3.5 accent-[var(--accent)]"
        />
        {t("repo.backupExcludeAssets")}
      </label>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          className="inline-flex items-center gap-1.5 border border-border text-xs"
          disabled={backup.pending}
          onClick={() => backup.run(excludeAssets)}
        >
          <Archive size={13} />
          {backup.pending ? t("repo.backupExporting") : t("repo.backupExport")}
        </Button>
        {backup.pending && (
          <Button type="button" variant="ghost" className="text-xs" onClick={backup.cancel}>
            {t("common.cancel")}
          </Button>
        )}
      </div>

      <div className="mt-2" role="status" aria-live="polite">
        <BackupStatus
          pending={backup.pending}
          failed={backup.failed}
          progress={backup.progress}
          result={backup.result}
        />
      </div>
    </section>
  );
}

interface BackupStatusProps {
  pending: boolean;
  failed: boolean;
  progress: BackupProgress | null;
  result: BackupExportDto | null | undefined;
}

function BackupStatus({ pending, failed, progress, result }: BackupStatusProps) {
  const { t } = useTranslation();
  if (pending) return <BackupProgressText progress={progress} />;
  if (failed) return <p className="text-xs text-text-secondary">{t("repo.backupFailed")}</p>;
  if (result === null) return <p className="text-xs text-text-secondary">{t("repo.backupCanceled")}</p>;
  if (!result) return null;
  return (
    <p className="break-all text-xs text-text-secondary">
      {t("repo.backupDone", { size: formatRepoSize(result.bytes), count: result.fileCount })}
    </p>
  );
}

function BackupProgressText({ progress }: { progress: BackupProgress | null }) {
  const { t } = useTranslation();
  if (!progress || progress.phase === "scanning") {
    return <p className="text-xs text-text-secondary">{t("repo.backupScanning")}</p>;
  }
  return (
    <p className="text-xs text-text-secondary">
      {t("repo.backupProgress", { processed: progress.processed, total: progress.total })}
    </p>
  );
}

import { useState } from "react";
import { messageOf } from "@/api";
import type { HistoryResetReport } from "@/api/types";
import { Button } from "@/components/atoms/Button";
import { Modal } from "@/components/molecules/Modal";
import { useTranslation } from "@/i18n";
import { useRepoResetHistory } from "../hooks/useRepoResetHistory";

/** 单次提交的默认说明：与后端自动提交保持一致的前缀风格。 */
export const DEFAULT_RESET_MESSAGE = "note: reset history";

interface ResetHistoryDialogProps {
  open: boolean;
  repoName: string;
  onClose: () => void;
}

/**
 * 历史重置确认：必须逐字输入仓库名称才可提交。
 * 这是全应用唯一的不可撤销破坏性操作，因此确认门槛比删除笔记更高。
 */
export function ResetHistoryDialog({ open, repoName, onClose }: ResetHistoryDialogProps) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState("");
  const [message, setMessage] = useState(DEFAULT_RESET_MESSAGE);
  const reset = useRepoResetHistory();
  const matched = typed === repoName && repoName !== "";
  const done = reset.isSuccess;

  function close() {
    if (reset.isPending) return;
    setTyped("");
    setMessage(DEFAULT_RESET_MESSAGE);
    reset.reset();
    onClose();
  }

  return (
    <Modal open={open} title={t("repo.resetHistoryTitle")} onClose={close}>
      <ResetHistoryForm
        repoName={repoName}
        message={message}
        typed={typed}
        disabled={reset.isPending}
        onMessage={setMessage}
        onTyped={setTyped}
      />
      <ResetStatus report={reset.data} error={reset.isError ? reset.error : null} />
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" onClick={close} disabled={reset.isPending}>
          {t("common.cancel")}
        </Button>
        <Button
          onClick={() => (done ? close() : reset.mutate(message))}
          disabled={!done && (!matched || reset.isPending)}
        >
          {statusLabel()}
        </Button>
      </div>
    </Modal>
  );

  function statusLabel() {
    if (reset.isPending) return t("repo.resetHistoryRunning");
    return done ? t("repo.resetHistoryClose") : t("repo.resetHistorySubmit");
  }
}

interface ResetHistoryFormProps {
  repoName: string;
  message: string;
  typed: string;
  disabled: boolean;
  onMessage: (value: string) => void;
  onTyped: (value: string) => void;
}

/** 风险说明 + 提交说明 + 仓库名确认输入 */
function ResetHistoryForm(props: ResetHistoryFormProps) {
  const { t } = useTranslation();
  const fieldClass = "mb-3 w-full rounded border border-border bg-bg-secondary px-2 py-1 text-xs";
  const labelClass = "mb-1 block text-xs text-text-secondary";
  return (
    <>
      <ul className="mb-3 list-disc space-y-1 pl-4 text-xs text-text-secondary">
        <li>{t("repo.resetHistoryNotReversible")}</li>
        <li>{t("repo.resetHistoryRemoteWarning")}</li>
        <li>{t("repo.resetHistoryUncommittedHint")}</li>
        <li>{t("repo.resetHistoryBackupHint")}</li>
      </ul>
      <label className={labelClass} htmlFor="reset-history-message">
        {t("repo.resetHistoryMessageLabel")}
      </label>
      <input
        id="reset-history-message"
        value={props.message}
        disabled={props.disabled}
        onChange={(event) => props.onMessage(event.target.value)}
        className={fieldClass}
      />
      <label className={labelClass} htmlFor="reset-history-confirm">
        {t("repo.resetHistoryConfirmLabel", { name: props.repoName })}
      </label>
      <input
        id="reset-history-confirm"
        value={props.typed}
        disabled={props.disabled}
        onChange={(event) => props.onTyped(event.target.value)}
        className={fieldClass}
      />
    </>
  );
}

function ResetStatus({ report, error }: { report: HistoryResetReport | undefined; error: unknown }) {
  const { t } = useTranslation();
  if (error) {
    return <p className="text-xs text-danger">{t("repo.resetHistoryFailed", { message: messageOf(error) })}</p>;
  }
  if (!report) return null;
  return (
    <div className="space-y-1 text-xs text-text-secondary" role="status" aria-live="polite">
      <p>
        {t("repo.resetHistoryDone", {
          commits: report.erasedCommits,
          branch: report.branch,
          shortId: report.commitId.slice(0, 7),
          count: report.fileCount,
        })}
      </p>
      {!report.pushed && <p>{t("repo.resetHistoryLocalOnly")}</p>}
      {report.backupCleanupFailed && <p className="text-danger">{t("repo.resetHistoryLeftover")}</p>}
    </div>
  );
}

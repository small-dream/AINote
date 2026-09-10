import { useTranslation } from "@/i18n";
import { Modal } from "@/components/molecules/Modal";
import { Button } from "@/components/atoms/Button";
import type { TranslationKey } from "@/i18n/messages";
import { useCommitDialog } from "../hooks/useCommitDialog";
import { STATUS_LETTER } from "../utils/message";
import type { ChangedFile } from "@/api/types";

interface CommitDialogProps {
  repoPath: string | null;
  onClose: () => void;
}

const STATUS_TITLE: Record<ChangedFile["status"], TranslationKey> = {
  added: "commit.added",
  modified: "commit.modified",
  deleted: "commit.deleted",
};

/** 手动提交版本（阶段 A）：待提交变更列表 + 自动生成可编辑的 commit message。 */
export function CommitDialog({ repoPath, onClose }: CommitDialogProps) {
  const { t } = useTranslation();
  const { files, loading, message, changeMessage, submitting, canSubmit, submit } =
    useCommitDialog(repoPath, onClose);

  return (
    <Modal open title={t("commit.title")} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-text-tertiary">{t("commit.fileCount", { count: files.length })}</p>
        <div className="max-h-56 min-h-0 overflow-y-auto rounded-md border border-border bg-bg-tertiary/40">
          {loading ? (
            <p className="px-3 py-3 text-sm text-text-tertiary">{t("common.loading")}</p>
          ) : files.length === 0 ? (
            <p className="px-3 py-3 text-sm text-text-tertiary">{t("commit.empty")}</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {files.map((file) => (
                <li key={file.path} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                  <span
                    title={t(STATUS_TITLE[file.status])}
                    className="w-5 shrink-0 text-center font-mono text-xs"
                    data-commit-status={file.status}
                  >
                    {STATUS_LETTER[file.status]}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-text-secondary">{file.path}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-text-secondary">{t("commit.messageLabel")}</span>
          <textarea
            value={message}
            onChange={(event) => changeMessage(event.target.value)}
            rows={4}
            disabled={submitting}
            className="resize-y rounded-md border border-border bg-bg-primary px-2.5 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent"
            aria-label={t("commit.messageLabel")}
          />
          <span className="text-xs text-text-tertiary">{t("commit.messageHint")}</span>
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("common.cancel")}
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {submitting ? t("commit.submitting") : t("commit.submit")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

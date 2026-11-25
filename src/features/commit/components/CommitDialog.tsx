import { useTranslation } from "@/i18n";
import { Modal } from "@/components/molecules/Modal";
import { Button } from "@/components/atoms/Button";
import { useCommitDialog } from "../hooks/useCommitDialog";
import { CommitFileList } from "./CommitFileList";
import { CommitDiffPane } from "./CommitDiffPane";

interface CommitDialogProps {
  repoPath: string | null;
  onClose: () => void;
}

/** 手动提交面板：待提交变更列表 + 选中文件改动预览 + 可编辑 commit message。 */
export function CommitDialog({ repoPath, onClose }: CommitDialogProps) {
  const { t } = useTranslation();
  const dialog = useCommitDialog(repoPath, onClose);

  return (
    <Modal open title={t("commit.title")} onClose={onClose} className="max-w-3xl!">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <p className="text-sm text-text-tertiary">
            {t("commit.fileCount", { count: dialog.files.length })}
          </p>
          {dialog.files.length > 0 ? (
            <p className="text-xs text-text-tertiary">{t("commit.viewHint")}</p>
          ) : null}
        </div>
        <div className="commit-dialog-body flex min-h-0 gap-3">
          <CommitFileList
            files={dialog.files}
            loading={dialog.loading}
            activePath={dialog.activePath}
            onSelect={dialog.selectFile}
          />
          <CommitDiffPane
            path={dialog.activePath}
            diff={dialog.diff}
            loading={dialog.diffLoading}
            fetching={dialog.diffFetching}
            error={dialog.diffError}
            onRefresh={dialog.refreshDiff}
          />
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-text-secondary">{t("commit.messageLabel")}</span>
          <textarea
            value={dialog.message}
            onChange={(event) => dialog.changeMessage(event.target.value)}
            rows={3}
            disabled={dialog.submitting}
            className="resize-y rounded-md border border-border bg-bg-primary px-2.5 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent"
            aria-label={t("commit.messageLabel")}
          />
          <span className="text-xs text-text-tertiary">{t("commit.messageHint")}</span>
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={dialog.submitting}>
            {t("common.cancel")}
          </Button>
          <Button onClick={dialog.submit} disabled={!dialog.canSubmit}>
            {dialog.submitting ? t("commit.submitting") : t("commit.submit")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

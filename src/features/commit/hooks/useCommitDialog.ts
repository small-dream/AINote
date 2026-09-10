import { useCallback, useState } from "react";
import { useChangedFilesQuery, useCommitPendingMutation } from "@/queries/sync.queries";
import { reportToastError, useToastStore } from "@/stores/toast.store";
import { useTranslation } from "@/i18n";
import { buildCommitMessage } from "../utils/message";

/** 手动提交面板编排：待提交变更 + 默认 message（可编辑）+ 提交 mutation。 */
export function useCommitDialog(repoPath: string | null, onClose: () => void) {
  const { t } = useTranslation();
  const filesQuery = useChangedFilesQuery(repoPath);
  const commit = useCommitPendingMutation();
  const [draft, setDraft] = useState("");
  const [touched, setTouched] = useState(false);
  const [openedAt] = useState(() => new Date());

  const defaultMessage = buildCommitMessage(filesQuery.data ?? [], openedAt);
  const message = touched ? draft : defaultMessage;

  const changeMessage = useCallback((value: string) => {
    setTouched(true);
    setDraft(value);
  }, []);

  const submit = useCallback(() => {
    const text = message.trim();
    if (!text || commit.isPending) return;
    commit.mutate(text, {
      onSuccess: (hash) => {
        const shortId = hash ? hash.slice(0, 7) : "";
        useToastStore.getState().push(t("commit.done", { shortId }), "success");
        onClose();
      },
      onError: reportToastError,
    });
  }, [commit, message, onClose, t]);

  return {
    files: filesQuery.data ?? [],
    loading: filesQuery.isLoading,
    message,
    changeMessage,
    submitting: commit.isPending,
    canSubmit: message.trim().length > 0 && !commit.isPending,
    submit,
  };
}

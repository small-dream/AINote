import { useCallback, useState } from "react";
import {
  useChangedFilesQuery,
  useCommitPendingMutation,
  useWorkingDiffQuery,
} from "@/queries/sync.queries";
import { reportToastError, useToastStore } from "@/stores/toast.store";
import { useSessionStore } from "@/stores/session.store";
import { useTranslation } from "@/i18n";
import { buildCommitMessage } from "../utils/message";

/** 手动提交面板编排：待提交变更 + 选中文件 diff + 默认 message + 提交 mutation。 */
export function useCommitDialog(repoPath: string | null, onClose: () => void) {
  const { t } = useTranslation();
  const currentNotePath = useSessionStore((state) => state.currentNotePath);
  const filesQuery = useChangedFilesQuery(repoPath);
  const files = filesQuery.data ?? [];
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  // 默认优先预览当前打开的笔记（用户最关心自己刚改的内容），否则回退到首个文件。
  const initialPath =
    currentNotePath && files.some((file) => file.path === currentNotePath)
      ? currentNotePath
      : (files[0]?.path ?? null);
  // 列表刷新后选中项可能消失：回退到默认文件，保证打开面板就能看到改动。
  const activePath =
    selectedPath && files.some((file) => file.path === selectedPath)
      ? selectedPath
      : initialPath;
  const diffQuery = useWorkingDiffQuery(repoPath, activePath);
  const commit = useCommitPendingMutation();
  const [draft, setDraft] = useState("");
  const [touched, setTouched] = useState(false);
  const [openedAt] = useState(() => new Date());

  const defaultMessage = buildCommitMessage(files, openedAt);
  const message = touched ? draft : defaultMessage;
  const { refetch } = diffQuery;
  const refreshDiff = useCallback(() => {
    void refetch();
  }, [refetch]);

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
    files,
    loading: filesQuery.isLoading,
    activePath,
    selectFile: setSelectedPath,
    diff: diffQuery.data,
    diffLoading: diffQuery.isLoading,
    diffFetching: diffQuery.isFetching,
    diffError: diffQuery.error,
    refreshDiff,
    message,
    changeMessage,
    submitting: commit.isPending,
    canSubmit: message.trim().length > 0 && !commit.isPending,
    submit,
  };
}

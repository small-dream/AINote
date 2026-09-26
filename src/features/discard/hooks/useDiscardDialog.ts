import { useCallback, useMemo, useState } from "react";
import { useChangedFilesQuery, useDiscardChangesMutation } from "@/queries/sync.queries";
import { reportToastError, useToastStore } from "@/stores/toast.store";
import { useTranslation } from "@/i18n";
import type { TranslationKey } from "@/i18n/messages";
import type { DiscardReport } from "@/api/types";
import { splitByStatus, toggleSelectAll, toggleSelection } from "../utils/selection";

type TranslateFn = (key: TranslationKey, values?: Record<string, string | number>) => string;

/** 丢弃结果反馈：无实际改动 / 成功 / 有跳过项三种口径分别提示。 */
function pushDiscardResult(report: DiscardReport, t: TranslateFn): void {
  const toast = useToastStore.getState();
  if (report.restored.length + report.deleted.length === 0) {
    toast.push(t("discard.none"), "info");
    return;
  }
  toast.push(
    t("discard.done", { restored: report.restored.length, deleted: report.deleted.length }),
    "success",
  );
  if (report.skipped.length > 0) {
    toast.push(t("discard.skipped", { count: report.skipped.length }), "info");
  }
}

/**
 * 丢弃面板编排：待提交变更列表 + 勾选集合 + 二次确认门禁 + 丢弃 mutation。
 * 选中状态是面板局部态（useState），服务端/Git 状态仍以 Query 为唯一权威来源。
 */
export function useDiscardDialog(repoPath: string | null, onClose: () => void) {
  const { t } = useTranslation();
  const filesQuery = useChangedFilesQuery(repoPath);
  const discard = useDiscardChangesMutation();
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [confirming, setConfirming] = useState(false);

  // 列表被外部改写（同步、别的窗口提交）时选中集合可能残留旧路径：一律以列表为准派生，
  // 陈旧项自然被忽略，不必在 effect 里回写选中态。
  const files = useMemo(() => filesQuery.data ?? [], [filesQuery.data]);
  const chosen = useMemo(
    () => files.filter((file) => selected.has(file.path)),
    [files, selected],
  );
  const { restore, remove } = splitByStatus(chosen);

  const toggle = useCallback((path: string) => {
    setSelected((prev) => toggleSelection(prev, path));
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => toggleSelectAll(prev, files.map((file) => file.path)));
  }, [files]);

  const submit = useCallback(() => {
    const paths = chosen.map((file) => file.path);
    if (paths.length === 0 || discard.isPending) return;
    discard.mutate(paths, {
      onSuccess: (report) => {
        setConfirming(false);
        onClose();
        pushDiscardResult(report, t);
      },
      onError: reportToastError,
    });
  }, [chosen, discard, onClose, t]);

  return {
    files,
    loading: filesQuery.isLoading,
    isSelected: (path: string) => selected.has(path),
    selectedCount: chosen.length,
    allSelected: files.length > 0 && chosen.length === files.length,
    restoreCount: restore.length,
    deleteCount: remove.length,
    toggle,
    toggleAll,
    confirming,
    openConfirm: () => setConfirming(true),
    closeConfirm: () => setConfirming(false),
    submitting: discard.isPending,
    canSubmit: chosen.length > 0 && !discard.isPending,
    submit,
  };
}

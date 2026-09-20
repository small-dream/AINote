import { AlertCircle, Check, Loader2 } from "lucide-react";
import { useTranslation } from "@/i18n";
import type { TranslationKey } from "@/i18n/messages";
import { taskSaveView, type TaskSaveStatus as SaveStatus, type TaskSaveView } from "../utils/saveState";

const LABEL_KEY: Record<TaskSaveView, TranslationKey> = {
  unsaved: "todo.unsaved",
  saving: "todo.saving",
  saved: "todo.saved",
  failed: "todo.saveFailed",
};

/** 与笔记工具栏同一套语气：待落盘 = warning、已落盘 = success、进行中 = 中性、失败 = danger。 */
const TONE_CLASS: Record<TaskSaveView, string> = {
  unsaved: "text-warning",
  saving: "text-text-secondary",
  saved: "text-success",
  failed: "text-danger",
};

interface TaskSaveStatusProps {
  dirty: boolean;
  status: SaveStatus;
  error: string | null;
  onRetry: () => void;
  className?: string;
}

/**
 * 保存状态区：自动保存体系里唯一「看得见」的落地信号。
 * 失败时原因与重试入口一并给在卡片内，不再依赖一次性 toast。
 */
export function TaskSaveStatus({ dirty, status, error, onRetry, className = "" }: TaskSaveStatusProps) {
  const { t } = useTranslation();
  const view = taskSaveView(dirty, status);
  return (
    <span className={`inline-flex min-w-0 items-center gap-1 text-[11px] leading-4 ${TONE_CLASS[view]} ${className}`}>
      <SaveIcon view={view} />
      <span role="status" aria-live="polite" className="truncate" title={view === "failed" && error ? error : undefined}>
        {t(LABEL_KEY[view])}
      </span>
      {view === "failed" ? (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 underline underline-offset-2 transition-colors hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {t("todo.retrySave")}
        </button>
      ) : null}
    </span>
  );
}

function SaveIcon({ view }: { view: TaskSaveView }) {
  if (view === "saving") return <Loader2 size={12} className="shrink-0 animate-spin" aria-hidden="true" />;
  if (view === "saved") return <Check size={12} className="shrink-0" aria-hidden="true" />;
  if (view === "failed") return <AlertCircle size={12} className="shrink-0" aria-hidden="true" />;
  return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />;
}

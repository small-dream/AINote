import { useTranslation } from "@/i18n";
import { saveFailureHintKey } from "../utils/saveFailure";

/** 保存状态：只在「保存中 / 有未保存修改」时显示；干净保存态静默，不渲染（内容优先）。 */
export function SaveStatus({ saving, dirty }: { saving: boolean; dirty: boolean }) {
  const { t } = useTranslation();
  if (!saving && !dirty) return null;
  const label = saving ? t("common.saving") : t("note.unsaved");
  const tone = saving ? "text-text-secondary" : "text-warning";
  return (
    <span role="status" aria-live="polite" className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs ${tone}`}>
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

/** 保存失败：失败原因 + 与错误码匹配的下一步建议（E3-T5）+ 内联重试。 */
export function SaveErrorMessage({ message, code, onRetry }: { message: string | null | undefined; code: string | null | undefined; onRetry: () => void }) {
  const { t } = useTranslation();
  if (!message) return null;
  return (
    <span role="status" className="flex max-w-72 flex-col items-end gap-0.5 text-xs text-danger">
      <span className="flex max-w-full items-center gap-2">
        <span className="truncate" title={message}>{message}</span>
        <button type="button" className="shrink-0 underline underline-offset-2 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2" onClick={onRetry}>
          {t("note.retrySave")}
        </button>
      </span>
      <span className="text-text-tertiary">{t(saveFailureHintKey(code))}</span>
    </span>
  );
}

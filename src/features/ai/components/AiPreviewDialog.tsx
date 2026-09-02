import { Button } from "@/components/atoms/Button";
import { Modal } from "@/components/molecules/Modal";
import { Loader2 } from "lucide-react";
import { useTranslation } from "@/i18n";

interface AiPreviewDialogProps {
  open: boolean;
  text: string;
  error: string | null;
  loading: boolean;
  hasSelection: boolean;
  onConfirm: () => void;
  onRetry: () => void;
  onCancel: () => void;
}

/** AI 结果预览确认：流式边生成边展示；确认后由宿主写入编辑器（P1-AI-1） */
export function AiPreviewDialog({ open, text, error, loading, hasSelection, onConfirm, onRetry, onCancel }: AiPreviewDialogProps) {
  const { t } = useTranslation();
  if (!open) return null;
  return (
    <Modal open={open} title={t("ai.preview")} onClose={onCancel}>
      <div className="flex max-h-80 min-h-40 flex-col gap-3">
        <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-border bg-bg-secondary p-3">
          {loading ? <StreamingPreview text={text} /> : error ? <p className="text-sm text-danger">{error}</p> : <PreviewText text={text} />}
        </div>
        <PreviewActions loading={loading} error={error} hasSelection={hasSelection} onConfirm={onConfirm} onRetry={onRetry} onCancel={onCancel} />
      </div>
    </Modal>
  );
}

function StreamingPreview({ text }: { text: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-center gap-2 text-sm text-text-secondary">
        <Loader2 size={15} className="animate-spin" />
        {t("ai.generating")}
      </span>
      {text ? <PreviewText text={text} /> : null}
    </div>
  );
}

function PreviewText({ text }: { text: string }) {
  return <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">{text}</pre>;
}

function PreviewActions({ loading, error, hasSelection, onConfirm, onRetry, onCancel }: { loading: boolean; error: string | null; hasSelection: boolean; onConfirm: () => void; onRetry: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  if (error) {
    return (
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>{t("common.cancel")}</Button>
        <Button onClick={onRetry}>{t("ai.retry")}</Button>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-text-tertiary">{t("ai.previewHint")}</span>
      <div className="flex shrink-0 gap-2">
        <Button variant="ghost" onClick={onCancel}>{t("common.cancel")}</Button>
        <Button onClick={onConfirm} disabled={loading}>{hasSelection ? t("ai.replace") : t("ai.insert")}</Button>
      </div>
    </div>
  );
}

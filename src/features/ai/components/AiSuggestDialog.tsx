import { Button } from "@/components/atoms/Button";
import { Modal } from "@/components/molecules/Modal";
import { Heading1, FolderTree, Loader2, CornerDownLeft } from "lucide-react";
import { useTranslation } from "@/i18n";
import type { UseAiSuggestReturn } from "../hooks/useAiSuggestTypes";

interface AiSuggestDialogProps {
  suggest: UseAiSuggestReturn;
  /** 重试当前建议（重新触发同一 kind 的生成） */
  onRetry: () => void;
}

/** 文档级 AI 建议结果（P1-AI-3）：标题候选单选应用 / 大纲预览插入 */
export function AiSuggestDialog({ suggest, onRetry }: AiSuggestDialogProps) {
  const { t } = useTranslation();
  const { kind } = suggest;
  if (!kind) return null;
  return (
    <Modal open title={kind === "title" ? t("ai.suggestTitle") : t("ai.suggestOutline")} onClose={suggest.close}>
      {kind === "title" ? <TitleSuggestBody suggest={suggest} onRetry={onRetry} /> : <OutlineSuggestBody suggest={suggest} onRetry={onRetry} />}
    </Modal>
  );
}

function TitleSuggestBody({ suggest, onRetry }: { suggest: UseAiSuggestReturn; onRetry: () => void }) {
  const { t } = useTranslation();
  if (suggest.loading) return <LoadingHint />;
  if (suggest.error) return <ErrorHint error={suggest.error} onRetry={onRetry} onClose={suggest.close} />;
  if (suggest.titles.length === 0) return <EmptyTitles onRetry={onRetry} onClose={suggest.close} />;
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-1.5 text-sm text-text-secondary">
        <Heading1 size={15} className="text-accent" />
        {t("ai.titlePickHint")}
      </p>
      <div className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
        {suggest.titles.map((title) => (
          <Button key={title} variant="ghost" className="justify-start whitespace-normal text-left" onClick={() => suggest.pickTitle(title)}>
            {title}
          </Button>
        ))}
      </div>
      <p className="text-xs text-text-tertiary">{t("ai.titleApplyHint")}</p>
    </div>
  );
}

function OutlineSuggestBody({ suggest, onRetry }: { suggest: UseAiSuggestReturn; onRetry: () => void }) {
  const { t } = useTranslation();
  if (suggest.loading) return <LoadingHint />;
  if (suggest.error) return <ErrorHint error={suggest.error} onRetry={onRetry} onClose={suggest.close} />;
  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-center gap-1.5 text-sm text-text-secondary">
        <FolderTree size={15} className="text-accent" />
        {t("ai.outlineHint")}
      </p>
      <pre className="max-h-80 min-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-border bg-bg-secondary p-3 font-sans text-sm leading-relaxed">
        {suggest.text}
      </pre>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={suggest.close}>{t("common.cancel")}</Button>
        <Button className="inline-flex items-center gap-2" onClick={suggest.insertOutline}>
          <CornerDownLeft size={14} />
          {t("ai.insertOutline")}
        </Button>
      </div>
    </div>
  );
}

function LoadingHint() {
  const { t } = useTranslation();
  return (
    <span className="flex items-center gap-2 text-sm text-text-secondary">
      <Loader2 size={15} className="animate-spin" />
      {t("ai.generating")}
    </span>
  );
}

function ErrorHint({ error, onRetry, onClose }: { error: string; onRetry: () => void; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-danger">{error}</p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
        <Button onClick={onRetry}>{t("ai.retry")}</Button>
      </div>
    </div>
  );
}

function EmptyTitles({ onRetry, onClose }: { onRetry: () => void; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-danger">{t("ai.noTitles")}</p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
        <Button onClick={onRetry}>{t("ai.retry")}</Button>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Image, Link, X } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { useTranslation } from "@/i18n";
import type { SharedCapture } from "@/api/types";
import { useToastStore } from "@/stores/toast.store";

interface CaptureDialogProps {
  open: boolean;
  hasRepo: boolean;
  text: string;
  tags: string;
  link: string;
  share: SharedCapture | null;
  saving: boolean;
  error: string | null;
  onChangeText: (value: string) => void;
  onChangeTags: (value: string) => void;
  onChangeLink: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
  onBindRepo: () => void;
}

/** 快速捕捉确认框：正文首行即标题，Ctrl/Cmd+Enter 保存，Esc 关闭。 */
export function CaptureDialog(props: CaptureDialogProps) {
  const { t } = useTranslation();
  const { open, hasRepo, text, tags, link, share, saving, error, onChangeText, onChangeTags, onChangeLink, onSave, onClose, onBindRepo } = props;
  const [readingClipboard, setReadingClipboard] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); onSave(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, onSave]);
  if (!open) return null;
  const readClipboard = async () => {
    setReadingClipboard(true);
    try {
      const value = (await navigator.clipboard.readText()).trim();
      if (/^https?:\/\//i.test(value)) onChangeLink(value);
      else useToastStore.getState().push(t("capture.clipboardNoUrl"), "info");
    } catch {
      useToastStore.getState().push(t("capture.clipboardDenied"), "error");
    } finally {
      setReadingClipboard(false);
    }
  };
  const title = text.split("\n").find((line) => line.trim())?.trim() ?? t("capture.untitled");
  return (
    <div className="fixed inset-0 z-[85] flex items-start justify-center bg-black/45 px-4 pt-[12vh]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={t("capture.title")} className="w-full max-w-xl overflow-hidden rounded-xl border border-border bg-bg-primary shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div><h2 className="text-sm font-semibold">{t("capture.title")}</h2><p className="truncate text-[11px] text-text-tertiary">{title}</p></div>
          <button type="button" aria-label={t("common.close")} onClick={onClose} className="rounded p-1 text-text-tertiary hover:bg-bg-tertiary hover:text-text-primary"><X size={16} /></button>
        </div>
        <div className="space-y-3 p-4">
          {hasRepo ? null : (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
              <span>{t("capture.noRepo")}</span>
              <Button className="shrink-0" onClick={onBindRepo}>{t("capture.bindRepo")}</Button>
            </div>
          )}
          {share?.imageName ? <p className="flex items-center gap-1.5 rounded-md bg-bg-secondary px-2 py-1 text-xs text-text-secondary"><Image size={13} /> {t("capture.imageReady", { name: share.imageName })}</p> : null}
          <textarea autoFocus value={text} onChange={(event) => onChangeText(event.target.value)} placeholder={t("capture.placeholder")} rows={7} className="w-full resize-y rounded-md border border-border bg-bg-primary p-3 text-sm leading-relaxed outline-none focus:border-accent" />
          <input value={tags} onChange={(event) => onChangeTags(event.target.value)} placeholder={t("capture.tagsPlaceholder")} className="w-full rounded-md border border-border bg-bg-primary px-3 py-2 text-sm outline-none focus:border-accent" />
          <div className="flex gap-2">
            <input value={link} onChange={(event) => onChangeLink(event.target.value)} placeholder={t("capture.linkPlaceholder")} className="min-w-0 flex-1 rounded-md border border-border bg-bg-primary px-3 py-2 text-sm outline-none focus:border-accent" />
            <Button variant="ghost" className="shrink-0 border border-border" disabled={readingClipboard} onClick={() => void readClipboard()}><Link size={13} /> {t("capture.readClipboard")}</Button>
          </div>
          {error ? <p className="text-xs text-danger">{error}</p> : null}
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-[11px] text-text-tertiary">{t("capture.saveHint")}</span>
            <span className="flex gap-2"><Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button><Button disabled={!hasRepo || saving} onClick={onSave}>{saving ? t("common.saving") : t("capture.save")}</Button></span>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useId, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, RotateCcw, WrapText } from "lucide-react";
import { useTranslation } from "@/i18n";
import { useCodeBlockPresentation } from "../hooks/useCodeBlockPresentation";
import { useCodeCopy } from "../hooks/useCodeCopy";
import { CodeScrollbar } from "./CodeScrollbar";

export interface CodeBlockControlsProps {
  pre: HTMLPreElement;
  scrollHost: HTMLElement;
  getSource: () => string;
  onLayoutChange?: (() => void) | undefined;
}

/** React 预览和两个编辑器适配器共用的操作区，内容 DOM 始终由宿主管理。 */
export function CodeBlockControls({ pre, scrollHost, getSource, onLayoutChange }: CodeBlockControlsProps) {
  const { t } = useTranslation();
  const id = useId();
  const presentation = useCodeBlockPresentation(pre, onLayoutChange);
  const { status, copy } = useCodeCopy(getSource);
  useLayoutEffect(() => {
    if (!pre.id) pre.setAttribute("id", id);
  }, [pre, id]);
  const copyLabel = status === "failed" ? t("note.copyCodeFailed") : t("note.copyCode");
  const wrapLabel = t(presentation.wrapped ? "note.unwrapCode" : "note.wrapCode");
  const CopyIcon = status === "copied" ? Check : status === "failed" ? RotateCcw : Copy;
  return (
    <>
      <div className="note-code-actions" data-code-control="">
        <button type="button" className="note-code-action cm-sr-code-copy" onClick={() => void copy()}
          aria-label={copyLabel} title={copyLabel}><CopyIcon size={15} aria-hidden="true" /></button>
        {presentation.visible || presentation.wrapped ? (
          <button type="button" className="note-code-action" onClick={presentation.toggleWrap}
            aria-label={wrapLabel} title={wrapLabel} aria-pressed={presentation.wrapped}>
            <WrapText size={15} aria-hidden="true" />
          </button>
        ) : null}
        <span className="note-code-status" role="status" aria-live="polite">
          {status === "copied" ? t("note.copied") : status === "failed" ? t("note.copyCodeFailed") : ""}
        </span>
      </div>
      {presentation.visible && !presentation.wrapped ? createPortal(
        <CodeScrollbar {...presentation} preId={pre.id || id} label={t("note.codeBlock")} />, scrollHost,
      ) : null}
    </>
  );
}

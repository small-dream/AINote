import { useMemo } from "react";
import { Check, ChevronDown, Copy, RotateCcw, WrapText } from "lucide-react";
import { useTranslation } from "@/i18n";
import { CODE_LANGUAGES } from "../utils/codeLanguages";
import { useCodeCopy } from "../hooks/useCodeCopy";

export interface CodeBlockToolbarProps {
  language: string;
  source: string;
  toggleKind: "expand" | "collapse";
  onLanguageChange: (language: string) => void;
  onToggle: () => void;
  wrap?: { wrapped: boolean; onToggle: () => void } | undefined;
}

/** 软渲染代码块顶栏：折叠入口、语言选择、复制与可选自动换行。 */
export function CodeBlockToolbar({ language, source, toggleKind, onLanguageChange, onToggle, wrap }: CodeBlockToolbarProps) {
  const { t } = useTranslation();
  const { status, copy } = useCodeCopy(() => source);
  const languages = useMemo(() => {
    if (!language || CODE_LANGUAGES.some((item) => item.id === language)) return CODE_LANGUAGES;
    return [...CODE_LANGUAGES, { id: language, label: language }];
  }, [language]);
  const toggleLabel = toggleKind === "expand" ? t("note.expandCode") : t("note.collapseCode");
  const copyLabel = status === "failed" ? t("note.copyCodeFailed") : t("note.copyCode");
  const CopyIcon = status === "copied" ? Check : status === "failed" ? RotateCcw : Copy;
  return (
    <div
      className="cm-sr-codeblock-toolbar"
      data-code-control=""
      onMouseDown={(event) => {
        if (event.target instanceof Element && event.target.closest("button")) event.preventDefault();
        event.stopPropagation();
      }}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <button type="button" className="cm-sr-codeblock-toggle" aria-label={toggleLabel} title={toggleLabel} onClick={onToggle}>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      <label className="cm-sr-codeblock-language">
        <span className="sr-only">{t("richtext.codeLanguage")}</span>
        <select value={language} aria-label={t("richtext.codeLanguage")}
          onChange={(event) => onLanguageChange(event.target.value)}>
          <option value="">{t("richtext.autoDetect")}</option>
          {languages.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>
      <div className="note-code-actions cm-sr-codeblock-actions">
        {wrap ? (
          <button type="button" className="note-code-action" onClick={wrap.onToggle}
            aria-label={t(wrap.wrapped ? "note.unwrapCode" : "note.wrapCode")}
            title={t(wrap.wrapped ? "note.unwrapCode" : "note.wrapCode")} aria-pressed={wrap.wrapped}>
            <WrapText size={15} aria-hidden="true" />
          </button>
        ) : null}
        <button type="button" className="note-code-action cm-sr-code-copy" onClick={() => void copy()}
          aria-label={copyLabel} title={copyLabel}>
          <CopyIcon size={15} aria-hidden="true" />
        </button>
        <span className="note-code-status" role="status" aria-live="polite">
          {status === "copied" ? t("note.copied") : status === "failed" ? t("note.copyCodeFailed") : ""}
        </span>
      </div>
    </div>
  );
}

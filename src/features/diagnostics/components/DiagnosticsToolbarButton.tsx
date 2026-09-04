import { useEffect, useRef, type RefObject } from "react";
import { AlertCircle, CircleAlert, TriangleAlert } from "lucide-react";
import { useTranslation } from "@/i18n";
import type { DiagnosticIssue } from "../utils/diagnostics";

interface DiagnosticsToolbarButtonProps {
  issues: DiagnosticIssue[];
  open: boolean;
  onToggle: () => void;
  onSelect: (issue: DiagnosticIssue) => void;
}

/** 格式工具栏中的 Markdown 诊断入口：显示问题数徽标，点击展开问题列表。 */
export function DiagnosticsToolbarButton({ issues, open, onToggle, onSelect }: DiagnosticsToolbarButtonProps) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement | null>(null);
  useCloseOnOutside(rootRef, open, onToggle);

  return (
    <div ref={rootRef} className="diagnostics-toolbar relative">
      <button
        type="button"
        aria-label={t("note.diagnostics")}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={t("note.diagnostics")}
        className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors duration-120 ${open ? "bg-accent-soft text-accent" : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"}`}
        onClick={onToggle}
      >
        <CircleAlert size={16} aria-hidden="true" />
        {issues.length > 0 ? <span className="diagnostics-count">{issues.length}</span> : null}
      </button>
      {open ? (
        <div className="diagnostics-toolbar-panel" role="dialog" aria-label={t("note.diagnostics")}>
          <DiagnosticsList issues={issues} onSelect={onSelect} />
        </div>
      ) : null}
    </div>
  );
}

function useCloseOnOutside(ref: RefObject<HTMLDivElement | null>, active: boolean, close: () => void): void {
  useEffect(() => {
    if (!active) return undefined;
    const handlePointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) close();
    };
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleKeydown);
    };
  }, [active, close, ref]);
}

function DiagnosticsList({ issues, onSelect }: { issues: DiagnosticIssue[]; onSelect: (issue: DiagnosticIssue) => void }) {
  const { t } = useTranslation();
  if (issues.length === 0) {
    return <p className="px-3 py-2 text-xs text-text-secondary">{t("note.diagnosticsClean")}</p>;
  }
  return (
    <ul className="diagnostics-list">
      {issues.map((issue, index) => (
        <li key={`${issue.line}-${issue.code}-${index}`}>
          <button type="button" onClick={() => onSelect(issue)} className="diagnostics-item">
            <IssueIcon severity={issue.severity} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs text-text-primary">{issue.message}</span>
              <span className="block text-[11px] text-text-tertiary">L{issue.line}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function IssueIcon({ severity }: { severity: DiagnosticIssue["severity"] }) {
  const cls = severity === "error" ? "text-danger" : "text-warning";
  return severity === "error" ? <AlertCircle size={13} className={cls} /> : <TriangleAlert size={13} className={cls} />;
}

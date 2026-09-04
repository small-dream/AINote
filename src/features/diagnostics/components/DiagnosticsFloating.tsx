import { useEffect, useRef } from "react";
import { AlertCircle, CircleAlert, TriangleAlert } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { useTranslation } from "@/i18n";
import type { DiagnosticIssue } from "../utils/diagnostics";

interface DiagnosticsFloatingProps {
  issues: DiagnosticIssue[];
  open: boolean;
  onToggle: () => void;
  onSelect: (issue: DiagnosticIssue) => void;
}

/** 编辑区悬浮的 Markdown 诊断入口：显示问题数徽标，点击展开问题列表。 */
export function DiagnosticsFloating({ issues, open, onToggle, onSelect }: DiagnosticsFloatingProps) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return undefined;
    const handlePointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || !rootRef.current?.contains(target)) onToggle();
    };
    document.addEventListener("pointerdown", handlePointer);
    return () => document.removeEventListener("pointerdown", handlePointer);
  }, [open, onToggle]);

  return (
    <div ref={rootRef} className="note-outline-floating diagnostics-floating">
      <Button
        variant="ghost"
        type="button"
        aria-label={t("note.diagnostics")}
        aria-expanded={open}
        title={t("note.diagnostics")}
        className={`note-outline-floating-trigger diagnostics-trigger ${open ? "is-open" : ""}`}
        onClick={onToggle}
      >
        <CircleAlert size={16} aria-hidden="true" />
        {issues.length > 0 ? <span className="diagnostics-count">{issues.length}</span> : null}
      </Button>
      {open ? (
        <div className="note-outline-floating-panel is-visible diagnostics-panel" role="dialog" aria-label={t("note.diagnostics")}>
          <DiagnosticsList issues={issues} onSelect={onSelect} />
        </div>
      ) : null}
    </div>
  );
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

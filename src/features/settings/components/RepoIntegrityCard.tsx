import { CircleAlert, Info, RefreshCw, ShieldCheck, TriangleAlert, type LucideIcon } from "lucide-react";
import type { IntegrityIssue, IntegrityReport, IntegritySeverity } from "@/api";
import { Button } from "@/components/atoms/Button";
import { useTranslation } from "@/i18n";
import type { TranslationKey } from "@/i18n/messages";
import { useRepoIntegrity } from "../hooks/useRepoIntegrity";

const SEVERITY_META: Record<IntegritySeverity, { icon: LucideIcon; labelKey: TranslationKey; tone: string }> = {
  error: { icon: CircleAlert, labelKey: "repo.integritySeverityError", tone: "border-red-500/40 bg-red-500/5" },
  warning: { icon: TriangleAlert, labelKey: "repo.integritySeverityWarning", tone: "border-amber-500/40 bg-amber-500/5" },
  info: { icon: Info, labelKey: "repo.integritySeverityInfo", tone: "border-border bg-bg-tertiary" },
};

/** 设置页仓库管理：只读检查 Git 对象、索引、远端与磁盘权限。 */
export function RepoIntegrityCard() {
  const { t } = useTranslation();
  const check = useRepoIntegrity();

  return (
    <section className="rounded-md border border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs text-text-tertiary">
            <ShieldCheck size={13} />
            {t("repo.integrity")}
          </p>
          <p className="mt-0.5 text-xs text-text-secondary">{t("repo.integrityDescription")}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="inline-flex shrink-0 items-center gap-1.5 border border-border text-xs"
          disabled={check.isPending}
          onClick={() => check.mutate()}
        >
          <RefreshCw size={13} className={check.isPending ? "animate-spin" : ""} />
          {check.isPending ? t("repo.integrityChecking") : t("repo.integrityCheck")}
        </Button>
      </div>
      <div className="mt-3" role="status" aria-live="polite">
        <IntegrityResult
          report={check.data}
          pending={check.isPending}
          failed={check.isError}
          onRetry={() => check.mutate()}
        />
      </div>
    </section>
  );
}

interface IntegrityResultProps {
  report: IntegrityReport | undefined;
  pending: boolean;
  failed: boolean;
  onRetry: () => void;
}

function IntegrityResult({ report, pending, failed, onRetry }: IntegrityResultProps) {
  const { t } = useTranslation();
  if (pending) return <p className="text-xs text-text-secondary">{t("repo.integrityChecking")}</p>;
  if (failed) {
    return (
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-text-secondary">{t("repo.integrityFailed")}</p>
        <Button variant="ghost" onClick={onRetry}>{t("common.retry")}</Button>
      </div>
    );
  }
  if (!report) return null;
  if (report.issues.length === 0) {
    return <p className="text-xs text-text-secondary">{t("repo.integrityHealthy")}</p>;
  }
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-text-primary">
        {t(report.ok ? "repo.integrityWarningsOnly" : "repo.integrityIssues", { count: report.issues.length })}
      </p>
      <ul className="space-y-2">
        {report.issues.map((issue) => (
          <IssueRow key={`${issue.code}-${issue.message}`} issue={issue} />
        ))}
      </ul>
    </div>
  );
}

function IssueRow({ issue }: { issue: IntegrityIssue }) {
  const { t } = useTranslation();
  const meta = SEVERITY_META[issue.severity];
  const Icon = meta.icon;
  return (
    <li className={`rounded-md border px-3 py-2 ${meta.tone}`}>
      <p className="flex items-center gap-1.5 text-xs font-medium text-text-primary">
        <Icon size={13} />
        {t(meta.labelKey)} · {issue.code}
      </p>
      <p className="mt-1 text-xs text-text-secondary">{issue.message}</p>
      <p className="mt-1 text-xs text-text-tertiary">{t("repo.integrityFix", { hint: issue.fixHint })}</p>
    </li>
  );
}

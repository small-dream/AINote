import { useState, type ReactNode } from "react";
import { type UseQueryResult } from "@tanstack/react-query";
import { Copy, ExternalLink, ShieldCheck, Trash2 } from "lucide-react";
import { openExternal, type SupportInfoDto } from "@/api";
import { Button } from "@/components/atoms/Button";
import { useTranslation } from "@/i18n";
import { ExportDiagnosticsButton } from "@/features/support/components/ExportDiagnosticsButton";
import { useClearLogs, useSetLoggingEnabled, useSupportInfo } from "../hooks/useSupportInfo";
import { formatRepoSize } from "../utils/repoSize";
import { AiToggle } from "./AiField";
import { MetricsCard } from "./MetricsCard";

const PRIVACY_URL = "https://github.com/small-dream/AINote/blob/main/docs/PRIVACY.md";

/** 设置页「诊断与反馈」：日志开关、日志目录、清理、导出诊断包与隐私说明。 */
export function SupportSettings() {
  const { t } = useTranslation();
  const info = useSupportInfo();
  const setLogging = useSetLoggingEnabled();
  const clearLogs = useClearLogs();
  const [status, setStatus] = useState("");

  function toggleLogging(enabled: boolean): void {
    setLogging.mutate(enabled, {
      onSuccess: () => setStatus(enabled ? t("support.loggingOn") : t("support.loggingOff")),
      onError: () => setStatus(t("support.loggingFailed")),
    });
  }

  function runClear(): void {
    if (!window.confirm(t("support.clearLogsConfirm"))) return;
    clearLogs.mutate(undefined, {
      onSuccess: (freed) => setStatus(t("support.clearedLogs", { size: formatRepoSize(freed) })),
      onError: () => setStatus(t("support.clearLogsFailed")),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <p role="status" aria-live="polite" className="min-h-4 text-xs text-text-secondary">
        {status}
      </p>
      <LoggingCard
        info={info}
        loggingBusy={setLogging.isPending}
        clearing={clearLogs.isPending}
        onToggle={toggleLogging}
        onClear={runClear}
        onStatus={setStatus}
      />
      <PrivacyCard />
      <MetricsCard onStatus={setStatus} />
    </div>
  );
}

interface LoggingCardProps {
  info: UseQueryResult<SupportInfoDto>;
  loggingBusy: boolean;
  clearing: boolean;
  onToggle: (enabled: boolean) => void;
  onClear: () => void;
  onStatus: (message: string) => void;
}

function LoggingCard({ info, loggingBusy, clearing, onToggle, onClear, onStatus }: LoggingCardProps) {
  const { t } = useTranslation();

  return (
    <section className="rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-text-primary">{t("support.logging")}</h3>
          <p className="mt-1 text-xs text-text-secondary">{t("support.loggingDescription")}</p>
        </div>
        <AiToggle checked={info.data?.loggingEnabled ?? true} label={t("support.loggingToggle")} onChange={onToggle} />
      </div>
      <LogInfo info={info} onStatus={onStatus} />

      <div className="mt-4 flex flex-wrap gap-2">
        <ExportDiagnosticsButton />
        <Button
          variant="ghost"
          className="inline-flex items-center gap-1.5"
          disabled={clearing || loggingBusy}
          onClick={onClear}
        >
          <Trash2 size={14} />
          {clearing ? t("support.clearingLogs") : t("support.clearLogs")}
        </Button>
      </div>
    </section>
  );
}

function LogInfo({ info, onStatus }: { info: UseQueryResult<SupportInfoDto>; onStatus: (message: string) => void }) {
  const { t } = useTranslation();
  const data = info.data;

  async function copyDir(): Promise<void> {
    if (!data?.logDir) return;
    try {
      await navigator.clipboard.writeText(data.logDir);
      onStatus(t("support.copyDirDone"));
    } catch {
      onStatus(t("support.copyDirFailed"));
    }
  }

  if (info.isError) {
    return (
      <div className="mt-4 flex items-center justify-between gap-3 rounded-md bg-bg-tertiary px-3 py-2">
        <span className="text-xs text-text-secondary">{t("support.infoFailed")}</span>
        <Button variant="ghost" onClick={() => void info.refetch()}>{t("common.retry")}</Button>
      </div>
    );
  }

  return (
    <dl className="mt-4 space-y-2">
      <InfoRow label={t("support.logDir")}>
        <code className="min-w-0 flex-1 truncate font-mono text-xs text-text-secondary" title={data?.logDir}>
          {info.isLoading ? t("common.loading") : data?.logDir || "—"}
        </code>
        <IconButton label={t("support.copyLogDir")} disabled={!data?.logDir} onClick={() => void copyDir()}>
          <Copy size={13} />
        </IconButton>
      </InfoRow>
      <InfoRow label={t("support.logSize")}>
        <span className="text-xs text-text-secondary">
          {info.isLoading ? t("common.loading") : formatRepoSize(data?.logBytes ?? 0)}
        </span>
      </InfoRow>
    </dl>
  );
}

function PrivacyCard() {
  const { t } = useTranslation();
  return (
    <section className="rounded-lg border border-border p-4">
      <div className="flex items-start gap-3">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-accent" />
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-text-primary">{t("support.privacy")}</h3>
          <p className="mt-1 text-xs text-text-secondary">{t("support.privacyDescription")}</p>
          <button
            type="button"
            onClick={() => void openExternal(PRIVACY_URL)}
            className="mt-2 inline-flex items-center gap-1 text-xs text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {t("support.openPrivacy")}
            <ExternalLink size={12} />
          </button>
        </div>
      </div>
    </section>
  );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <dt className="w-20 shrink-0 text-xs text-text-tertiary">{label}</dt>
      <dd className="flex min-w-0 flex-1 items-center gap-1.5">{children}</dd>
    </div>
  );
}

function IconButton({ label, disabled, onClick, children }: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-primary disabled:opacity-40"
    >
      {children}
    </button>
  );
}

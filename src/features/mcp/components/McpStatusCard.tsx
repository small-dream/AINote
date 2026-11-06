import type { McpStatus } from "@/api";
import { useTranslation } from "@/i18n";
import { McpToggle } from "./McpToggle";

interface McpStatusCardProps {
  status: McpStatus;
  busy: boolean;
  onToggle: (enabled: boolean) => void;
}

/** 服务总览：开关、运行状态与最近一次启动错误。 */
export function McpStatusCard({ status, busy, onToggle }: McpStatusCardProps) {
  const { t } = useTranslation();
  const stateLabel = status.running
    ? t("mcp.running")
    : status.enabled
      ? t("mcp.startFailed")
      : t("mcp.stopped");
  return (
    <section className="rounded-xl border border-border bg-bg-secondary/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-text-primary">{t("mcp.title")}</h3>
          <p className="mt-0.5 text-xs text-text-secondary">
            <span className={status.running ? "text-accent" : "text-text-secondary"}>{stateLabel}</span>
            {status.hasToken ? ` · ${t("mcp.tokenPresent")}` : ` · ${t("mcp.tokenMissing")}`}
          </p>
        </div>
        <McpToggle checked={status.enabled} disabled={busy} onChange={onToggle} />
      </div>
      {status.lastError ? (
        <p className="mt-2 rounded-md bg-bg-tertiary px-2 py-1.5 text-xs text-danger" role="alert">
          {status.lastError}
        </p>
      ) : null}
    </section>
  );
}

import { useState } from "react";
import { messageOf } from "@/api";
import type { McpIntegration, McpStatus } from "@/api";
import { Button } from "@/components/atoms/Button";
import { useTranslation } from "@/i18n";
import { useToastStore } from "@/stores/toast.store";
import { useMcpSettings } from "../hooks/useMcpSettings";

interface McpIntegrationsCardProps {
  status: McpStatus;
}

/** 一键写入常见客户端配置：只改 ainote 条目，Token 由 Rust 直接写入。 */
export function McpIntegrationsCard({ status }: McpIntegrationsCardProps) {
  const { t } = useTranslation();
  const { installIntegration, removeIntegration, installDetected } = useMcpSettings();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = installIntegration.isPending || removeIntegration.isPending || installDetected.isPending;
  const detected = status.integrations.filter((item) => item.detected).length;
  const canInstallAny = status.running
    && status.integrations.some((item) => item.detected && !item.configured);

  async function run(key: string, action: () => Promise<{ warnings?: string[] }>, success: string) {
    setPending(key);
    setError(null);
    try {
      const result = await action();
      if (result.warnings?.length) {
        setError(t("mcp.integrationWarnings", { message: result.warnings.join("; ") }));
      } else {
        useToastStore.getState().push(success, "success");
      }
    } catch (value) {
      setError(messageOf(value));
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-bg-secondary/60 p-3">
      <IntegrationsHeader
        detected={detected}
        canInstallAny={canInstallAny}
        busy={busy}
        onInstallAll={() => void run("all", () => installDetected.mutateAsync(), t("mcp.integrationInstallAll"))}
      />
      {!status.running ? <p className="text-xs text-danger">{t("mcp.integrationNoRunning")}</p> : null}
      {error ? <p className="text-xs text-danger" role="alert">{error}</p> : null}
      <ul className="flex flex-col gap-2">
        {status.integrations.map((item) => (
          <McpIntegrationRow
            key={item.id}
            item={item}
            running={status.running}
            busy={busy}
            pending={pending}
            onInstall={() => void run(item.id, () => installIntegration.mutateAsync(item.id), t("mcp.integrationInstalled", { name: item.name }))}
            onRemove={() => void run(item.id, () => removeIntegration.mutateAsync(item.id), t("mcp.integrationRemoved", { name: item.name }))}
          />
        ))}
      </ul>
      <p className="text-xs leading-5 text-text-secondary">{t("mcp.integrationTokenWarning")}</p>
    </section>
  );
}

function IntegrationsHeader({
  detected,
  canInstallAny,
  busy,
  onInstallAll,
}: {
  detected: number;
  canInstallAny: boolean;
  busy: boolean;
  onInstallAll: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-text-primary">{t("mcp.integrations")}</h3>
        <p className="mt-0.5 text-xs text-text-secondary">{t("mcp.integrationDetectedCount", { count: detected })}</p>
        <p className="mt-1 text-xs text-text-secondary">{t("mcp.integrationsHint")}</p>
      </div>
      <Button variant="ghost" className="shrink-0 border border-border" disabled={busy || !canInstallAny} onClick={onInstallAll}>
        {t("mcp.integrationInstallAll")}
      </Button>
    </div>
  );
}

interface McpIntegrationRowProps {
  item: McpIntegration;
  running: boolean;
  busy: boolean;
  pending: string | null;
  onInstall: () => void;
  onRemove: () => void;
}

function McpIntegrationRow({ item, running, busy, pending, onInstall, onRemove }: McpIntegrationRowProps) {
  const { t } = useTranslation();
  const disabled = !running || busy;
  const stateLabel = item.configured
    ? t("mcp.integrationConfigured")
    : item.detected
      ? t("mcp.integrationDetected")
      : t("mcp.integrationNotDetected");
  const stateClass = item.configured ? "bg-accent-soft text-accent" : "bg-bg-tertiary text-text-secondary";
  return (
    <li className="flex items-start justify-between gap-3 rounded-lg border border-border bg-bg-primary/40 p-2">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-text-primary">{item.name}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs ${stateClass}`}>{stateLabel}</span>
        </div>
        <p className="mt-0.5 truncate text-xs text-text-secondary" title={item.configPath}>
          {t("mcp.integrationPath")}: {item.configPath}
        </p>
        {item.error ? <p className="mt-0.5 text-xs text-danger">{item.error}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" className="border border-border" disabled={disabled} onClick={onInstall}>
          {pending === item.id ? t("common.saving") : item.configured ? t("mcp.integrationUpdate") : t("mcp.integrationInstall")}
        </Button>
        {item.configured ? (
          <Button variant="ghost" className="border border-border" disabled={disabled} onClick={onRemove}>
            {t("mcp.integrationRemove")}
          </Button>
        ) : null}
      </div>
    </li>
  );
}

import { useState } from "react";
import { messageOf } from "@/api";
import type { McpStatus } from "@/api";
import { useTranslation } from "@/i18n";
import { useToastStore } from "@/stores/toast.store";
import { useMcpSettings } from "../hooks/useMcpSettings";
import { McpConnectionCard } from "./McpConnectionCard";
import { McpIntegrationsCard } from "./McpIntegrationsCard";
import { McpStatusCard } from "./McpStatusCard";
import { McpTokenDialog } from "./McpTokenDialog";
import { McpToolsCard } from "./McpToolsCard";

interface IssuedToken {
  token: string;
  config: string | null;
}

/** 设置页「MCP 集成」内容区：启停、连接信息、工具清单与安全说明。 */
export function McpSettings() {
  const { t } = useTranslation();
  const { status, setEnabled, setPort, rotateToken } = useMcpSettings();
  const [issued, setIssued] = useState<IssuedToken | null>(null);
  const busy = setEnabled.isPending || setPort.isPending || rotateToken.isPending;
  const error = [status.error, setEnabled.error, setPort.error, rotateToken.error].map((value) => (value ? messageOf(value) : null)).find((value) => value !== null) ?? null;

  function reportWarnings(warnings?: string[]) {
    if (warnings?.length) useToastStore.getState().push(t("mcp.integrationWarnings", { message: warnings.join("; ") }), "error");
  }

  async function toggle(enabled: boolean) {
    try {
      const port = status.data?.port;
      const action = await setEnabled.mutateAsync(
        enabled && port !== undefined ? { enabled, port } : { enabled },
      );
      reportWarnings(action.warnings);
      if (action.issuedToken) setIssued({ token: action.issuedToken, config: action.clientConfig });
    } catch {
      // 错误由 mutation.error 统一展示。
    }
  }

  async function rotate() {
    if (!globalThis.confirm(t("mcp.rotateConfirm"))) return;
    try {
      const action = await rotateToken.mutateAsync();
      reportWarnings(action.warnings);
      if (action.issuedToken) setIssued({ token: action.issuedToken, config: action.clientConfig });
    } catch {
      // 错误由 mutation.error 统一展示。
    }
  }

  async function applyPort(port: number) {
    try {
      const action = await setPort.mutateAsync(port);
      reportWarnings(action.warnings);
    } catch {
      // 错误由 mutation.error 统一展示。
    }
  }

  if (status.isError) {
    return (
      <p className="rounded-md bg-bg-tertiary px-2 py-1.5 text-xs text-danger" role="alert">
        {messageOf(status.error)}
      </p>
    );
  }
  if (status.isLoading || !status.data) {
    return <p className="text-sm text-text-secondary">{t("common.loading")}</p>;
  }

  return (
    <McpSettingsView
      status={status.data}
      error={error}
      busy={busy}
      issued={issued}
      onToggle={(enabled) => void toggle(enabled)}
      onRotate={() => void rotate()}
      onApplyPort={(port) => void applyPort(port)}
      onCloseDialog={() => setIssued(null)}
    />
  );
}

interface McpSettingsViewProps {
  status: McpStatus;
  error: string | null;
  busy: boolean;
  issued: IssuedToken | null;
  onToggle: (enabled: boolean) => void;
  onRotate: () => void;
  onApplyPort: (port: number) => void;
  onCloseDialog: () => void;
}

function McpSettingsView({
  status,
  error,
  busy,
  issued,
  onToggle,
  onRotate,
  onApplyPort,
  onCloseDialog,
}: McpSettingsViewProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3">
      <McpStatusCard status={status} busy={busy} onToggle={onToggle} />
      {error ? (
        <p className="rounded-md bg-bg-tertiary px-2 py-1.5 text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <McpConnectionCard
        key={status.port}
        status={status}
        busy={busy}
        onApplyPort={onApplyPort}
        onRotate={onRotate}
      />
      <McpIntegrationsCard status={status} />
      <McpToolsCard tools={status.tools} />
      <div className="rounded-xl border border-border bg-bg-secondary/60 p-3">
        <p className="text-xs leading-5 text-text-secondary">{t("mcp.securityNote")}</p>
        <p className="mt-1 text-xs leading-5 text-text-secondary">{t("mcp.activeRepoHint")}</p>
      </div>
      <McpTokenDialog
        token={issued?.token ?? null}
        clientConfig={issued?.config ?? null}
        onClose={onCloseDialog}
      />
    </div>
  );
}

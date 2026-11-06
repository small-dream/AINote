import { useState } from "react";
import type { McpStatus } from "@/api";
import { Button } from "@/components/atoms/Button";
import { useTranslation } from "@/i18n";

interface McpConnectionCardProps {
  status: McpStatus;
  busy: boolean;
  onApplyPort: (port: number) => void;
  onRotate: () => void;
}

const INPUT_CLASS =
  "h-9 w-full rounded-md border border-border bg-bg-primary px-3 text-sm text-text-primary transition-colors placeholder:text-text-secondary hover:border-text-tertiary focus:border-accent focus:outline-none";

/** 连接信息：URL、端口与 Token 状态；Token 明文只在生成弹窗中出现。 */
export function McpConnectionCard({ status, busy, onApplyPort, onRotate }: McpConnectionCardProps) {
  const { t } = useTranslation();
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-bg-secondary/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-text-primary">{t("mcp.connection")}</h3>
        <span className={`text-xs ${status.running ? "text-accent" : "text-text-secondary"}`}>
          {status.running ? t("mcp.running") : t("mcp.stopped")}
        </span>
      </div>
      <McpUrlField url={status.url} />
      <McpPortField busy={busy} initialPort={status.port} onApplyPort={onApplyPort} />
      <McpTokenField hasToken={status.hasToken} busy={busy} onRotate={onRotate} />
      <p className="text-xs text-text-secondary">{t("mcp.tokenHint")}</p>
      {status.hasToken ? <p className="text-xs text-text-secondary">{t("mcp.rotateHint")}</p> : null}
    </section>
  );
}

function McpUrlField({ url }: { url: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      globalThis.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-text-secondary">{t("mcp.url")}</span>
      <div className="flex min-w-0 items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md bg-bg-tertiary px-2 py-1.5 text-xs text-text-primary">
          {url}
        </code>
        <Button variant="ghost" className="shrink-0 border border-border" onClick={() => void copyUrl()}>
          {copied ? t("mcp.copied") : t("mcp.copyUrl")}
        </Button>
      </div>
    </div>
  );
}

interface McpPortFieldProps {
  initialPort: number;
  busy: boolean;
  onApplyPort: (port: number) => void;
}

function McpPortField({ initialPort, busy, onApplyPort }: McpPortFieldProps) {
  const { t } = useTranslation();
  const [portDraft, setPortDraft] = useState(String(initialPort));
  const [portError, setPortError] = useState<string | null>(null);
  function applyPort() {
    const port = Number.parseInt(portDraft, 10);
    if (!Number.isFinite(port) || port < 1024 || port > 65535) {
      setPortError(t("mcp.portRange"));
      return;
    }
    setPortError(null);
    onApplyPort(port);
  }
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-text-secondary" htmlFor="mcp-port">
        {t("mcp.port")}
      </label>
      <div className="flex items-center gap-2">
        <input
          id="mcp-port"
          className={INPUT_CLASS}
          inputMode="numeric"
          value={portDraft}
          onChange={(event) => {
            setPortDraft(event.target.value);
            setPortError(null);
          }}
        />
        <Button variant="ghost" className="shrink-0 border border-border" disabled={busy} onClick={applyPort}>
          {t("mcp.portApply")}
        </Button>
      </div>
      {portError ? <p className="text-xs text-danger">{portError}</p> : null}
    </div>
  );
}

function McpTokenField({ hasToken, busy, onRotate }: { hasToken: boolean; busy: boolean; onRotate: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <span className="text-xs font-medium text-text-secondary">{t("mcp.token")}</span>
        <p className="mt-0.5 text-xs text-text-secondary">
          {hasToken ? t("mcp.tokenPresent") : t("mcp.tokenMissing")}
        </p>
      </div>
      <Button variant="ghost" className="shrink-0 border border-border" disabled={busy} onClick={onRotate}>
        {busy ? t("mcp.rotating") : t("mcp.rotateToken")}
      </Button>
    </div>
  );
}

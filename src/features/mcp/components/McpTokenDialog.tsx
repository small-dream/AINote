import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import { Modal } from "@/components/molecules/Modal";
import { useTranslation } from "@/i18n";

interface McpTokenDialogProps {
  token: string | null;
  clientConfig: string | null;
  onClose: () => void;
}

/** 一次性 Token / 完整客户端配置；关闭后前端不再持有明文。 */
export function McpTokenDialog({ token, clientConfig, onClose }: McpTokenDialogProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState<"token" | "config" | null>(null);

  async function copy(value: string | null, kind: "token" | "config") {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      globalThis.setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied(null);
    }
  }

  return (
    <Modal open={token !== null} title={t("mcp.tokenDialogTitle")} onClose={onClose} mobileSheet={false}>
      <div className="flex flex-col gap-3">
        <p className="text-xs text-text-secondary">{t("mcp.tokenDialogHint")}</p>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-text-secondary">{t("mcp.token")}</span>
          <code className="break-all rounded-md bg-bg-tertiary px-2 py-1.5 text-xs text-text-primary">
            {token ?? ""}
          </code>
          <Button
            variant="ghost"
            className="self-start border border-border"
            onClick={() => void copy(token, "token")}
          >
            {copied === "token" ? t("mcp.copied") : t("mcp.copyToken")}
          </Button>
        </div>
        {clientConfig ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-secondary">{t("mcp.clientConfig")}</span>
            <pre className="max-h-56 overflow-auto rounded-md bg-bg-tertiary p-2 text-xs text-text-primary">
              {clientConfig}
            </pre>
            <Button
              variant="ghost"
              className="self-start border border-border"
              onClick={() => void copy(clientConfig, "config")}
            >
              {copied === "config" ? t("mcp.configCopied") : t("mcp.copyConfig")}
            </Button>
          </div>
        ) : null}
        <Button className="self-end px-4" onClick={onClose}>
          {t("common.close")}
        </Button>
      </div>
    </Modal>
  );
}

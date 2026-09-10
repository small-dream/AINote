import { useState } from "react";
import { ArrowLeft, Copy, RotateCcw } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { useTranslation } from "@/i18n";
import { formatErrorReport } from "../error-report";

interface ErrorFallbackProps {
  error: Error;
  onRetry: () => void;
}

/** 渲染崩溃后的可恢复界面：重试 / 复制诊断信息 / 返回工作区。 */
export function ErrorFallback({ error, onRetry }: ErrorFallbackProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  async function copyReport(): Promise<void> {
    try {
      await navigator.clipboard.writeText(formatErrorReport(error, "react-render"));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-bg-primary p-6">
      <div className="w-full max-w-lg rounded-lg border border-border bg-bg-secondary p-6">
        <h1 className="text-lg font-semibold text-text-primary">{t("support.crashTitle")}</h1>
        <p className="mt-2 text-sm text-text-secondary">{t("support.crashDescription")}</p>
        <pre className="mt-4 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-bg-tertiary p-3 text-xs text-text-secondary">
          {error.message}
        </pre>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button className="inline-flex items-center gap-1.5" onClick={onRetry}>
            <RotateCcw size={14} />
            {t("common.retry")}
          </Button>
          <Button
            className="inline-flex items-center gap-1.5"
            variant="ghost"
            onClick={() => void copyReport()}
          >
            <Copy size={14} />
            {copied ? t("support.copied") : t("support.copyReport")}
          </Button>
          <Button
            className="inline-flex items-center gap-1.5"
            variant="ghost"
            onClick={() => window.location.assign("/workspace")}
          >
            <ArrowLeft size={14} />
            {t("support.backToWorkspace")}
          </Button>
        </div>
      </div>
    </div>
  );
}

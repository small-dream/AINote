import { useState } from "react";
import { Download } from "lucide-react";
import { supportApi } from "@/api";
import { Button } from "@/components/atoms/Button";
import { useTranslation } from "@/i18n";

type ExportStatus = "idle" | "busy" | "done" | "error";

interface ExportDiagnosticsButtonProps {
  variant?: "primary" | "ghost";
  className?: string;
}

/** 导出诊断包到用户选择的位置；用户取消保存时不提示错误。 */
export function ExportDiagnosticsButton({
  variant = "ghost",
  className = "",
}: ExportDiagnosticsButtonProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<ExportStatus>("idle");

  async function run(): Promise<void> {
    setStatus("busy");
    try {
      const result = await supportApi.exportDiagnostics();
      setStatus(result ? "done" : "idle");
    } catch {
      setStatus("error");
    }
  }

  return (
    <Button
      className={`inline-flex items-center gap-1.5 ${className}`}
      variant={variant}
      disabled={status === "busy"}
      onClick={() => void run()}
    >
      <Download size={14} />
      {labelOf(status, t)}
    </Button>
  );
}

function labelOf(status: ExportStatus, t: ReturnType<typeof useTranslation>["t"]): string {
  switch (status) {
    case "busy":
      return t("support.exporting");
    case "done":
      return t("support.exported");
    case "error":
      return t("support.exportFailed");
    default:
      return t("support.exportDiagnostics");
  }
}

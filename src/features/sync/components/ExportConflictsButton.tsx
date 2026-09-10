import { useState } from "react";
import { FileDown } from "lucide-react";
import { syncApi } from "@/api";
import { Button } from "@/components/atoms/Button";
import { useTranslation } from "@/i18n";

type ExportStatus = "idle" | "busy" | "done" | "error";

/** 合并前的兜底：把冲突文件两侧内容导出为 zip；用户取消保存时不提示错误。 */
export function ExportConflictsButton({ className = "" }: { className?: string }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<ExportStatus>("idle");
  const [savedPath, setSavedPath] = useState<string | null>(null);

  async function run(): Promise<void> {
    setStatus("busy");
    try {
      const result = await syncApi.exportConflicts();
      setStatus(result ? "done" : "idle");
      setSavedPath(result?.path ?? null);
    } catch {
      setStatus("error");
    }
  }

  return (
    <Button
      variant="ghost"
      className={`inline-flex items-center gap-1.5 px-2 text-xs ${className}`}
      title={savedPath ?? t("sync.exportConflictsHint")}
      disabled={status === "busy"}
      onClick={() => void run()}
    >
      <FileDown size={14} />
      {labelOf(status, t)}
    </Button>
  );
}

function labelOf(status: ExportStatus, t: ReturnType<typeof useTranslation>["t"]): string {
  switch (status) {
    case "busy":
      return t("sync.exportingConflicts");
    case "done":
      return t("sync.exportedConflicts");
    case "error":
      return t("sync.exportConflictsFailed");
    default:
      return t("sync.exportConflicts");
  }
}

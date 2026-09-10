import { RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { ExportDiagnosticsButton } from "@/features/support/components/ExportDiagnosticsButton";
import { useTranslation } from "@/i18n";
import { useUiStore } from "@/stores/ui.store";
import type { SyncFailureState } from "../utils/status";

interface SyncFailureBannerProps {
  failure: SyncFailureState;
  retrying?: boolean;
  onRetry: () => void;
}

/** 失败文件列表最多展示的条数，超出部分折叠为计数（避免长列表淹没横幅） */
const MAX_VISIBLE_FILES = 5;

/**
 * 同步失败横幅（E3-T5 / E4-T4）：阶段 + 原始原因 + 下一步动作 + 可定位的失败文件，永不只显示错误码。
 * 凭证失效时主按钮换成「重新登录」，其余情况一律是「重试同步」。
 */
export function SyncFailureBanner({ failure, retrying = false, onRetry }: SyncFailureBannerProps) {
  const { t } = useTranslation();
  return (
    <div role="alert" className="flex flex-wrap items-start gap-x-3 gap-y-2 border-b border-danger/30 bg-danger/5 px-4 py-2.5">
      <TriangleAlert size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-danger" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-text-primary">
          {failure.title} · {t("sync.failedStage", { stage: failure.stage })}
        </p>
        <p className="mt-0.5 break-words text-xs text-text-secondary">{failure.reason}</p>
        <p className="mt-0.5 break-words text-xs text-text-tertiary">{failure.suggestion}</p>
        <SyncFailureFiles files={failure.files} />
      </div>
      <SyncFailureActions failure={failure} retrying={retrying} onRetry={onRetry} />
    </div>
  );
}

/** 失败文件（E4-T4）：给出可定位的仓库相对路径，便于用户直接去处理冲突或权限。 */
function SyncFailureFiles({ files }: { files: string[] }) {
  const { t } = useTranslation();
  if (files.length === 0) return null;
  const visible = files.slice(0, MAX_VISIBLE_FILES);
  const hidden = files.length - visible.length;
  return (
    <div className="mt-1">
      <p className="text-[11px] text-text-tertiary">{t("sync.failedFiles", { count: files.length })}</p>
      <ul className="mt-0.5 flex flex-wrap gap-1">
        {visible.map((file) => (
          <li
            key={file}
            title={file}
            className="max-w-full truncate rounded border border-border/70 bg-bg-secondary/60 px-1.5 py-0.5 font-mono text-[11px] text-text-secondary"
          >
            {file}
          </li>
        ))}
        {hidden > 0 && (
          <li className="px-1.5 py-0.5 text-[11px] text-text-tertiary">
            {t("sync.failedFilesMore", { count: hidden })}
          </li>
        )}
      </ul>
    </div>
  );
}

function SyncFailureActions({ failure, retrying, onRetry }: SyncFailureBannerProps) {
  const { t } = useTranslation();
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
      {failure.action === "relogin" ? (
        <Button
          variant="primary"
          className="px-3 text-xs"
          onClick={() => useUiStore.getState().openSettings("account")}
        >
          {t("sync.failedRelogin")}
        </Button>
      ) : (
        <Button
          variant="primary"
          className="inline-flex items-center gap-1.5 px-3 text-xs"
          onClick={onRetry}
          disabled={retrying}
        >
          <RefreshCw size={13} className={retrying ? "animate-spin" : ""} />
          {t("sync.failedRetry")}
        </Button>
      )}
      <ExportDiagnosticsButton className="text-xs" />
    </div>
  );
}

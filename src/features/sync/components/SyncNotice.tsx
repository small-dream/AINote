import { useTranslation } from "@/i18n";
import type { SyncController } from "../hooks/useSync";
import { deriveSyncFailure } from "../utils/status";
import { SyncFailureBanner } from "./SyncFailureBanner";
import { SyncRetryBanner } from "./SyncRetryBanner";

/**
 * 同步过程提示（桌面与移动共用）：自动重试中显示进度与取消，
 * 失败后显示阶段 / 原因 / 建议与重试、导出诊断包入口（E3-T5、E4-T2）。
 */
export function SyncNotice({ sync }: { sync: SyncController }) {
  const { locale } = useTranslation();
  if (sync.retry) return <SyncRetryBanner retry={sync.retry} onCancel={sync.cancelRetry} />;
  const failure = deriveSyncFailure(sync.syncNow.error, locale);
  if (!failure) return null;
  return <SyncFailureBanner failure={failure} retrying={sync.isSyncing} onRetry={() => sync.syncNow.mutate()} />;
}

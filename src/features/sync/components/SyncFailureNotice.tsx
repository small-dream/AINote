import { useTranslation } from "@/i18n";
import type { SyncController } from "../hooks/useSync";
import { deriveSyncFailure } from "../utils/status";
import { SyncFailureBanner } from "./SyncFailureBanner";

/** 同步失败时才出现的横幅；桌面与移动共用的收口入口（E3-T5）。 */
export function SyncFailureNotice({ sync }: { sync: SyncController }) {
  const { locale } = useTranslation();
  const failure = deriveSyncFailure(sync.syncNow.error, locale);
  if (!failure) return null;
  return <SyncFailureBanner failure={failure} retrying={sync.isSyncing} onRetry={() => sync.syncNow.mutate()} />;
}

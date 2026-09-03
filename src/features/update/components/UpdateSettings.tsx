import { useUpdate } from "../hooks/useUpdate";
import { UpdateProgressBar } from "./UpdateProgressBar";
import { UpdateReleaseCard } from "./UpdateReleaseCard";
import { UpdateStatusCard } from "./UpdateStatusCard";

/** 设置页更新内容区：展示当前状态、发布说明、下载进度和失败恢复入口。 */
export function UpdateSettings() {
  const update = useUpdate();

  return (
    <div className="space-y-4">
      <UpdateStatusCard
        phase={update.phase}
        info={update.info}
        currentVersion={update.currentVersion}
        checkedAt={update.checkedAt}
        error={update.error}
        onCheck={update.checkForUpdate}
        onInstall={update.install}
      />

      {(update.phase === "downloading" || update.phase === "preparingInstall") && (
        <section className="rounded-lg border border-border bg-bg-primary p-4">
          <UpdateProgressBar progress={update.progress} />
        </section>
      )}

      {update.info && <UpdateReleaseCard info={update.info} />}
    </div>
  );
}

import { recordMetric, updateApi } from "@/api";
import type { UpdateInfo, UpdateInstallEvent } from "@/api/update.api";
import { translate } from "@/i18n";
import { useUiStore } from "@/stores/ui.store";
import { useDesktopUpdateStore } from "../stores/desktop-update.store";

/** 检查更新并写入共享 store；返回远端版本信息（无新版本时为 null）。 */
export async function checkForDesktopUpdate(): Promise<UpdateInfo | null> {
  const store = useDesktopUpdateStore.getState();
  store.report({ phase: "checking", error: null, installError: null });
  recordMetric("update_checked");

  try {
    const info = await updateApi.checkForUpdate();
    const currentVersion = info?.currentVersion ?? store.currentVersion;
    if (info) {
      store.report({
        phase: "readyToInstall",
        info,
        currentVersion,
        checkedAt: new Date(),
        error: null,
        installError: null,
      });
    } else {
      store.report({
        phase: "upToDate",
        info: null,
        currentVersion,
        checkedAt: new Date(),
        error: null,
        installError: null,
      });
    }
    return info;
  } catch {
    store.report({
      phase: "error",
      error: translate(useUiStore.getState().locale, "update.checkFailed"),
      installError: null,
    });
    return null;
  }
}

/** 下载、校验并安装更新；进度写入共享 store，安装失败以 installError 标记（弹窗重试入口）。 */
export async function installDesktopUpdate(): Promise<void> {
  const store = useDesktopUpdateStore.getState();
  store.report({ phase: "downloading", error: null, installError: null, progress: null });

  try {
    await updateApi.installUpdate((event) => reportInstallProgress(event));
  } catch {
    const message = translate(useUiStore.getState().locale, "update.installFailed");
    store.report({ phase: "error", error: message, installError: message });
  }
}

function reportInstallProgress(event: UpdateInstallEvent): void {
  if (event.phase === "downloading") {
    useDesktopUpdateStore.getState().report({ progress: event.progress });
    return;
  }
  useDesktopUpdateStore.getState().report({ phase: "preparingInstall" });
}

import { useEffect } from "react";
import { checkForDesktopUpdate, installDesktopUpdate } from "../utils/desktopUpdateFlow";
import { useDesktopUpdateStore } from "../stores/desktop-update.store";

/** 启动后延迟自动检查，避免与首屏加载 / 启动同步抢带宽。 */
const AUTO_CHECK_DELAY_MS = 3_000;

/** 桌面端升级弹窗：启动后自动检查一次，并基于共享 store 计算展示状态与动作。 */
export function useDesktopUpdatePrompt() {
  const state = useDesktopUpdateStore();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void checkForDesktopUpdate();
    }, AUTO_CHECK_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const { info, dismissedVersion, snoozedVersion, phase, installError } = state;
  const version = info?.version ?? null;
  const activeInstall = phase === "downloading" || phase === "preparingInstall";
  const installFailed = phase === "error" && installError !== null;
  const visible = info !== null
    && version !== dismissedVersion
    && version !== snoozedVersion
    && (phase === "readyToInstall" || activeInstall || installFailed);

  return {
    ...state,
    visible,
    activeInstall,
    installFailed,
    checkForUpdate: checkForDesktopUpdate,
    install: installDesktopUpdate,
    snooze: () => {
      if (version) state.snooze(version);
    },
    dismiss: () => {
      if (version) state.dismiss(version);
    },
  };
}

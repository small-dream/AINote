import { useCallback, useEffect } from "react";
import { updateApi } from "@/api";
import type { UpdateInfo, UpdateProgress } from "@/api/update.api";
import type { DesktopUpdatePhase } from "../stores/desktop-update.store";
import { useDesktopUpdateStore } from "../stores/desktop-update.store";
import { checkForDesktopUpdate, installDesktopUpdate } from "../utils/desktopUpdateFlow";

export type UpdatePhase = DesktopUpdatePhase;

export interface UpdateState {
  phase: UpdatePhase;
  currentVersion: string | null;
  info: UpdateInfo | null;
  progress: UpdateProgress | null;
  checkedAt: Date | null;
  error: string | null;
}

/**
 * 桌面更新检查与安装编排（store 驱动）：设置页与升级弹窗共用同一份状态，
 * 挂载时只补当前版本号，不重复触发检查。
 */
export function useUpdate() {
  const state = useDesktopUpdateStore();

  useEffect(() => {
    let mounted = true;

    updateApi.getCurrentVersion().then((currentVersion) => {
      if (!mounted) return;
      const store = useDesktopUpdateStore.getState();
      if (store.phase === "initializing") {
        store.report({ phase: "ready", currentVersion });
      } else if (!store.currentVersion) {
        store.report({ currentVersion });
      }
    }).catch(() => {
      if (!mounted) return;
      const store = useDesktopUpdateStore.getState();
      if (store.phase === "initializing") store.report({ phase: "ready" });
    });

    return () => {
      mounted = false;
    };
  }, []);

  const checkForUpdate = useCallback(() => checkForDesktopUpdate(), []);
  const install = useCallback(() => installDesktopUpdate(), []);

  return { ...state, checkForUpdate, install };
}

import { useCallback, useState } from "react";
import { updateApi } from "@/api";
import type { UpdateInfo } from "@/api/update.api";

interface UpdateState {
  info: UpdateInfo | null;
  busy: boolean;
  error: string | null;
  checked: boolean;
}

/** 更新检查与安装编排；仅保留 UI 瞬态，更新元数据来自 updater 插件。 */
export function useUpdate() {
  const [state, setState] = useState<UpdateState>({ info: null, busy: false, error: null, checked: false });

  const checkForUpdate = useCallback(async () => {
    setState((current) => ({ ...current, busy: true, error: null }));
    try {
      const info = await updateApi.checkForUpdate();
      setState({ info, busy: false, error: null, checked: true });
      return info;
    } catch (error) {
      const message = error instanceof Error ? error.message : "检查更新失败";
      setState((current) => ({ ...current, busy: false, error: message, checked: true }));
      return null;
    }
  }, []);

  const install = useCallback(async () => {
    setState((current) => ({ ...current, busy: true, error: null }));
    try {
      await updateApi.installUpdate();
    } catch (error) {
      const message = error instanceof Error ? error.message : "安装更新失败";
      setState((current) => ({ ...current, busy: false, error: message }));
    }
  }, []);

  return { ...state, checkForUpdate, install };
}

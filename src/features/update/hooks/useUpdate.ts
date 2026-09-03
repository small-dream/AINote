import { useCallback, useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { updateApi } from "@/api";
import type { UpdateInfo, UpdateInstallEvent, UpdateProgress } from "@/api/update.api";
import { useTranslation } from "@/i18n";

export type UpdatePhase =
  | "initializing"
  | "ready"
  | "checking"
  | "upToDate"
  | "readyToInstall"
  | "downloading"
  | "preparingInstall"
  | "error";

export interface UpdateState {
  phase: UpdatePhase;
  currentVersion: string | null;
  info: UpdateInfo | null;
  progress: UpdateProgress | null;
  checkedAt: Date | null;
  error: string | null;
}

const INITIAL_STATE: UpdateState = {
  phase: "initializing",
  currentVersion: null,
  info: null,
  progress: null,
  checkedAt: null,
  error: null,
};

/** 更新检查与安装编排；仅保留 UI 瞬态，更新元数据来自 updater 插件。 */
export function useUpdate() {
  const { t } = useTranslation();
  const [state, setState] = useState<UpdateState>(INITIAL_STATE);

  useEffect(() => {
    let mounted = true;

    updateApi.getCurrentVersion().then((currentVersion) => {
      if (mounted) setState((current) => ({ ...current, phase: "ready", currentVersion }));
    }).catch(() => {
      if (mounted) setState((current) => ({ ...current, phase: "ready" }));
    });

    return () => {
      mounted = false;
    };
  }, []);

  const checkForUpdate = useCallback(async () => {
    setState((current) => ({ ...current, phase: "checking", error: null }));

    try {
      const info = await updateApi.checkForUpdate();
      setState((current) => createCheckedState(info, current));
      return info;
    } catch {
      setState((current) => createErrorState(current, t("update.checkFailed")));
      return null;
    }
  }, [t]);

  const install = useCallback(async () => {
    setState((current) => ({ ...current, phase: "downloading", error: null, progress: null }));

    try {
      await updateApi.installUpdate((event) => updateInstallProgress(event, setState));
    } catch {
      setState((current) => createErrorState(current, t("update.installFailed")));
    }
  }, [t]);

  return { ...state, checkForUpdate, install };
}

function createCheckedState(info: UpdateInfo | null, current: UpdateState): UpdateState {
  return {
    phase: info ? "readyToInstall" : "upToDate",
    currentVersion: info?.currentVersion ?? current.currentVersion,
    info,
    progress: null,
    checkedAt: new Date(),
    error: null,
  };
}

function createErrorState(current: UpdateState, message: string): UpdateState {
  return { ...current, phase: "error", error: message };
}

function updateInstallProgress(
  event: UpdateInstallEvent,
  setState: Dispatch<SetStateAction<UpdateState>>,
): void {
  if (event.phase === "downloading") {
    setState((current) => ({ ...current, progress: event.progress }));
    return;
  }
  setState((current) => ({ ...current, phase: "preparingInstall" }));
}

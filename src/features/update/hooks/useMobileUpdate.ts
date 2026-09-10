import { useCallback, useEffect } from "react";
import { releaseApi } from "@/api";
import { isAndroidApp } from "@/platform/runtime";
import { useMobileUpdateStore } from "../stores/mobile-update.store";
import { isNewerVersion } from "../utils/version";

/** 同一时刻只允许一次检查（提示条与设置页可能同时挂载）。 */
let inFlight: Promise<void> | null = null;

async function checkLatestRelease(): Promise<void> {
  const store = useMobileUpdateStore.getState();
  if (store.phase === "checking") return;
  store.report({ phase: "checking", currentVersion: store.currentVersion, release: null });

  try {
    const release = await releaseApi.fetchLatestRelease();
    const available = isNewerVersion(release.version, release.currentVersion);
    useMobileUpdateStore.getState().report({
      phase: available ? "available" : "upToDate",
      currentVersion: release.currentVersion,
      release: available ? release : null,
    });
  } catch {
    // 无网络或接口异常一律静默降级，不打扰用户
    useMobileUpdateStore.getState().report({ phase: "failed", currentVersion: null, release: null });
  }
}

function requestCheck(): Promise<void> {
  inFlight ??= checkLatestRelease().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/** 移动端更新检查：进入应用或设置页自动查一次，也可手动重新检查。 */
export function useMobileUpdate() {
  const state = useMobileUpdateStore();
  const check = useCallback(() => requestCheck(), []);

  useEffect(() => {
    if (isAndroidApp()) void requestCheck();
  }, []);

  return { ...state, check };
}

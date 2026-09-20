import { useEffect, useRef } from "react";
import { messageOf } from "@/api/error";
import { flushPendingDrafts } from "@/features/note/utils/draftRegistry";
import { useVaultLockMutation, useVaultStatusQuery } from "@/queries/vault.queries";
import { useToastStore } from "@/stores/toast.store";
import { useUiStore } from "@/stores/ui.store";
import { useVaultUnlockStore } from "@/stores/vault-unlock.store";
import { useTranslation } from "@/i18n";

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "scroll", "wheel", "touchstart"] as const;

/**
 * 空闲自动锁定（P1）：解锁态下按设置时长计时，超时先落盘草稿再锁定。
 * 窗口隐藏 / 锁屏 / 睡眠期间清掉计时器，回到前台时按「离开时长」补算——
 * 离开超过阈值立即锁定，否则按剩余时间继续。纯前端计时，不触碰 Rust。
 */
export function useVaultAutoLock(repoPath: string | null) {
  const { t } = useTranslation();
  const unlocked = useVaultStatusQuery(repoPath).data?.state === "unlocked";
  const minutes = useUiStore((state) => state.vaultAutoLock);
  const lock = useVaultLockMutation();
  const lockRef = useRef(lock);
  useEffect(() => {
    lockRef.current = lock;
  }, [lock]);

  useEffect(() => {
    if (!unlocked || minutes <= 0) return;
    const timeoutMs = minutes * 60_000;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let hiddenAt: number | null = null;

    const clearTimer = () => {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
    };
    const attemptLock = () => {
      clearTimer();
      if (lockRef.current.isPending) return;
      // 空闲自动锁定是被动锁定：允许用户回来后由解锁界面自动弹一次设备认证。
      useVaultUnlockStore.getState().arm();
      void flushPendingDrafts()
        .then(() => lockRef.current.mutateAsync())
        .catch((error: unknown) => {
          useToastStore.getState().push(t("vault.lockFlushFailed", { message: messageOf(error) }), "error");
          timer = setTimeout(attemptLock, timeoutMs);
        });
    };
    const onVisibilityChange = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
        clearTimer();
      } else if (hiddenAt !== null) {
        const elapsed = Date.now() - hiddenAt;
        hiddenAt = null;
        if (elapsed >= timeoutMs) {
          attemptLock();
        } else {
          clearTimer();
          timer = setTimeout(attemptLock, timeoutMs - elapsed);
        }
      }
    };
    const onActivity = () => {
      clearTimer();
      timer = setTimeout(attemptLock, timeoutMs);
    };

    timer = setTimeout(attemptLock, timeoutMs);
    for (const event of ACTIVITY_EVENTS) document.addEventListener(event, onActivity, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearTimer();
      for (const event of ACTIVITY_EVENTS) document.removeEventListener(event, onActivity);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [unlocked, minutes, t]);
}

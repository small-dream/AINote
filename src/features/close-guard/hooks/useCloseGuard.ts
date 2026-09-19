import { useEffect, useRef, useState } from "react";
import { onCloseRequested } from "@/api/close-guard.api";
import { confirmClose } from "@/api/app.api";
import { isTauriRuntime } from "@/api/back-button.api";
import { reportToastError } from "@/stores/toast.store";
import { flushPendingDrafts } from "@/features/note/utils/draftRegistry";

/** 桌面退出确认：监听 Rust 侧「有未提交变更或未落盘草稿」的关闭拦截，弹出确认框。 */
export function useCloseGuard() {
  const [open, setOpen] = useState(false);
  const closing = useRef(false);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    onCloseRequested(() => {
      if (!cancelled) setOpen(true);
    })
      .then((off) => {
        if (cancelled) off();
        else unlisten = off;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  /** 确认退出：先落盘未保存草稿，成功后才关闭窗口；任一步失败则复位并提示，允许重试。 */
  const confirm = () => {
    if (closing.current) return;
    closing.current = true;
    void (async () => {
      try {
        await flushPendingDrafts();
        await confirmClose();
      } catch (error) {
        reportToastError(error);
      } finally {
        // 成功时窗口随即销毁，复位无害；失败时必须复位，否则确认按钮「一次性死亡」
        closing.current = false;
      }
    })();
  };
  const cancel = () => setOpen(false);

  return { open, confirm, cancel };
}

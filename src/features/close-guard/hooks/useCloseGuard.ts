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

  /** 确认退出：先落盘未保存草稿，成功后才关闭窗口；保存失败则留在应用内并提示。 */
  const confirm = () => {
    if (closing.current) return;
    closing.current = true;
    void (async () => {
      try {
        await flushPendingDrafts();
      } catch (error) {
        closing.current = false;
        reportToastError(error);
        return;
      }
      await confirmClose().catch(reportToastError);
    })();
  };
  const cancel = () => setOpen(false);

  return { open, confirm, cancel };
}

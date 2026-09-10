import { useEffect, useState } from "react";
import { onCloseRequested } from "@/api/close-guard.api";
import { confirmClose } from "@/api/app.api";
import { isTauriRuntime } from "@/api/back-button.api";
import { reportToastError } from "@/stores/toast.store";

/** 桌面退出确认：监听 Rust 侧「有未提交变更」的关闭拦截，弹出确认框。 */
export function useCloseGuard() {
  const [open, setOpen] = useState(false);

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

  const confirm = () => {
    void confirmClose().catch(reportToastError);
  };
  const cancel = () => setOpen(false);

  return { open, confirm, cancel };
}

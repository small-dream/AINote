import { useState } from "react";

/** 历史面板开关与编辑器重载纪元（恢复成功后递增，让编辑器重载最新内容） */
export function useNoteHistory() {
  const [open, setOpen] = useState(false);
  const [reloadEpoch, setReloadEpoch] = useState(0);
  return {
    open,
    openHistory: () => setOpen(true),
    closeHistory: () => setOpen(false),
    reloadEpoch,
    onRestored: () => setReloadEpoch((epoch) => epoch + 1),
  };
}

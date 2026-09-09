import { useCallback, useEffect, useState } from "react";

export type MobileWorkspaceView = "list" | "editor";

interface MobileEditorViewOptions {
  currentNotePath: string | null;
  openEditorSignal: number;
  onBackToList: () => void;
  onFlush: () => Promise<void> | void;
}

/** 移动端编辑器路由：选中笔记进入详情，系统返回回到列表。 */
export function useMobileEditorView({ currentNotePath, openEditorSignal, onBackToList, onFlush }: MobileEditorViewOptions) {
  const [dismissedSignal, setDismissedSignal] = useState(-1);

  useEffect(() => {
    if (!currentNotePath) return;
    if (!window.history.state?.ainoteMobileEditor) window.history.pushState({ ainoteMobileEditor: true }, "");
  }, [currentNotePath, openEditorSignal]);

  useEffect(() => {
    const onPopState = () => {
      onFlush();
      onBackToList();
      setDismissedSignal(openEditorSignal);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [onBackToList, onFlush, openEditorSignal]);

  const backToList = useCallback(() => {
    void onFlush();
    onBackToList();
    setDismissedSignal(openEditorSignal);
    if (window.history.state?.ainoteMobileEditor) window.history.back();
  }, [onBackToList, onFlush, openEditorSignal]);

  return { showEditor: currentNotePath !== null && openEditorSignal > dismissedSignal, backToList };
}

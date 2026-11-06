import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useHorizontalScrollbar } from "./useHorizontalScrollbar";

/** 只改变当前 DOM 的展示，不进入文档、撤销历史或持久化偏好。 */
export function useCodeBlockPresentation(pre: HTMLPreElement, onLayoutChange?: () => void) {
  const preRef = useRef(pre);
  const [wrapped, setWrapped] = useState(false);
  const metrics = useHorizontalScrollbar(preRef);
  const { refresh } = metrics;

  useLayoutEffect(() => {
    pre.classList.toggle("note-code-wrapped", wrapped);
    const element = preRef.current;
    element.scrollLeft = 0;
    refresh();
    onLayoutChange?.();
    return () => { pre.classList.remove("note-code-wrapped"); };
  }, [pre, wrapped, refresh, onLayoutChange]);

  const toggleWrap = useCallback(() => setWrapped((value) => !value), []);
  return { preRef, wrapped, toggleWrap, ...metrics };
}

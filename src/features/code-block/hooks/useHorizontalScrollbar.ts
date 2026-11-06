import { useCallback, useLayoutEffect, useState, type RefObject } from "react";
import {
  horizontalScrollbarMetrics,
  type HorizontalScrollbarMetrics,
} from "../utils/horizontalScrollbar";

interface HorizontalScrollbarState extends HorizontalScrollbarMetrics {
  scrollLeft: number;
}

const EMPTY_STATE: HorizontalScrollbarState = {
  visible: false,
  maxScroll: 0,
  thumbWidth: 0,
  thumbOffset: 0,
  scrollLeft: 0,
};

/** 跟踪横向滚动容器的尺寸、位置，并返回强制刷新的方法。 */
export function useHorizontalScrollbar(ref: RefObject<HTMLElement | null>) {
  const [state, setState] = useState(EMPTY_STATE);
  const refresh = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    const next: HorizontalScrollbarState = {
      ...horizontalScrollbarMetrics(element.clientWidth, element.scrollWidth, element.scrollLeft),
      scrollLeft: element.scrollLeft,
    };
    setState((previous) => sameState(previous, next) ? previous : next);
  }, [ref]);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    let active = true;
    refresh();
    element.addEventListener("scroll", refresh, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(refresh);
    observer?.observe(element);
    if (element.firstElementChild) observer?.observe(element.firstElementChild);
    const mutations = new MutationObserver(refresh);
    mutations.observe(element, { childList: true, subtree: true, characterData: true, attributes: true });
    void document.fonts?.ready.then(() => { if (active) refresh(); }).catch(() => undefined);
    return () => {
      active = false;
      element.removeEventListener("scroll", refresh);
      observer?.disconnect();
      mutations.disconnect();
    };
  }, [refresh, ref]);

  return { ...state, refresh };
}

function sameState(left: HorizontalScrollbarState, right: HorizontalScrollbarState): boolean {
  return left.visible === right.visible &&
    left.maxScroll === right.maxScroll &&
    left.thumbWidth === right.thumbWidth &&
    Math.abs(left.thumbOffset - right.thumbOffset) < 0.5 &&
    Math.abs(left.scrollLeft - right.scrollLeft) < 0.5;
}

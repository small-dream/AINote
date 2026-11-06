import { useRef, type RefObject } from "react";
import { useCodeBlockScrollControls } from "../hooks/useCodeBlockScrollControls";
import type { HorizontalScrollbarMetrics } from "../utils/horizontalScrollbar";

interface Props extends HorizontalScrollbarMetrics {
  preRef: RefObject<HTMLPreElement | null>;
  scrollLeft: number;
  label: string;
  preId: string;
}

/** WebKit 原生横向条会自动隐藏，统一提供可拖动且键盘可达的轨道。 */
export function CodeScrollbar({ preRef, preId, scrollLeft, label, ...metrics }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const controls = useCodeBlockScrollControls(preRef, trackRef, metrics);
  return (
    <div ref={trackRef} className="note-code-scrollbar markdown-code-scrollbar" role="scrollbar"
      tabIndex={0} aria-label={label} aria-controls={preId} aria-orientation="horizontal"
      aria-valuemin={0} aria-valuemax={Math.round(metrics.maxScroll)} aria-valuenow={Math.round(scrollLeft)}
      onPointerDown={controls.handleTrackPointerDown} onKeyDown={controls.handleKeyDown}>
      <div className="note-code-scrollbar-thumb markdown-code-scrollbar-thumb"
        style={{ width: metrics.thumbWidth, transform: "translateX(" + metrics.thumbOffset + "px)" }}
        onPointerDown={controls.handleThumbPointerDown} onPointerMove={controls.handleThumbPointerMove}
        onPointerUp={controls.endThumbDrag} onPointerCancel={controls.endThumbDrag}
        onLostPointerCapture={controls.clearDrag} />
    </div>
  );
}

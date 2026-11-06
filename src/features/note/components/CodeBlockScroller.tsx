import {
  useId,
  useLayoutEffect,
  useRef,
  type ComponentProps,
} from "react";
import { useTranslation } from "@/i18n";
import { useHorizontalScrollbar } from "../hooks/useHorizontalScrollbar";
import { useCodeBlockScrollControls } from "../hooks/useCodeBlockScrollControls";

/** 预览代码块：保留原生横向滚动，并绘制 WebKit 下不会自动隐藏的横向滚动条。 */
export function CodeBlockScroller({ children, className, ...props }: ComponentProps<"pre">) {
  const { t } = useTranslation();
  const preRef = useRef<HTMLPreElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const scrollbarId = useId();
  const { visible, maxScroll, thumbWidth, thumbOffset, scrollLeft, refresh } = useHorizontalScrollbar(preRef);
  const controls = useCodeBlockScrollControls(preRef, trackRef, { thumbWidth, maxScroll });

  useLayoutEffect(() => {
    refresh();
  }, [children, refresh]);

  const preClassName = ["markdown-code-pre", className].filter(Boolean).join(" ");
  return (
    <div className="markdown-code-scroller">
      <pre {...props} ref={preRef} id={scrollbarId} className={preClassName}>{children}</pre>
      {visible ? (
        <div
          ref={trackRef}
          className="markdown-code-scrollbar"
          role="scrollbar"
          tabIndex={0}
          aria-label={t("note.codeBlock")}
          aria-controls={scrollbarId}
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={Math.round(maxScroll)}
          aria-valuenow={Math.round(scrollLeft)}
          onPointerDown={controls.handleTrackPointerDown}
          onKeyDown={controls.handleKeyDown}
        >
          <div
            className="markdown-code-scrollbar-thumb"
            style={{ width: thumbWidth, transform: `translateX(${thumbOffset}px)` }}
            onPointerDown={controls.handleThumbPointerDown}
            onPointerMove={controls.handleThumbPointerMove}
            onPointerUp={controls.endThumbDrag}
            onPointerCancel={controls.endThumbDrag}
            onLostPointerCapture={controls.clearDrag}
          />
        </div>
      ) : null}
    </div>
  );
}

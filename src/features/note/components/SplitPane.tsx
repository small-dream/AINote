import { useCallback, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";

interface SplitPaneProps {
  left: ReactNode;
  right: ReactNode;
}

const MIN_RATIO = 0.2;
const MAX_RATIO = 0.8;

/** 编辑/预览分栏：左侧面板 + 可拖拽分割线 + 右侧面板（默认等分 50%，P0-2） */
export function SplitPane({ left, right }: SplitPaneProps) {
  const [ratio, setRatio] = useState(0.5);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(true);
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const onMove = (ev: PointerEvent) => {
      const next = (ev.clientX - rect.left) / rect.width;
      setRatio(Math.min(MAX_RATIO, Math.max(MIN_RATIO, next)));
    };
    const onUp = () => {
      setDragging(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, []);

  return (
    <div ref={containerRef} className="flex min-h-0 flex-1 overflow-hidden">
      <div style={{ width: `${ratio * 100}%` }} className="min-w-0 shrink-0 overflow-hidden">
        {left}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="调整编辑/预览比例"
        className={`w-1 shrink-0 cursor-col-resize transition-colors hover:bg-accent ${
          dragging ? "bg-accent" : "bg-border"
        }`}
        onPointerDown={onPointerDown}
      />
      <div className="min-w-0 flex-1 overflow-hidden">{right}</div>
    </div>
  );
}

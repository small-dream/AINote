import { useCallback, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { useTranslation } from "@/i18n";

interface SplitPaneProps {
  left: ReactNode;
  right: ReactNode;
  ratio?: number;
  onRatioChange?: (ratio: number) => void;
}

const MIN_RATIO = 0.2;
const MAX_RATIO = 0.8;
const KEYBOARD_STEP = 0.02;

/** 编辑/预览分栏：左侧面板 + 可拖拽分割线 + 右侧面板（默认等分 50%，P0-2） */
export function SplitPane({ left, right, ratio: controlledRatio, onRatioChange }: SplitPaneProps) {
  const { t } = useTranslation();
  const [internalRatio, setInternalRatio] = useState(0.5);
  const ratio = controlledRatio ?? internalRatio;
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
      const value = Math.min(MAX_RATIO, Math.max(MIN_RATIO, next));
      if (onRatioChange) onRatioChange(value);
      else setInternalRatio(value);
    };
    const onUp = () => {
      setDragging(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [onRatioChange]);
  return <PaneLayout containerRef={containerRef} ratio={ratio} dragging={dragging} onPointerDown={onPointerDown} onRatioChange={(value) => onRatioChange ? onRatioChange(value) : setInternalRatio(value)} label={t("note.resize")} left={left} right={right} />;
}

interface PaneLayoutProps { containerRef: React.RefObject<HTMLDivElement | null>; ratio: number; dragging: boolean; onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void; onRatioChange: (value: number) => void; label: string; left: ReactNode; right: ReactNode; }

function PaneLayout({ containerRef, ratio, dragging, onPointerDown, onRatioChange, label, left, right }: PaneLayoutProps) {
  const adjustRatio = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? KEYBOARD_STEP * 5 : KEYBOARD_STEP;
    const next = event.key === "ArrowLeft" ? ratio - step : event.key === "ArrowRight" ? ratio + step : event.key === "Home" ? MIN_RATIO : event.key === "End" ? MAX_RATIO : null;
    if (next === null) return;
    event.preventDefault();
    const value = Math.min(MAX_RATIO, Math.max(MIN_RATIO, next));
    onRatioChange(value);
  };
  return (<div ref={containerRef} className="flex h-full min-h-0 flex-1 overflow-hidden">
      <div style={{ width: `${ratio * 100}%` }} className="min-w-0 shrink-0 overflow-hidden">
        {left}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={label}
        aria-valuemin={MIN_RATIO * 100}
        aria-valuemax={MAX_RATIO * 100}
        aria-valuenow={Math.round(ratio * 100)}
        tabIndex={0}
        className={`w-1 shrink-0 cursor-col-resize transition-colors hover:bg-accent ${
          dragging ? "bg-accent" : "bg-border"
        }`}
        onPointerDown={onPointerDown}
        onKeyDown={adjustRatio}
      />
      <div className="min-w-0 flex-1 overflow-hidden">{right}</div>
    </div>);
}

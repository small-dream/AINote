import { useCallback, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { useTranslation } from "@/i18n";

interface SplitPaneProps {
  left: ReactNode;
  right: ReactNode;
  ratio?: number;
  onRatioChange?: (ratio: number) => void;
}

const MIN_RATIO = 0.2;
const MAX_RATIO = 0.8;

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
  return <PaneLayout containerRef={containerRef} ratio={ratio} dragging={dragging} onPointerDown={onPointerDown} label={t("note.resize")} left={left} right={right} />;
}

interface PaneLayoutProps { containerRef: React.RefObject<HTMLDivElement | null>; ratio: number; dragging: boolean; onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void; label: string; left: ReactNode; right: ReactNode; }

function PaneLayout({ containerRef, ratio, dragging, onPointerDown, label, left, right }: PaneLayoutProps) {
  return (<div ref={containerRef} className="flex h-full min-h-0 flex-1 overflow-hidden">
      <div style={{ width: `${ratio * 100}%` }} className="min-w-0 shrink-0 overflow-hidden">
        {left}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={label}
        className={`w-1 shrink-0 cursor-col-resize transition-colors hover:bg-accent ${
          dragging ? "bg-accent" : "bg-border"
        }`}
        onPointerDown={onPointerDown}
      />
      <div className="min-w-0 flex-1 overflow-hidden">{right}</div>
    </div>);
}

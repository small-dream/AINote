import { useEffect, useRef, useState, type CSSProperties } from "react";

export function useCreateMenuLayer(open: boolean, close: () => void) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<CSSProperties>({});

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const width = 256;
      const fitsBelow = rect.bottom + 368 <= window.innerHeight;
      const fitsRight = rect.right + width + 8 <= window.innerWidth;
      setPosition({
        left: fitsRight ? rect.right + 8 : Math.max(12, rect.left - width - 8),
        top: fitsBelow ? rect.top : undefined,
        bottom: fitsBelow ? undefined : window.innerHeight - rect.bottom,
      });
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    updatePosition();
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, close]);

  return { triggerRef, menuRef, position };
}

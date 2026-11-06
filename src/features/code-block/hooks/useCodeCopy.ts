import { useCallback, useEffect, useRef, useState } from "react";

export type CopyStatus = "idle" | "copied" | "failed";

export function useCodeCopy(getSource: () => string) {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const active = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sequence = useRef(0);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const copy = useCallback(async () => {
    const request = ++sequence.current;
    if (timer.current) clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(getSource());
      if (!active.current || request !== sequence.current) return;
      setStatus("copied");
      timer.current = setTimeout(() => setStatus("idle"), 1400);
    } catch {
      if (active.current && request === sequence.current) setStatus("failed");
    }
  }, [getSource]);
  return { status, copy };
}

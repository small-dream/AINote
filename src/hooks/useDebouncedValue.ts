import { useEffect, useState } from "react";

/** 时间防抖值：delayMs 窗口内的连续变化只保留最新值，到期后才生效（区别于 useDeferredValue 的调度语义）。 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

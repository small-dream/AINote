export function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException("document import cancelled", "AbortError");
}

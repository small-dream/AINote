import { isMobileApp } from "./runtime";

export function usesNativeTextContextMenu(event: MouseEvent): boolean {
  if ("pointerType" in event && typeof event.pointerType === "string" && event.pointerType) {
    return event.pointerType === "touch" || event.pointerType === "pen";
  }
  if ("sourceCapabilities" in event && event.sourceCapabilities) {
    const capabilities = event.sourceCapabilities;
    if (typeof capabilities === "object" && "firesTouchEvents" in capabilities) {
      return capabilities.firesTouchEvents === true;
    }
  }
  return isMobileApp() || globalThis.matchMedia?.("(pointer: coarse)").matches === true;
}

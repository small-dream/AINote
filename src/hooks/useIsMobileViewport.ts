import { useEffect, useState } from "react";

const MOBILE_QUERY = "(max-width: 767px)";

/** 以窗口宽度判断移动布局；与设备 UA 无关，便于模拟器和桌面窄窗测试。 */
export function useIsMobileViewport(): boolean {
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.matchMedia?.(MOBILE_QUERY).matches === true);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const media = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  return isMobile;
}

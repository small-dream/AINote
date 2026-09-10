import { openExternal } from "@/api";
import { isTauriRuntime } from "@/api/back-button.api";

/** 只有 http/https 视为可交给系统浏览器打开的外链（与 Rust `open_external` 白名单一致）。 */
export function isExternalHttpUrl(url: string | undefined | null): url is string {
  return typeof url === "string" && /^https?:\/\//i.test(url);
}

/**
 * 打开外部链接：壳内（桌面 / 移动）交给系统默认程序，纯浏览器环境（`pnpm dev` / E2E）退回新标签页。
 * 平台差异收敛在此，调用方只负责阻止默认导航与错误提示。
 */
export function openExternalLink(url: string): Promise<void> {
  if (!isTauriRuntime()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return Promise.resolve();
  }
  return openExternal(url);
}

/** 平台中立的链接动作：编辑器 / 预览共用，平台差异由 openExternalLink 收敛。 */

import { openExternalLink } from "./open-link";

export interface LinkActions {
  openLink: (url: string) => void;
  copyLink: (url: string) => void;
}

export function createLinkActions(): LinkActions {
  return {
    openLink(url) {
      void openExternalLink(url).catch(() => undefined);
    },
    copyLink(url) {
      void navigator.clipboard.writeText(url).catch(() => undefined);
    },
  };
}

const URL_PATTERN = /^(https?:\/\/|mailto:|\/|#|\.\/|\.\.\/)/i;
const BARE_DOMAIN_PATTERN = /^[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/;
const BARE_EMAIL_PATTERN = /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/;

/** 空值视为解除链接；裸邮箱补 mailto:，其余交给统一 URL 规范化。 */
export function normalizeLinkInput(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  if (URL_PATTERN.test(url)) return url;
  if (BARE_EMAIL_PATTERN.test(url)) return `mailto:${url}`;
  return BARE_DOMAIN_PATTERN.test(url) ? `https://${url}` : null;
}

/** 链接编辑框的回显值：邮箱去掉 `mailto:` 前缀，提交时再由 normalizeLinkInput 补回。 */
export function linkInputValue(href: string): string {
  const address = href.replace(/^mailto:/i, "");
  return /^mailto:/i.test(href) && BARE_EMAIL_PATTERN.test(address) ? address : href;
}

/** 右键 / 长按只能看到 URL；编辑层选中当前链接后可继续修改或移除。 */
export function displayableLinkUrl(href: string): string {
  try {
    const url = new URL(href);
    if (url.protocol === "mailto:") return decodeURIComponent(url.pathname);
    return url.hostname + url.pathname + url.search + url.hash;
  } catch {
    return href;
  }
}
